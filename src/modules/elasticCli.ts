import logger from '../logger';
import { Option } from '../interfaces';
import { getTicker, searchTickers, createIndex, deleteIndex } from '../elastic';
import { MyError } from '../errors';

export const description = 'Ticker Management Utility';
export const options: Option[] = [
	{ option: '-C, --create-index', description: 'create index' },
	{ option: '-D, --delete-index', description: 'delete index' },
	{ option: '-S, --search-tickers [pair datetime]', description: 'search tickers' },
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
		if (option.searchTickers) {
			let results;
			if (typeof option.searchTickers === 'string') {
				let args = option.searchTickers.split(' ');
				if (args.length !== 2) {
					throw new MyError('Invalud number of arguments. Expected 2 arguments in double quotes');
				}
				results = await searchTickers({ pair: args[0], datetime: args[1] });
			} else {
				results = await searchTickers();
			}
			if (results) {
				logger.info('Results', results.map((data) => ({
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
