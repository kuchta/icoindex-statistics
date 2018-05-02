import logger from '../logger';
import { Option } from '../interfaces';
import { describeTable, insertTicker, removeTicker } from '../dynamo';
import { MyError } from '../errors';

export const description = 'Ticker Management Utility';
export const options: Option[] = [
	{ option: '-D, --describe-table', description: 'describe table' },
	// { option: '-D, --delete-index', description: 'delete index' },
	{ option: '-I, --insert-ticker <pair datetime last>', description: 'insert ticker' },
	{ option: '-R, --remove-ticker <pair datetime>', description: 'remove ticker' },
	// { option: '-S, --search-tickers [pair datetime]', description: 'search tickers' },
];

export default async function main(option: {[key: string]: string}) {
	try {
		if (option.describeTable) {
			let ret = await describeTable();
			logger.info('describe table', ret);
		}
		// if (option.deleteIndex) {
		// 	await deleteIndex();
		// 	logger.info('index deleted');
		// }
		if (option.insertTicker) {
			let args = option.insertTicker.split(' ');
			if (args.length !== 3 || parseFloat(args[3]) === NaN) {
				throw new MyError('Invalud number of arguments. Expected 3 arguments in double quotes');
			}
			let ret = await insertTicker(args[0], args[1], parseFloat(args[2]));
			logger.info('ticker inserted', ret);
		}
		if (option.removeTicker) {
			let args = option.removeTicker.split(' ');
			if (args.length !== 2) {
				throw new MyError('Invalud number of arguments. Expected 2 arguments in double quotes');
			}
			logger.info(`Removing ticker: "${option.removeTicker}"`);
			let ret = await removeTicker(args[0], args[1]);
			logger.info('ticker deleted', ret);
		}
		// if (option.searchTickers) {
		// 	let results;
		// 	if (typeof option.searchTickers === 'string') {
		// 		let args = option.searchTickers.split(' ');
		// 		if (args.length !== 2) {
		// 			throw new MyError('Invalud number of arguments. Expected 2 arguments in double quotes');
		// 		}
		// 		results = await searchTickers({ pair: args[0], datetime: args[1] });
		// 	} else {
		// 		results = await searchTickers();
		// 	}
		// 	if (results) {
		// 		logger.info('Results', results.map((data) => ({
		// 			pair: data._source.pair,
		// 			datetime: data._source.datetime,
		// 			rate: data._source.rate
		// 		})));
		// 		logger.info(`Count: ${results.length}`);
		// 	} else {
		// 		logger.info('no results');
		// 	}
		// }
	} catch (error) {
		logger.error('command failed', error);
	}
}
