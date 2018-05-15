import logger from '../logger';
import { Option } from '../interfaces';
import { purgeQueue } from '../sqs';
import { insertTicker, removeTicker } from '../dynamo';
import { createIndex, deleteIndex, searchTickers } from '../elastic';
import { MyError } from '../errors';

export const description = 'Ticker Management Utility';
export const options: Option[] = [
	{ option: '-C, --create-index', description: 'create elastic index' },
	{ option: '-D, --delete-index', description: 'delete elastic index' },
	{ option: '-P, --purge-queue', description: 'purge SQS queue' },
	{ option: '-I, --insert-ticker <pair datetime last>', description: 'insert ticker into dynamo' },
	{ option: '-R, --remove-ticker <id>', description: 'remove ticker from dynamo' },
	{ option: '-S, --search-tickers [pair datetime [exchange]]', description: 'search tickers in elastic' },
];

export default async function main(option: {[key: string]: string}) {
	try {
		if (option.createIndex) {
			await createIndex();
			logger.info('index create');
		}
		if (option.deleteIndex) {
			await deleteIndex();
			logger.info('index deleted');
		}
		if (option.purgeQueue) {
			await purgeQueue();
			logger.info('queue purged');
		}
		if (option.insertTicker) {
			let args = option.insertTicker.split(' ');
			if (args.length !== 3 || parseFloat(args[3]) === NaN) {
				throw new MyError('Invalud number of arguments. Expected 3 arguments in double quotes');
			}
			let ret = await insertTicker('coinmarketcap', args[0], args[1], parseFloat(args[2]));
			logger.info('ticker inserted', ret);
		}
		if (option.removeTicker) {
			logger.info(`Removing ticker: "${option.removeTicker}"`);
			let ret = await removeTicker(option.removeTicker);
			logger.info('ticker deleted', ret);
		}
		if (option.searchTickers) {
			let results;
			if (typeof option.searchTickers === 'string') {
				let args = option.searchTickers.split(' ');
				if (args.length < 2 || args.length > 3) {
					throw new MyError('Invalud number of arguments. Expected 2 or 3 arguments in double quotes');
				}
				let query = { pair: args[0], datetime: args[1] };
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
				logger.info('no results');
			}
		}
	} catch (error) {
		logger.error('command failed', error);
	}
}
