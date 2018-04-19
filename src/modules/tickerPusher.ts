import Rx from 'rxjs';

import logger from '../logger';
import { config } from '../config';
import { Options, /* Ticker */ } from '../interfaces';
import { receiveTicker } from '../sqs';
import { putItem } from '../dynamo';

export const description = 'push tickers to database';
export const options: Options = [{ option: '-p, --print', description: 'Dont\'t save, just print' }];

export default function main(options: any) {
	// options.forEach((option: any) => logger.info(option.constructor.name));
	Rx.Observable.interval(config.DYNAMO_INTERVAL)
	.flatMap(() => receiveTicker())
	.subscribe(
		(ticker) => {
			if (options.print) {
				logger.info1('Received from queue', ticker);
			} else {
				putItem(ticker)
				.then(() => logger.info1('Succesfully sent to database', ticker))
				.catch((error) => logger.error('Sending to database failed', error));
			}
		},
		(error) => logger.error('Error', error),
		() => logger.info('Completed')
	);
}
