import { Subscription, Observable, interval, pipe } from 'rxjs';
import { map, flatMap, filter, takeWhile } from 'rxjs/operators';
import { coinmarketcap } from 'ccxt';

import logger from '../logger';
import config from '../config';
import { Option, Exchange, CCXTTickers, Ticker } from '../interfaces';
import { sendTicker } from '../sqs';

export const description = 'Fetch tickers from exchange';
export const options: Option[] = [
	{ option: '-p, --print [pair]', description: 'Dont\'t save, just print' }
];

export default function main(options: any) {
	logger.info1('ahojda');
	if (options.print) {
		fetchService({ nextHandler: (ticker) => {
			if (!(typeof options.print === 'string' && ticker.pair !== options.print)) {
				// Object.keys(ticker).forEach(key => ticker[key] === undefined && delete ticker[key]);
				logger.info('Received from exchange', ticker);
			}
		}});
	} else {
		fetchService();
	}
}

export function fetchService({ exchange = new coinmarketcap({ timeout: config.EXCHANGE_TIMEOUT }), nextHandler, nextThenHandler, nextErrorHandler, errorHandler, completeHandler, takeWhilePredicate = () => true }: {
		exchange?: Exchange,
		nextHandler?: (ticker: Ticker) => void,
		nextThenHandler?: (ticker: Ticker) => void,
		nextErrorHandler?: (error: any) => void,
		errorHandler?: (error: any) => void,
		completeHandler?: () => void,
		takeWhilePredicate?: (value: any) => boolean } = {} ) {

	let observable = interval(config.EXCHANGE_INTERVAL).pipe(
		takeWhile(takeWhilePredicate),
		flatMap(() => exchange.fetchTickers() as Promise<CCXTTickers>),
		flatMap((data) => Object.values(data)),
		filter((ticker) => ticker && ticker.close !== undefined),
		map((ticker) => ({ exchange: exchange.id, pair: ticker.symbol, datetime: ticker.datetime, rate: ticker.close } as Ticker))
	);

	return observable.subscribe(
		nextHandler ? (ticker) => nextHandler(ticker) : (ticker) => {
			sendTicker(ticker)
			.then(() => nextThenHandler ? nextThenHandler(ticker) : logger.info1('Sucessfully sent to queue', ticker))
			.catch((error) => nextErrorHandler ? nextErrorHandler(error) : logger.error('Sending to queue failed', error));
		},
		(error) => errorHandler ? errorHandler(error) : logger.error('Error', error),
		() => completeHandler ? completeHandler() : logger.info('Completed')
	);
}
