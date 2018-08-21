import R from 'ramda';
import { timer } from 'rxjs';
import { flatMap, filter, takeWhile } from 'rxjs/operators';

import logger from '../logger';
import config from '../config';

import { Option } from '../interfaces';

import { Message, purgeQueue as purgeQ, receiveMessage, deleteMessage } from '../sqs';
import { sendMessage } from '../sns';
import { scan, putItem, deleteItem } from '../dynamo';

export const description = 'Push tickers to database';
export const options: Option[] = [
	{ option: '-P, --print', description: 'Dont\'t save, just print' },
	{ option: '-D, --purge-database', description: 'Purge database' },
	{ option: '-Q, --purge-queue', description: 'Purge queue' },
];

export default async function main(options: { [key: string]: string }) {
	if (options.print) {
		storeService({ purgeDatabase: Boolean(options.purgeDatabase), purgeQueue: Boolean(options.purgeQueue), nextHandler: (message) => logger.info('Received from queue', message) });
	} else {
		storeService({ purgeDatabase: Boolean(options.purgeDatabase), purgeQueue: Boolean(options.purgeQueue) });
	}
}

export async function storeService({ purgeDatabase = false, purgeQueue = false, stopPredicate = () => false, fetch = receiveMessage, nextHandler, nextThenHandler, nextErrorHandler, errorHandler, completeHandler }: {
		purgeDatabase?: boolean,
		purgeQueue?: boolean,
		stopPredicate?: () => boolean,
		fetch?: (timeout?: number) => Promise<Message<object> | null>,
		nextHandler?: (item: any) => void,
		nextThenHandler?: (item: any) => void,
		nextErrorHandler?: (error: any) => void,
		errorHandler?: (error: any) => void,
		completeHandler?: () => void } = {} ) {

	if (purgeDatabase) {
		const records = await scan();
		for (const record in records) {
			await deleteItem('uuid', record['uuid']);
		}
		logger.warning('Database purged');
	}

	if (purgeQueue) {
		await purgeQ();
		logger.warning('Queue purged');
	}

	const observable = timer(0, config.DYNAMO_INTERVAL).pipe(
		takeWhile(() => !(stopPredicate() || process.exitCode !== undefined)),
		flatMap(fetch),
		filter((message): message is Message<object> => message !== null)
	);

	observable.subscribe(
		nextHandler ? (message) => nextHandler(message) : async (message) => {
			try {
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
