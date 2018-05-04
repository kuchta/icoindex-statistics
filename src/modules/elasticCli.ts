import logger from '../logger';
import { Option } from '../interfaces';
import { createIndex, deleteIndex, searchTickers, removeTicker } from '../elastic';
import { MyError } from '../errors';

export const description = 'Ticker Management Utility';
export const options: Option[] = [
	{ option: '-C, --create-index', description: 'create index' },
	{ option: '-D, --delete-index', description: 'delete index' },
	{ option: '-R, --remove-ticker <id>', description: 'remove ticker' },
	{ option: '-S, --search-tickers [pair datetime [exchange]]', description: 'search tickers' },
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
					id: data._id,
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
