import Rx from 'rxjs';

import logger from '../logger';
import config from '../config';
import { Option } from '../interfaces';
import { receiveTicker } from '../sqs';
import { putItem } from '../dynamo';

export const description = 'Push tickers to database';
export const options: Option[] = [{ option: '-p, --print', description: 'Dont\'t save, just print' }];

export default function main(options: any) {
	Rx.Observable.interval(config.DYNAMO_INTERVAL)
	.flatMap(() => receiveTicker())
	.subscribe(
		(ticker) => {
			if (options.print) {
				logger.info('Received from queue', ticker);
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
