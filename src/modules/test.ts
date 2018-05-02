import { from } from 'rxjs';
import { GraphQLClient } from 'graphql-request';

import logger from '../logger';
import config from '../config';
import { MyError } from '../errors';
import { Option, Ticker, TickerInput } from '../interfaces';

import { fetchService } from './fetchService';
import { storeService } from './storeService';
import { queryService } from './queryService';

export const description = 'Test pipeline';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'bind to this host' },
	{ option: '-p, --port <port>', description: 'bind to this port' },
];

let testData: Ticker[] = [{
	pair: 'ABC/USD',
	datetime: '2018-01-01T00:00Z',
	rate: 1
}, {
	pair: 'BCD/USD',
	datetime: '2018-01-02T00:00Z',
	rate: 2
}, {
	pair: 'CDE/USD',
	datetime: '2018-01-03T00:00Z',
	rate: 3
}];

const query = `query MyQuery($tickers: [TickerInput]) {
	getTokenPairRate(tickers: $tickers) {
		pair
		datetime
		rate
	}
}`;

export default function main(options: any) {
	let host = options.host || 'localhost';
	let port = options.port || 12345;

	config.MAX_DATETIME_PROXIMITY = '24 hours';

	logger.info('Starting fetchService witch mock data...');
	fetchService(from(testData), { eventHandler: (ticker) => {
		checkAndMarkTestingData(testData, ticker, 'sentToQueue');
		if (checkTestingData(testData, 'sentToQueue', false)) {
			logger.info('All tickers sent to queue. Starting storeService...');
			let ssSubcription = storeService({ eventHandler: (ticker) => {
				checkAndMarkTestingData(testData, ticker, 'sentToDB');
				if (checkTestingData(testData, 'sentToDB', false)) {
					ssSubcription.unsubscribe();
					logger.info('All tickers sent do DB. Waiting for tickers to propagate...');
					setTimeout(() => {
						logger.info('Starting queryService...');
						let server = queryService(host, port, () => {
							logger.info('queryService started. Searching for tickers...');
							const client = new GraphQLClient(`http://${host}:${port}/graphql`);
							client.request(query, {
								tickers: [{
									pair: 'ABC/BCD',
									datetime: '2018-01-01T00:00Z'
								}, {
									pair: 'ABC/CDE',
									datetime: '2018-01-01T00:00Z'
								// }, {
								// 	pair: 'BCD/DEF',
								// 	datetime: '2018-01-02T00:00Z'
								}]
							}).then((data) => {
								logger.info('Result', data);
								server.close();
							});
						});
					}, 10 * 1000);
				}
			}});
		}
	}});
}

function checkAndMarkTestingData(testData: Ticker[], ticker: Ticker, mark: string) {
	// console.log(`checkAndMarkTestingData: ${mark}`);
	let index = testData.findIndex((data) => ticker.pair === data.pair && ticker.datetime === ticker.datetime);
	if (index < 0) {
		logger.warning('not part of testing data', { object: ticker });
	} else {
		testData[index][mark] = true;
	}
}

function checkTestingData(testData: Ticker[], mark: string, canThrow = true) {
	// console.log(`checkTestingData: ${mark}`);
	let matches = testData.filter((data) => data[mark] === true);
	if (matches.length !== testData.length) {
		if (canThrow) {
			throw new MyError('not all data processed', { object: matches });
		}
		return false;
	}
	return true;
}
