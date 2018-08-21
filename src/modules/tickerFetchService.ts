import { v4 } from 'uuid';
import { timer } from 'rxjs';
import { map, flatMap, filter, takeWhile } from 'rxjs/operators';
import { coinmarketcap } from 'ccxt';

import logger from '../logger';
import config from '../config';

import { Option } from '../interfaces';
import { Exchange, CCXTTickers, Ticker } from '../tickers';

import { sendMessage } from '../sns';

export const description = 'Fetch tickers from exchange';
export const options: Option[] = [
	{ option: '-p, --print [pair]', description: 'Dont\'t save, just print' }
];

export default function main(options: { [key: string]: string }) {
	if (options.print) {
		tickerFetchService({ nextHandler: (ticker) => {
			if (!(typeof options.print === 'string' && ticker.pair !== options.print)) {
				// Object.keys(ticker).forEach(key => ticker[key] === undefined && delete ticker[key]);
				logger.info('Received from exchange', ticker);
			}
		}});
	} else {
		tickerFetchService();
	}
}

export function tickerFetchService({ exchange = new coinmarketcap({  timeout: config.EXCHANGE_TIMEOUT /* , urls: { api: 'https://api.example.com/data' } */ }), stopPredicate = () => false, nextHandler, nextThenHandler, nextErrorHandler, errorHandler, completeHandler }: {
		exchange?: Exchange,
		stopPredicate?: () => boolean,
		nextHandler?: (ticker: Ticker) => void,
		nextThenHandler?: (ticker: Ticker) => void,
		nextErrorHandler?: (error: any) => void,
		errorHandler?: (error: any) => void,
		completeHandler?: () => void } = {} ) {

	const observable = timer(0, config.EXCHANGE_INTERVAL).pipe(
		takeWhile(() => !(stopPredicate() || process.exitCode !== undefined)),
		flatMap(() => exchange.fetchTickers() as Promise<CCXTTickers>),
		flatMap((data) => Object.values(data)),
		filter((ticker) => ticker && ticker.close !== undefined),
		map((ticker) => ({ exchange: exchange.id, pair: ticker.symbol, datetime: ticker.datetime, rate: ticker.close } as Ticker))
	);

	observable.subscribe(
		nextHandler ? (ticker) => nextHandler(ticker) : (ticker) => {
			sendMessage({ uuid: v4(), exchange: ticker.exchange, pair: ticker.pair, datetime: ticker.datetime, rate: ticker.rate })
			.then(() => nextThenHandler ? nextThenHandler(ticker) : logger.info1('Sucessfully sent to SNS', ticker))
			.catch((error) => nextErrorHandler ? nextErrorHandler(error) : logger.error('Sending to SNS failed', error));
		},
		(error) => errorHandler ? errorHandler(error) : logger.error('Error', error),
		() => completeHandler ? completeHandler() : logger.info('Completed')
	);
}
