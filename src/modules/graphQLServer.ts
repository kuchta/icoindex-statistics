
import { config } from '../config';
import logger from '../logger';
import { Ticker } from '../interfaces';
import { ping } from '../elasticsearch';

export const description = 'GraphQL Server';
export const options = [{ option: '-p, --ping', description: 'Ping ElasticSearch Cluster' }];

export default function main(options: any) {
	if (options.ping) {
		ping().then(() => {
			logger.info('ElasticSearch is alive');
		}).catch((error) => {
			logger.error('Ping ElasticSearch failed', error);
		});
	}
}
