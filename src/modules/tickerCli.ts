import { Option } from '../interfaces';
import { MyError } from '../errors';

import config from '../config';
import logger from '../logger';
import { sendMessage } from '../sns';
import { purgeQueue } from '../sqs';
import { deleteItem } from '../dynamo';
import { createIndex, deleteIndex, searchTickers } from '../elastic';

export const description = 'Ticker Management Utility';
export const options: Option[] = [
	{ option: '-I, --insert-ticker <pair datetime last>', description: 'Send ticker to SNS' },
	{ option: '-R, --remove-ticker <id>', description: 'Remove ticker from Dynamo' },
	{ option: '-S, --search-tickers [pair datetime [exchange]]', description: 'Search tickers in Elastic' },
	{ option: '-P, --purge-queue', description: 'Purge ticker queue' },
	{ option: '-C, --create-index', description: 'Create elastic index' },
	{ option: '-D, --delete-index', description: 'Delete elastic index' },
];

export default async function main(options: { [key: string]: string }) {
	try {
		if (options.insertTicker) {
			const args = options.insertTicker.split(' ');
			if (args.length !== 3 || parseFloat(args[3]) === NaN) {
				throw new MyError('Invalud number of arguments. Expected 3 arguments in double quotes');
			}
			const ret = await sendMessage({ exchange: 'coinmarketcap', pair: args[0], datetime: args[1], rate: parseFloat(args[2]) });
			logger.info('Ticker inserted', ret);
		}
		if (options.removeTicker) {
			logger.info(`Removing ticker: "${options.removeTicker}"`);
			const ret = await deleteItem('uuid', options.removeTicker);
			logger.info('Ticker deleted', ret);
		}
		if (options.searchTickers) {
			let results;
			if (typeof options.searchTickers === 'string') {
				const args = options.searchTickers.split(' ');
				if (args.length < 2 || args.length > 3) {
					throw new MyError('Invalud number of arguments. Expected 2 or 3 arguments in double quotes');
				}
				const query = { pair: args[0], datetime: args[1] };
				if (args.length === 3) {
					query['exchange'] = args[2];
				}
				results = await searchTickers(query);
			} else {
				results = await searchTickers();
			}
			if (results) {
				logger.info('Results', results.map((data) => ({
					id: data._source.uuid,
					exchange: data._source.exchange,
					pair: data._source.pair,
					datetime: data._source.datetime,
					rate: data._source.rate
				})));
				logger.info(`Count: ${results.length}`);
			} else {
				logger.info('No results');
			}
		}
		if (options.purgeQueue) {
			await purgeQueue();
			logger.info('Queue purged');
		}
		if (options.createIndex) {
			await createIndex(config.AWS_ELASTIC_TICKER_INDEX, config.AWS_ELASTIC_TICKER_TYPE, {
				uuid: {
					type: 'string',
					index: 'not_analyzed'
				},
				exchange: {
					type: 'string',
					index: 'not_analyzed'
				},
				datetime: {
					type: 'date',
					format: 'strict_date_optional_time'
				},
				pair: {
					type: 'string',
					index: 'not_analyzed'
				},
				rate: {
					type: 'double'
				}
			});
			logger.info('Index created');
		}
		if (options.deleteIndex) {
			await deleteIndex(config.AWS_ELASTIC_TICKER_INDEX);
			logger.info('Index deleted');
		}
	} catch (error) {
		logger.error('Command failed', error);
	}
}
