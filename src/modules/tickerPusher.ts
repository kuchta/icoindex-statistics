import Rx from 'rxjs';
import ccxt from 'ccxt';

import { config } from '../config';
import logger from '../logger';
import { Ticker } from '../interfaces';
import { receiveMessage } from '../sqs';
import { putItem } from '../dynamo';

export const description = 'Push tickers to database';
// export const options = [{ option: '-p, --print', description: 'Print the results' }];

export default function main(/* options: any */) {
	logger.info('Running tickerPusher');
	Rx.Observable.interval(config.AWS_DYNAMO_INTERVAL)
	.flatMap((count) => receiveMessage())
	.subscribe(
		(ticker: Ticker) => {
			logger.info1('Received from queue', ticker);
			putItem(ticker).catch((error) => {
				logger.error('Sending to database failed', error);
			});
		},
		(error) => logger.error('Error', error),
		() => logger.info('Completed')
	);
}
