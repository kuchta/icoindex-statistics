import R from 'ramda';
import test, { Test } from 'tape';
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

import testData from '../../testData/tickers.json';

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
		let fsSubcription = fetchService({ exchange: createExchange(fixtures),
			nextThenHandler: (ticker) => checkAndMarkData(test, fixtures, ticker, 'sentToQueue'),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			takeWhilePredicate: () => !allDataPassed(fixtures, 'sentToQueue'),
			completeHandler: () => test.end()
		});
	});

	test('storeService', (test) => {
		test.plan(fixtures.length);
		let ssSubcription = storeService({
			nextThenHandler: (ticker) => checkAndMarkData(test, fixtures, ticker, 'sentToDB'),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			takeWhilePredicate: () => !allDataPassed(fixtures, 'sentToDB'),
			completeHandler: () => test.end()
		});
	});

	test('queryService', (test) => {
		test.plan(queries.length);
		let server = queryService(host, port, () => {
			const client = new GraphQLClient(`http://${host}:${port}/graphql`);
			client.request<TickerOutputs>(query, { tickers: R.map(R.prop('query'), queries) })
			.then((data) => {
				server.close();
				let ticker = data.getTokenPairRate;
				let expectedResult = R.map(R.prop('result'), queries);
				for (let i = 0; i < queries.length; i++) {
					test.same(ticker[i], expectedResult[i], `ticker pair=${ticker[i].pair}, datetime=${ticker[i].datetime}, rate=${ticker[i].rate}`);
				}
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
	sentToQueue: [],
	sentToDB: []
};

function checkAndMarkData(test: Test, fixtures: TickerOutput[], ticker: Ticker, mark: string) {
	let index = fixtures.findIndex((data) => ticker.pair === data.pair && ticker.datetime === ticker.datetime && ticker.rate === ticker.rate);
	if (index >= 0) {
		test.same(ticker, fixtures[index], `ticker pair=${ticker.pair}, datetime=${ticker.datetime}, rate=${ticker.rate}`);
		checkedIndexes[mark].push(index);
	}
}

function allDataPassed(fixtures: TickerOutput[], mark: string) {
	return checkedIndexes[mark].length < fixtures.length ? false : true;
}
