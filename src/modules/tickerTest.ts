import util from 'util';
import path from 'path';

import R from 'ramda';
import test, { Test } from 'tape';
import { GraphQLClient } from 'graphql-request';

import { Option } from '../interfaces';
import { TestData, TickerFixture, Ticker, CCXTTickers, Exchange, TickerOutputs } from '../tickers';

import config from '../config';
import logger from '../logger';
import { sleep } from '../utils';
import { purgeQueue } from '../sqs';
import { tickerFetchService } from './tickerFetchService';
import { storeService } from './storeService';
import { queryService } from './queryService';

export const description = 'Ticker Test Pipeline';
export const options: Option[] = [
	{ option: '--query-service-host <host>', description: 'bind queryService to this host', defaultValue: config.QUERYSERVICE_HOST },
	{ option: '--query-service-port <port>', description: 'bind queryService to this port', defaultValue: '9000' },
	{ option: '-f, --filename <file>', description: 'Load test data from file <file>' },
];

const EXCHANGE_ID = 'test';
const EXCHANGE_INTERVAL = 1000;
const MAX_DATETIME_PROXIMITY = '24 hours';

export default async function main(options: { [key: string]: string }) {
	const queryServiceHost = options.queryServiceHost;
	const queryServicePort = parseInt(options.queryServicePort);

	let testData: TestData;
	if (options.filename) {
		testData = require(path.resolve(process.cwd(), options.filename));
	} else {
		testData = require(path.resolve(path.dirname(path.dirname(__dirname)), path.join('testData', 'tickers.json')));
	}

	const tickers = testData.fixtures.map((data) => ({ ...data, exchange: EXCHANGE_ID }));

	const queries = testData.queries.map((data) => ({
		query: { ...data.query, exchange: EXCHANGE_ID },
		result: { ...data.result, exchange: EXCHANGE_ID }
	}));

	logger.warning('Purging ticker queue');
	await purgeQueue(config.AWS_SQS_TICKER_URL);

	test('tickerFetchService', async (test) => {
		test.timeoutAfter(60000);

		config.AWS_SNS_TOPIC = config.AWS_SNS_TICKER_TOPIC;
		config.EXCHANGE_INTERVAL = EXCHANGE_INTERVAL;

		tickerFetchService({
			exchange: createExchange(tickers),
			stopPredicate: () => allDataPassed('sentToQueue', tickers),
			nextThenHandler: (ticker) => checkAndMarkData('sentToQueue', test, tickers, ticker),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			completeHandler: () => test.end()
		});
	});

	test('storeService', (test) => {
		test.timeoutAfter(60000);

		config.AWS_SNS_TOPIC = config.AWS_SNS_STORE_TOPIC;
		config.AWS_SQS_URL = config.AWS_SQS_TICKER_URL;
		config.AWS_DYNAMO_TABLE = config.AWS_DYNAMO_TICKER_TABLE;

		storeService({
			stopPredicate: () => allDataPassed('storedToDB', tickers),
			nextThenHandler: (ticker) => checkAndMarkData('storedToDB', test, tickers, ticker),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			completeHandler: () => test.end()
		});
	});

	test('queryService', async (test) => {
		test.plan(queries.length);

		logger.info('Waiting for tickers to propagate to elastic');
		await sleep(5000);

		config.MAX_DATETIME_PROXIMITY = MAX_DATETIME_PROXIMITY;

		const server = queryService(queryServiceHost, queryServicePort, async () => {
			try {
				const client = new GraphQLClient(`http://${queryServiceHost}:${queryServicePort}/graphql`);
				const result = await client.request<TickerOutputs>(`query MyQuery($tickers: [TickerInput]) {
					getTokenPairRate(tickers: $tickers) {
						pair
						exchange
						datetime
						rate
					}
				}`, { tickers: R.map(R.prop('query'), queries) });
				const results = result.getTokenPairRate;
				queries.forEach((query, i) => test.same(results[i], query.result, `ticker pair=${results[i].pair}, datetime=${results[i].datetime}, rate=${results[i].rate}`));
				server.close();
				test.end();
			} catch (error) {
				server.close();
				test.fail(error);
				test.end();
			}
		});
	});
}

function createExchange(fixtures: TickerFixture[]) {
	class TestExchange implements Exchange {
		id = EXCHANGE_ID;
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

const checkedIndexes = {
	sentToQueue: new Set(),
	storedToDB: new Set(),
};

function checkAndMarkData(mark: string, test: Test, tickers: TickerFixture[], ticker: Ticker) {
	const index = tickers.findIndex((data) =>
		ticker.exchange === EXCHANGE_ID &&
		ticker.pair === data.pair &&
		ticker.datetime === data.datetime &&
		ticker.rate === data.rate
	);
	if (index >= 0) {
		if (checkedIndexes[mark].has(index)) {
			test.fail(`${mark}: Duplicate ticker received: uuid=${ticker.uuid}, pair=${ticker.pair}, datetime=${ticker.datetime}, rate=${ticker.rate}`);
		} else {
			checkedIndexes[mark].add(index);
			test.same(R.dissoc('uuid', ticker), tickers[index], `${mark}: uuid=${ticker.uuid}, pair=${ticker.pair}, datetime=${ticker.datetime}, rate=${ticker.rate}`);
		}
	} else {
		test.fail(`${mark}: Unknown ticker: ${util.inspect(ticker, { colors: true, depth: 10 })}`);
	}
}

function allDataPassed(mark: string, tickers: TickerFixture[]) {
	return checkedIndexes[mark].size >= tickers.length;
}
