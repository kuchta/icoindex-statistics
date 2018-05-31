import { Subscription, interval, pipe } from 'rxjs';
import { flatMap, filter, takeWhile } from 'rxjs/operators';

import logger from '../logger';
import config from '../config';
import { Option } from '../interfaces';
import { receiveMessage } from '../sqs';
import { putItem } from '../dynamo';

export const description = 'Push tickers to database';
export const options: Option[] = [
	{ option: '-p, --print', description: 'Dont\'t save, just print' }
];

export default function main(options: any) {
	if (options.print) {
		storeService({ nextHandler: (item) => {
			if (options.print) {
				logger.info('Received from queue', item);
			}
		}});
	} else {
		storeService();
	}
}

export function storeService({ fetch = receiveMessage, nextHandler, nextThenHandler, nextErrorHandler, errorHandler, completeHandler, takeWhilePredicate = () => true }: {
		fetch?: () => Promise<any>,
		nextHandler?: (item: any) => void,
		nextThenHandler?: (item: any) => void,
		nextErrorHandler?: (error: any) => void,
		errorHandler?: (error: any) => void,
		completeHandler?: () => void,
		takeWhilePredicate?: (value: any) => boolean } = {} ) {

	let observable = interval(config.DYNAMO_INTERVAL).pipe(
		takeWhile(takeWhilePredicate),
		flatMap(() => fetch()),
	);

	return observable.subscribe(
		nextHandler ? (item) => nextHandler(item) : (item) => {
			putItem(item)
			.then(() => nextThenHandler ? nextThenHandler(item) : logger.info1('Succesfully sent to database', item))
			.catch((error) => nextErrorHandler ? nextErrorHandler(error) : logger.error('Sending to database failed', error));
		},
		(error) => errorHandler ? errorHandler(error) : logger.error('Error', error),
		() => completeHandler ? completeHandler() : logger.info('Completed')
	);
}
