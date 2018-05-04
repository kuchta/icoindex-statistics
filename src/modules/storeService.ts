import { Subscription, interval, pipe } from 'rxjs';
import { flatMap, filter } from 'rxjs/operators';

import logger from '../logger';
import config from '../config';
import { Option, Ticker } from '../interfaces';
import { receiveTicker } from '../sqs';
import { insertTicker } from '../dynamo';

export const description = 'Push tickers to database';
export const options: Option[] = [
	{ option: '-p, --print [pair]', description: 'Dont\'t save, just print' }
];

export default function main(options: any) {
	if (options.print) {
		storeService({ subscribe: (ticker) => {
			if (!(typeof options.print === 'string' && ticker.pair !== options.print)) {
				// Object.keys(ticker).forEach(key => ticker[key] === undefined && delete ticker[key]);
				logger.info('Received from queue', ticker);
			}
		}});
	} else {
		storeService();
	}
}

export function storeService({ fetch = receiveTicker, subscribe, eventHandler, errorHandler, doneHandler }: {
		fetch?: () => Promise<Ticker>,
		subscribe?: (ticker: Ticker) => void,
		eventHandler?: (ticker: Ticker) => void,
		errorHandler?: (error: any) => void,
		doneHandler?: () => void } = {}) {

	return interval(config.DYNAMO_INTERVAL).pipe(
		flatMap(() => fetch()),
		filter((ticker) => ticker.rate !== undefined),
	).subscribe(
		subscribe ? (ticker) => subscribe(ticker) : (ticker) => {
			insertTicker(ticker.exchange, ticker.pair, ticker.datetime, ticker.rate)
			.then(() => eventHandler ? eventHandler(ticker) : () => logger.info1('Succesfully sent to database', ticker))
			.catch((error) => errorHandler ? errorHandler(error) : logger.error('Sending to database failed', error));
		},
		(error) => errorHandler ? errorHandler(error) : logger.error('Error', error),
		() => doneHandler ? doneHandler() : logger.info('Completed')
	);
}
