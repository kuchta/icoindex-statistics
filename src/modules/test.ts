import test from 'tape';
import { from } from 'rxjs';
import ccxt from 'ccxt';
import { GraphQLClient } from 'graphql-request';

import logger from '../logger';
import config from '../config';
import { MyError } from '../errors';
import { Option, CCXTTicker, CCXTTickers, Ticker, Exchange, TickerOutput, TickerOutputs, TestQuery } from '../interfaces';

import { fetchService } from './fetchService';
import { storeService } from './storeService';
import { queryService } from './queryService';

import testFixtures from '../../testData/fixtures.json';
import testQueries from '../../testData/queries.json';

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

export default function main(options: any) {
	let host = options.host || 'localhost';
	// let host = 'localhost';
	let port = options.port || 12345;
	// let port = 12345;

	config.MAX_DATETIME_PROXIMITY = '24 hours';

	test('fetchService', (test) => {
		let fsSubcription = fetchService({ exchange: new TestExchange(),
			nextThenHandler: (ticker) => {
				checkAndMarkTestingData(ticker, 'sentToQueue');
				if (checkTestingData('sentToQueue')) {
					fsSubcription.unsubscribe();
					test.pass('All tickers sent to queue');
					test.end();
				}
			}, nextErrorHandler: (error) => {
				test.fail(error);
				test.end();
			}, errorHandler(error) {
				test.fail(error);
				test.end();
			}
		});
	});

	test('storeService', (test) => {
		let ssSubcription = storeService({
			nextThenHandler: (ticker) => {
				checkAndMarkTestingData(ticker, 'sentToDB');
				if (checkTestingData('sentToDB')) {
					ssSubcription.unsubscribe();
					test.pass('All tickers sent do DB');
					test.end();
				}
			}, nextErrorHandler: (error) => {
				test.fail(error);
				test.end();
			}, errorHandler(error) {
				test.fail(error);
				test.end();
			}
		});
	});

	test('queryService', (test) => {
		let server = queryService(host, port, () => {
			test.pass('queryService started');

			test.test('queries', (test) => {
				const client = new GraphQLClient(`http://${host}:${port}/graphql`);
				client.request<TickerOutputs>(query, { tickers: testQueries.map((data) => data.query) })
				.then((data) => {
					server.close();
					let result = data.getTokenPairRate;
					let expectedResult = testQueries.map((data) => data.result);
					for (let i = 0; i < testQueries.length; i++) {
						// compare(result[i], expectedResult[i]);
						test.deepEqual(result[i], expectedResult[i]);
					}
					test.end();
				}).catch((error) => {
					server.close();
					test.fail(error);
					test.end();
				});
			});
			test.end();
		});
	});
}

class TestExchange implements Exchange {
	id = 'test';
	async fetchTickers(): Promise<CCXTTickers> {
		return testFixtures.reduce((data, value) => {
			data[value.symbol] = value;
			return data;
		}, {});
	}
}

function checkAndMarkTestingData(ticker: Ticker, mark: string) {
	let index = testFixtures.findIndex((data) => ticker.pair === data.symbol && ticker.datetime === ticker.datetime);
	if (index < 0) {
		logger.warning('checkAndMarkTestingData: not part of testing data', { object: ticker });
	} else {
		testFixtures[index][mark] = true;
	}
}

function checkTestingData(mark: string) {
	let matches = testFixtures.filter((data) => data[mark] === true);
	if (matches.length !== testFixtures.length) {
		return false;
	}
	return true;
}
