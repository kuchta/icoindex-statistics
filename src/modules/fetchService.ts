import { Subscription, Observable, interval, pipe } from 'rxjs';
import { map, flatMap, filter } from 'rxjs/operators';
import ccxt from 'ccxt';

import logger from '../logger';
import config from '../config';
import { Option, Ticker } from '../interfaces';
import { sendTicker } from '../sqs';
import { VersionIdMarker } from 'aws-sdk/clients/s3';

const coinMarketCap = new ccxt.coinmarketcap();

export const description = 'Fetch tickers from exchange';
export const options: Option[] = [
	{ option: '-p, --print [pair]', description: 'Dont\'t save, just print' }
];

export default function main(options: any) {
	let observable = interval(config.EXCHANGE_INTERVAL).pipe(
		flatMap(() => coinMarketCap.fetchTickers()),
		flatMap((data) => Object.values(data)),
		filter((ticker) => ticker.close !== undefined),
		map((ticker) => ({ pair: ticker.symbol, datetime: ticker.datetime, rate: ticker.close } as Ticker))
	);
	if (options.print) {
		fetchService(observable, { subscribe: (ticker) => {
			if (!(typeof options.print === 'string' && ticker.pair !== options.print)) {
				// Object.keys(ticker).forEach(key => ticker[key] === undefined && delete ticker[key]);
				logger.info('Received from exchange', ticker);
			}
		}});
	} else {
		fetchService(observable);
	}
}

export function fetchService(observable: Observable<Ticker>, { subscribe, eventHandler, errorHandler, doneHandler }: {
	subscribe?: (ticker: Ticker) => void,
	eventHandler?: (ticker: Ticker) => void,
	errorHandler?: (error: any) => void,
	doneHandler?: () => void } = {}) {

	return observable.subscribe(
		subscribe ? (ticker) => subscribe(ticker) : (ticker) => {
			sendTicker(ticker)
			.then(() => eventHandler ? eventHandler(ticker) : () => logger.info1('Sucessfully sent to queue', ticker))
			.catch((error) => errorHandler ? errorHandler(error) : logger.error('Sending to queue failed', error));
		},
		(error) => errorHandler ? errorHandler(error) : logger.error('Error', error),
		doneHandler ? doneHandler : undefined
	);
}
