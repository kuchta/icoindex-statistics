import path from 'path';

import R from 'ramda';
import test, { Test } from 'tape';
import { GraphQLClient } from 'graphql-request';

import config from '../config';

import { Option } from '../interfaces';
import { TestData, TickerFixture, Ticker, CCXTTickers, Exchange, TickerOutputs } from '../tickers';

import { purgeQueue } from '../sqs';

import { tickerFetchService } from './tickerFetchService';
import { storeService } from './storeService';
import { queryService } from './queryService';

export const description = 'Ticker test pipeline';
export const options: Option[] = [
	{ option: '--query-service-host <host>', description: 'bind queryService to this host', defaultValue: config.QUERYSERVICE_HOST },
	{ option: '--query-service-port <port>', description: 'bind queryService to this port', defaultValue: String(config.QUERYSERVICE_PORT) },
	{ option: '-f, --filename <file>', description: 'Load test data from file <file>', defaultValue: './testData/tickers.json' },
];

const EXCHANGE_ID = 'test';
const EXCHANGE_INTERVAL = 1000;
const TICKER_TABLE = 'icoindexstaging.cointradinghistory';
const TICKER_QUEUE = 'https://sqs.eu-west-1.amazonaws.com/234333348657/icoindex-staging-queue-coin-trading';
const TICKER_TOPIC = 'arn:aws:sns:eu-west-1:234333348657:icoindex-staging-event-add-coin-trading-item';
const STORE_TOPIC = 'arn:aws:sns:eu-west-1:234333348657:icoindex-staging-event-stats-store';
const ELASTIC_HOST = 'search-icoindex-staging-gywi2nq266suyvyjfux67mhf44.eu-west-1.es.amazonaws.com';
const MAX_DATETIME_PROXIMITY = '24 hours';

export default async function main(options: { [key: string]: string }) {
	const queryServiceHost = options.queryServiceHost;
	const queryServicePort = parseInt(options.queryServicePort);

	const testData: TestData = require(path.resolve(process.cwd(), options.filename));

	const tickers = testData.fixtures.map((data) => ({ ...data, exchange: EXCHANGE_ID }));

	const queries = testData.queries.map((data) => ({
		query: { ...data.query, exchange: EXCHANGE_ID },
		result: { ...data.result, exchange: EXCHANGE_ID }
	}));

	await purgeQueue(TICKER_QUEUE);

	test('tickerFetchService', (test) => {
		test.plan(tickers.length);

		config.EXCHANGE_INTERVAL = EXCHANGE_INTERVAL;
		config.AWS_SNS_TOPIC = TICKER_TOPIC;

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
		test.plan(tickers.length);

		config.AWS_DYNAMO_TABLE = TICKER_TABLE;
		config.AWS_SQS_QUEUE_URL = TICKER_QUEUE;
		config.AWS_SNS_TOPIC = STORE_TOPIC;

		storeService({
			stopPredicate: () => allDataPassed('sentToDB', tickers),
			nextThenHandler: (ticker) => checkAndMarkData('sentToDB', test, tickers, ticker),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			completeHandler: () => test.end()
		});
	});

	test('queryService', (test) => {
		test.plan(queries.length);

		config.AWS_ELASTIC_HOST = ELASTIC_HOST;
		config.MAX_DATETIME_PROXIMITY = MAX_DATETIME_PROXIMITY;

		const server = queryService(queryServiceHost, queryServicePort, () => {
			const client = new GraphQLClient(`http://${queryServiceHost}:${queryServicePort}/graphql`);
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
				const results = data.getTokenPairRate;
				queries.forEach((query, i) => test.same(results[i], query.result, `ticker pair=${results[i].pair}, datetime=${results[i].datetime}, rate=${results[i].rate}`));
				test.end();
			}).catch((error) => {
				server.close();
				test.fail(error);
			});
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
	sentToDB: new Set(),
};

function checkAndMarkData(mark: string, test: Test, tickers: TickerFixture[], ticker: Ticker) {
	const index = tickers.findIndex((data) =>
		ticker.exchange === EXCHANGE_ID &&
		ticker.pair === data.pair &&
		ticker.datetime === data.datetime &&
		ticker.rate === data.rate
	);
	if (index >= 0) {
		test.same(R.dissoc('uuid', ticker), tickers[index], `${mark}: pair=${ticker.pair}, datetime=${ticker.datetime}, rate=${ticker.rate}`);
		checkedIndexes[mark].add(index);
	}
}

function allDataPassed(mark: string, tickers: TickerFixture[]) {
	return checkedIndexes[mark].size >= tickers.length ? true : false;
}
