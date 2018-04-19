import Rx from 'rxjs';
import ccxt from 'ccxt';

import logger from '../logger';
import { config } from '../config';
import { Options, Ticker } from '../interfaces';
import { sendTicker } from '../sqs';

const coinMarketCap = new ccxt.coinmarketcap();

export const description = 'fetch tickers from exchange';
export const options: Options = [{ option: '-p, --print', description: 'Dont\'t save, just print' }];

export default function main(options: any) {
	Rx.Observable.interval(config.EXCHANGE_INTERVAL)
	.flatMap(() => coinMarketCap.fetchTickers())
	.flatMap((data) => Object.values(data))
	// .filter((data) => data.last ? false : true)
	// .map((data) => data)
	.subscribe(
		(ticker) => {
			if (options.print) {
				logger.info1('Received from exchange', ticker);
			} else {
				sendTicker(ticker)
				.then(() => logger.info1('Sucessfully sent to queue', ticker))
				.catch((error) => logger.error('Sending to queue failed', error));
			}
		},
		(error) => logger.error('Error', error),
		() => logger.info('Completed')
	);
}
