import R from 'ramda';
import { from } from 'rxjs';
import ccxt from 'ccxt';
import { GraphQLClient } from 'graphql-request';

import logger from '../logger';
import config from '../config';
import { MyError } from '../errors';
import { Option, CCXTTicker, CCXTTickers, Ticker, Exchange, TickerOutput, TickerOutputs } from '../interfaces';

import { fetchService } from './fetchService';
import { storeService } from './storeService';
import { queryService } from './queryService';

export const description = 'Test pipeline';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'bind to this host' },
	{ option: '-p, --port <port>', description: 'bind to this port' },
];

const query = `query MyQuery($tickers: [TickerInput]) {
	getTokenPairRate(tickers: $tickers) {
		pair
		exchange
		datetime
		rate
	}
}`;

const testData: CCXTTicker[] = [{
	symbol: 'ABC/USD',
	datetime: '2018-01-01T00:00Z',
	close: 1
}, {
	symbol: 'BCD/USD',
	datetime: '2018-01-02T00:00Z',
	close: 2
}, {
	symbol: 'CDE/USD',
	datetime: '2018-01-03T00:00Z',
	close: 3
}];

const testQueries = [{
	query: {
		"pair": "ABC/USD",
		"exchange": "test",
		"datetime": "2018-01-02T00:00Z" },
	result: {
		"pair": "ABC/USD",
		"exchange": "test",
		"datetime": [ "2018-01-01T00:00Z" ],
		"rate": 1 }
}, {
	query: {
		"pair": "ABC/USD",
		"exchange": "test",
		"datetime": "2018-01-02T00:01Z" },
	result: {
		"pair": "ABC/USD",
		"exchange": "test",
		"datetime": [ "2018-01-02T00:01Z" ],
		"rate": null }
}, {
	query: {
		"pair": "ABC/BCD",
		"exchange": "test",
		"datetime": "2018-01-01T00:01Z" },
	result: {
		"pair": "ABC/BCD",
		"exchange": "test",
		"datetime": [ "2018-01-01T00:00Z", "2018-01-02T00:00Z" ],
		"rate": 0.5 }
}, {
	query: {
		"pair": "ABC/CDE",
		"exchange": "test",
		"datetime": "2018-01-02T00:01Z" },
	result: {
		"pair": "ABC/CDE",
		"exchange": "test",
		"datetime": [ "2018-01-02T00:01Z" ],
		"rate": null }
}];

export default function main(options: any) {
	let host = options.host || 'localhost';
	let port = options.port || 12345;

	config.MAX_DATETIME_PROXIMITY = '24 hours';

	logger.info('Starting fetchService witch mock data...');
	let fsSubcription = fetchService({ exchange, eventHandler: (ticker) => {
		checkAndMarkTestingData(ticker, 'sentToQueue');
		if (checkTestingData('sentToQueue', false)) {
			fsSubcription.unsubscribe();
			logger.info('All tickers sent to queue. Starting storeService...');
			let ssSubcription = storeService({ eventHandler: (ticker) => {
				checkAndMarkTestingData(ticker, 'sentToDB');
				if (checkTestingData('sentToDB', false)) {
					ssSubcription.unsubscribe();
					logger.info('All tickers sent do DB. Waiting for tickers to propagate...');
					setTimeout(() => {
						logger.info('Starting queryService...');
						let server = queryService(host, port, () => {
							logger.info('queryService started. Searching for tickers...');
							const client = new GraphQLClient(`http://${host}:${port}/graphql`);
							client.request<TickerOutputs>(query, { tickers: testQueries.map((data) => data.query) }).then((data) => {
								let result = data.getTokenPairRate;
								let expectedResult = testQueries.map((data) => data.result);
								for (let i = 0; i < testQueries.length; i++) {
									compare(result[i], expectedResult[i]);
								}
								server.close();
							});
						});
					}, 5 * 1000);
				}
			}});
		}
	}});
}

const exchange: Exchange = {
	id: 'test',
	fetchTickers: async (): Promise<CCXTTickers> => {
		return testData.reduce((data, value) => {
			data[value.symbol] = value;
			return data;
		}, {});
	}
};

function checkAndMarkTestingData(ticker: Ticker, mark: string) {
	// console.log(`checkAndMarkTestingData: ${mark}`);
	let index = testData.findIndex((data) => ticker.pair === data.symbol && ticker.datetime === ticker.datetime);
	if (index < 0) {
		logger.warning('checkAndMarkTestingData: not part of testing data', { object: ticker });
	} else {
		testData[index][mark] = true;
	}
}

function checkTestingData(mark: string, canThrow = true) {
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

function compare(result: TickerOutput, expectedResult: TickerOutput) {
	if (R.equals(result, expectedResult)) {
		logger.info('OK: Result match expected result', result);
	} else {
		logger.error("Fail: Result doesn't match expected result", { result, expectedResult });
	}
}
