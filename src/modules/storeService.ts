import { Subscription, interval, pipe } from 'rxjs';
import { flatMap, filter, takeWhile } from 'rxjs/operators';
import uuidv4 from 'uuid/v4';

import logger from '../logger';
import config from '../config';
import { Option } from '../interfaces';
import { Message, receiveMessage, deleteMessage } from '../sqs';
import { putItem } from '../dynamo';

export const description = 'Push tickers to database';
export const options: Option[] = [
	{ option: '-p, --print', description: 'Dont\'t save, just print' }
];

export default function main(options: any) {
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

	let observable = interval(config.DYNAMO_INTERVAL).pipe(
		takeWhile(() => !(stopPredicate() || process.exitCode !== undefined)),
		flatMap(() => fetch(2)),
		filter(Boolean)
	);

	return observable.subscribe(
		nextHandler ? (message) => nextHandler(message) : (message) => {
			let item = { ...message.body, uuid: uuidv4() };
			putItem(item)
			.then(() => {
				deleteMessage(message.receiptHandle);
				nextThenHandler ? nextThenHandler(message.body) : logger.info1('Succesfully sent to database', item);
			})
			.catch((error) => nextErrorHandler ? nextErrorHandler(error) : logger.error('Sending to database failed', error));
		},
		(error) => errorHandler ? errorHandler(error) : logger.error('Error', error),
		() => completeHandler ? completeHandler() : logger.info('Completed')
	);
}
