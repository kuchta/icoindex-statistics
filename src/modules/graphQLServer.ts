
import logger from '../logger';
import { Options, Ticker } from '../interfaces';
import { ping } from '../elasticsearch';

export const description = 'GraphQL Server';
export const options: Options = [{ option: '-p, --ping', description: 'ping ElasticSearch Cluster' }];

export default function main(options: any) {
	if (options.ping) {
		ping().then(() => {
			logger.info('ElasticSearch is alive');
		}).catch((error) => {
			logger.error('Ping ElasticSearch failed', error);
		});
	} else {
		logger.error('No options specified');
	}
}
