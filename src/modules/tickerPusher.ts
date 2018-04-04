import Rx from 'rxjs';
import ccxt from 'ccxt';

import { config } from '../config';
import logger from '../logger';
import { receiveFromQueue, Ticker } from '../sqs';

export const description = 'Push tickers to database';
export const options = [{ option: '-p, --print', description: 'Just print the resuls' }];

export default function main(options: any) {
	logger.info('Running tickerPusher');
	Rx.Observable.interval(config.AWS_DYNAMO_INTERVAL)
	.flatMap((count) => receiveFromQueue())
	.subscribe(
		(data: Ticker) => {
			logger.info('result', data);
			// if (options.print) {
			// 	logger.info('result', data);
			// } else {
			// 	logger.error('Not Implemented yet');
			// }
		},
		(error) => logger.error('Error', error),
		() => logger.info('Completed')
	);
}
