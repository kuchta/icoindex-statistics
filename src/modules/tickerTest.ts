import R from 'ramda';
import test, { Test } from 'tape';
import { GraphQLClient } from 'graphql-request';

import config from '../config';
import { Option, CCXTTickers, Ticker, Exchange, TickerOutput, TickerOutputs } from '../interfaces';

import { fetchService } from './tickerFetchService';
import { storeService } from './storeService';
import { queryService } from './queryService';

import testData from '../../testData/tickers.json';

export const description = 'Test pipeline';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'bind GraphQL service to this host' },
	{ option: '-p, --port <port>', description: 'bind GraphQL service to this port' },
];

export default function main(options: {[key: string]: string}) {
	let host = options.host || 'localhost';
	// let host = 'localhost';
	let port = parseInt(options.port) || 12345;
	// let port = 12345;

	config.EXCHANGE_INTERVAL = 1000;
	config.DYNAMO_INTERVAL = 1000;
	config.MAX_DATETIME_PROXIMITY = '24 hours';

	let fixtures = testData.fixtures.map((data) => ({ ...data, exchange: 'test' }));

	let queries = testData.queries.map((data) => ({
		query: { ...data.query, exchange: 'test' },
		result: { ...data.result, exchange: 'test' }
	}));

	test('fetchService', (test) => {
		test.plan(fixtures.length);
		fetchService({
			exchange: createExchange(fixtures),
			stopPredicate: () => allDataPassed(fixtures, 'sentToQueue'),
			nextThenHandler: (ticker) => checkAndMarkData(test, fixtures, ticker, 'sentToQueue'),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			completeHandler: () => test.end()
		});
	});

	test('storeService', (test) => {
		test.plan(fixtures.length);
		storeService({
			stopPredicate: () => allDataPassed(fixtures, 'sentToDB'),
			nextThenHandler: (ticker) => checkAndMarkData(test, fixtures, ticker, 'sentToDB'),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			completeHandler: () => test.end()
		});
	});

	test('queryService', (test) => {
		test.plan(queries.length);
		let server = queryService(host, port, () => {
			const client = new GraphQLClient(`http://${host}:${port}/graphql`);
			client.request<TickerOutputs>(`query MyQuery($tickers: [TickerInput]) {
				getTokenPairRate(tickers: $tickers) {
					pair
					exchange
					datetime
					rate
				}
			}`, { tickers: R.map(R.prop('query'), queries) })
			.then((data) => {
				server.close();
				let ticker = data.getTokenPairRate;
				// let expectedResult = R.map(R.prop('result'), queries);
				queries.forEach((query, i) => test.same(ticker[i], query.result, `ticker pair=${ticker[i].pair}, datetime=${ticker[i].datetime}, rate=${ticker[i].rate}`));
				// for (let i = 0; i < queries.length; i++) {
				// 	test.same(ticker[i], expectedResult[i], `ticker pair=${ticker[i].pair}, datetime=${ticker[i].datetime}, rate=${ticker[i].rate}`);
				// }
				test.end();
			}).catch((error) => {
				server.close();
				test.fail(error);
			});
		});
	});
}

function createExchange(fixtures: TickerOutput[]) {
	class TestExchange implements Exchange {
		id = 'test';
		async fetchTickers(): Promise<CCXTTickers> {
			return fixtures.reduce((acc, ticker) => {
				acc[ticker.pair] = {
					symbol: ticker.pair,
					datetime: ticker.datetime,
					close: ticker.rate
				};
				return acc;
			}, {});
		}
	}
	return new TestExchange();
}

let checkedIndexes = {
	sentToQueue: new Set(),
	sentToDB: new Set(),
};

function checkAndMarkData(test: Test, fixtures: TickerOutput[], ticker: Ticker, mark: string) {
	let index = fixtures.findIndex((data) => ticker.exchange === 'test' && ticker.pair === data.pair && ticker.datetime === ticker.datetime && ticker.rate === ticker.rate);
	if (index >= 0) {
		test.same(ticker, fixtures[index], `ticker pair=${ticker.pair}, datetime=${ticker.datetime}, rate=${ticker.rate}`);
		checkedIndexes[mark].add(index);
	}
}

function allDataPassed(fixtures: TickerOutput[], mark: string) {
	return checkedIndexes[mark].size >= fixtures.length ? true : false;
}
