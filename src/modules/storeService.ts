import R from 'ramda';
import { timer } from 'rxjs';
import { flatMap, filter, takeWhile } from 'rxjs/operators';

import { Option } from '../interfaces';

import logger from '../logger';
import config from '../config';

import { Message, purgeQueue as purgeQ, receiveMessage, deleteMessage } from '../sqs';
import { sendMessage } from '../sns';
import { putItem } from '../dynamo';

export const description = 'Store Service';
export const options: Option[] = [
	{ option: '-P, --print', description: "Dont't save, just print" },
	{ option: '-Q, --purge-queue', description: 'Purge queue' },
];

export default async function main(options: { [key: string]: string }) {
	if (options.print) {
		storeService({ purgeQueue: Boolean(options.purgeQueue), nextHandler: (message) => logger.info('Received from queue', message) });
	} else {
		storeService({ purgeQueue: Boolean(options.purgeQueue) });
	}
}

export async function storeService({ purgeQueue = false, stopPredicate = () => false, nextHandler, nextThenHandler, nextErrorHandler, errorHandler, completeHandler }: {
		purgeQueue?: boolean,
		stopPredicate?: () => boolean,
		fetch?: (timeout?: number) => Promise<Message<object> | null>,
		nextHandler?: (item: any) => void,
		nextThenHandler?: (item: any) => void,
		nextErrorHandler?: (error: any) => void,
		errorHandler?: (error: any) => void,
		completeHandler?: () => void } = {} ) {

	if (purgeQueue) {
		await purgeQ();
		logger.warning('Queue purged');
	}

	const observable = timer(0, config.DYNAMO_INTERVAL).pipe(
		takeWhile(() => !(stopPredicate() || process.exitCode !== undefined)),
		flatMap(() => receiveMessage()),
		filter((message): message is Message<object> => message !== null)
	);

	observable.subscribe(
		nextHandler ? (message) => nextHandler(message) : async (message) => {
			try {
				if (message.body && !R.isEmpty(message.body)) {
					await putItem(message.body);
					logger.info1('Succesfully stored to database', message.body);

					if (nextThenHandler) {
						nextThenHandler(message.body);
					}
				}

				if (message.attributes && message.attributes.storeEvent) {
					logger.debug('Sending store-event', { message: message.body, storeEvent: message.attributes.storeEvent });
					await sendMessage(message.attributes.storeEvent);
				}

				await deleteMessage(message.receiptHandle);
			} catch (error) {
				logger.error('Storing to database failed', error);
				if (nextErrorHandler) {
					nextErrorHandler(error);
				}
			}
		}, (error) => {
			logger.error('Error', error);
			if (errorHandler) {
				errorHandler(error);
			}
		}, () => {
			if (completeHandler) {
				completeHandler();
			}
			logger.info('storeService finished');
		}
	);
}
