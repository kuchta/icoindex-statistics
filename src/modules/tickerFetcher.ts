import Rx from 'rxjs';
import ccxt from 'ccxt';

import logger from '../logger';
import config from '../config';
import { Option, Ticker } from '../interfaces';
import { sendTicker } from '../sqs';

const coinMarketCap = new ccxt.coinmarketcap();

export const description = 'Fetch tickers from exchange';
export const options: Option[] = [
	{ option: '-p, --print [pair]', description: 'Dont\'t save, just print' }
];

export default function main(options: any) {
	Rx.Observable.interval(config.EXCHANGE_INTERVAL)
	.flatMap(() => coinMarketCap.fetchTickers())
	.flatMap((data) => Object.values(data))
	// .filter((data) => data.last ? false : true)
	.map((ticker) => ({ pair: ticker.symbol, datetime: ticker.datetime, rate: ticker.close } as Ticker))
	// .map((ticker) => ({ ...ticker, pair: ticker.symbol, datetime: ticker.datetime, rate: ticker.close } as Ticker))
	.subscribe(
		(ticker) => {
			if ((typeof options.print === 'string' && ticker.pair === options.print) || (typeof options.print === 'boolean' && options.print) {
				Object.keys(ticker).forEach(key => ticker[key] === undefined && delete ticker[key]);
				logger.info('Received from exchange', ticker);
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
