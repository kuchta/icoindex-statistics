import Rx from 'rxjs';
import ccxt from 'ccxt';

import { config } from '../config';
import logger from '../logger';
import { sendToQueue, Ticker } from '../sqs';

const coinMarketCap = new ccxt.coinmarketcap();

export const description = 'Fetch tickers from exchange';
export const options = [{ option: '-p, --print', description: 'Just print the resuls' }];

export default function main(options: any) {
	logger.info('Running tickerFetcher');
	Rx.Observable.interval(config.EXCHANGE_INTERVAL)
	.flatMap((count) => coinMarketCap.fetchTickers())
	.flatMap((data) => Object.values(data))
	.map((data: ccxt.Ticker) => ({ symbol: data.symbol, datetime: data.datetime, last: data.last }))
	.subscribe(
		(data: Ticker) => {
			if (options.print) {
				logger.info('result', data);
			} else {
				sendToQueue(data).catch((error) => {
					logger.error('Sending to queue failed', error);
				});
			}
		},
		(error) => logger.error('Error', error),
		() => logger.info('Completed')
	);
}
