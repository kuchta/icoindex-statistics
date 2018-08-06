import R from 'ramda';
import { timer } from 'rxjs';
import { flatMap, filter, takeWhile } from 'rxjs/operators';

import logger from '../logger';
import config from '../config';
import { Option } from '../interfaces';
import { Message, purgeQueue, receiveMessage, deleteMessage } from '../sqs';
import { putItem } from '../dynamo';
import { sendMessage } from '../sns';

export const description = 'Push tickers to database';
export const options: Option[] = [
	{ option: '-p, --print', description: 'Dont\'t save, just print' },
	{ option: '-P, --purge-queue', description: 'purge queue' },
];

export default async function main(options: {[key: string]: string}) {
	if (options.purgeQueue) {
		await purgeQueue();
		logger.info('queue purged');
	}
	if (options.print) {
		storeService({ nextHandler: (message) => {
			if (options.print) {
				logger.info('Received from queue', message);
			}
		}});
	} else {
		storeService();
	}
}

export function storeService({ fetch = receiveMessage, stopPredicate = () => false, nextHandler, nextThenHandler, nextErrorHandler, errorHandler, completeHandler }: {
		fetch?: (timeout?: number) => Promise<Message<object> | null>,
		stopPredicate?: () => boolean,
		nextHandler?: (item: any) => void,
		nextThenHandler?: (item: any) => void,
		nextErrorHandler?: (error: any) => void,
		errorHandler?: (error: any) => void,
		completeHandler?: () => void } = {} ) {

	let observable = timer(0, config.DYNAMO_INTERVAL).pipe(
		takeWhile(() => !(stopPredicate() || process.exitCode !== undefined)),
		flatMap(fetch),
		filter((message): message is Message<object> => message !== null)
	);

	observable.subscribe(
		nextHandler ? (message) => nextHandler(message) : async (message) => {
			try {
				logger.debug('Storing document', message);

				if (message.body && !R.isEmpty(message.body)) {
					await putItem(message.body);
					nextThenHandler ? nextThenHandler(message.body) : logger.info1('Succesfully sent to database', message.body);
				}

				if (message.attributes && message.attributes.storeEvent) {
					logger.debug('Sending store-event', message.attributes.storeEvent);
					sendMessage(message.attributes.storeEvent);
				}

				deleteMessage(message.receiptHandle);
			} catch (error) {
				nextErrorHandler ? nextErrorHandler(error) : logger.error('Sending to database failed', error);
			}
		},
		(error) => errorHandler ? errorHandler(error) : logger.error('Error', error),
		() => completeHandler ? completeHandler() : logger.info('Completed')
	);
}
