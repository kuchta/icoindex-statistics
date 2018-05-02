import logger from '../logger';
import { Option } from '../interfaces';
import { getTicker, searchTickers, createIndex, deleteIndex } from '../elasticsearch';
import { insertTicker, removeTicker } from '../dynamo';
import { MyError } from '../errors';

export const description = 'Ticker Management Utility';
export const options: Option[] = [
	{ option: '-C, --create-index', description: 'create index' },
	{ option: '-D, --delete-index', description: 'delete index' },
	{ option: '-I, --insert-ticker <pair datetime last>', description: 'insert ticker' },
	{ option: '-R, --remove-ticker <id>', description: 'remove ticker' },
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
		if (option.insertTicker) {
			let args = option.insertTicker.split(' ');
			if (args.length !== 3 || parseFloat(args[3]) === NaN) {
				throw new MyError('Invalud number of arguments. Expected 3 arguments in double quotes');
			}
			let ret = await insertTicker(args[0], args[1], parseFloat(args[2]));
			logger.info('ticker inserted', ret);
		}
		if (option.removeTicker) {
			if (typeof option.removeTicker !== 'string') {
				throw new MyError('Invalud number of arguments. Expected 1 arguments');
			}
			let ret = await removeTicker(option.removeTicker);
			logger.info('ticker deleted', ret);
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
				logger.info('Results', results);
				logger.info(`Count: ${results.length}`);
			} else {
				logger.info('no results');
			}
		}
	} catch (error) {
		logger.error('command failed', error);
	}
}
