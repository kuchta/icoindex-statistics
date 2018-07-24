import moment from 'moment';
import { Client } from 'elasticsearch';
import AWS from 'aws-sdk';
import { integer } from 'aws-sdk/clients/cloudfront';
import httpAWSES from 'http-aws-es';

import logger, { LeveledLogMethod } from './logger';
import config from './config';
import { MyError } from './errors';
import { Ticker } from './interfaces';
import { Transaction } from 'web3/types';

class LogToMyLogger {
	error: LeveledLogMethod;
	warning: LeveledLogMethod;
	info: LeveledLogMethod;
	debug: LeveledLogMethod;
	trace: (method: string, requestUrl: string, body: string, responseBody: string, responseStatus: integer) => void;
	close: () => void;
	constructor(/* config: ConfigOptions */) {
		this.error = logger.error.bind(logger);
		this.warning = logger.warning.bind(logger);
		this.info = logger.debug.bind(logger);
		this.debug = logger.debug.bind(logger);
		this.close = () => { /* empty */ };
		// @ts-ignore: argument is declared but its value is never read.
		this.trace = (method, requestUrl, body, responseBody, responseStatus) => {
			// logger.debug('ElasticSearch TRACE', { method, requestUrl, body, responseBody, responseStatus });
		};
	}
}

let client: Client | null = null;

function getClient(): Client {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating ElasticSearch client...`);
		AWS.config.update({
			credentials: new AWS.Credentials(config.AWS_ACCESS_ID, config.AWS_SECRET_KEY),
			region: config.AWS_REGION
		});
		client = new Client({
			apiVersion: '6.0',
			host: {
				protocol: 'https',
				host: config.AWS_ELASTIC_HOST,
				port: 443,
			},
			requestTimeout: 120000,
			connectionClass: httpAWSES,
			// sniffOnStart: true,
			log: LogToMyLogger,
			maxRetries: 10
		});
		return client;
	}
}

export function ping() {
	return getClient().ping({
		requestTimeout: 1000,
		maxRetries: 3
	});
}

export async function getTicker(pair: string, datetime: string, exchange?: string) {
	let tickers = await searchTickers({ pair, datetime, exchange });
	if (!tickers || tickers.length < 1) {
		throw new MyError('No tickers found');
	}
	return {
		uuid: tickers[0]._source.uuid,
		exchange: tickers[0]._source.exchange,
		pair: tickers[0]._source.pair,
		datetime: tickers[0]._source.datetime,
		rate: tickers[0]._source.rate
	} as Ticker;
}

export async function searchTickers({ query, pair, datetime, exchange }: { query?: any, pair?: string, datetime?: string, exchange?: string } = {}) {
	if (pair && datetime) {
		let dt;
		if (datetime.toLowerCase() === 'now') {
			dt = moment();
		} else {
			dt = moment(datetime);
		}
		if (!dt.isValid()) {
			throw new MyError(`Invalid date format supplied: "${datetime}"`);
		}
		let dateProxArray = config.MAX_DATETIME_PROXIMITY.split(' ');
		let startDateRange = dt.clone().subtract(...dateProxArray);
		let endDateRange = dt.clone().add(...dateProxArray);
		query = {
			query: {
				function_score: {
					query: {
						bool: {
							must: {
								range: { datetime: { gte: startDateRange.toISOString(), lte: endDateRange.toISOString() }}
							},
							filter: {
								term: { pair }
							}
						}
					},
					exp: {
						datetime: {
							origin: dt.toISOString(),
							scale: '1m'
						}
					}
				}
			}
		};
		if (exchange) {
			query.query.function_score.query.bool.filter = [{ term: { pair }}, { term: { exchange }}];
		}
	} else if (!query) {
		query = {
			query: {
				match_all: {}
			}
		};
	}

	try {
		let response = await getClient().search<Ticker>({
			index: config.AWS_ELASTIC_TICKER_INDEX,
			type: config.AWS_ELASTIC_TICKER_TYPE,
			body: query
		});

		if (response.hits.hits.length > 0) {
			return response.hits.hits;
		} else {
			return null;
		}
	} catch (error) {
		throw new MyError('ES search failed', { error });
	}
}

export async function getAddressAggregations(address: string, startDatetime: string, endDatetime: string, interval: string, received = true) {
	let query = {
		size: 0,
		query: {
			and: [{
				term: received ? { to: address } : { from: address }
			}, {
				range: {
					datetime: {
						gte: startDatetime,
						lte: endDatetime,
					}
				}
			}]
		},
		aggregations: {
			transactions: {
				date_histogram: {
					field: 'datetime',
					interval,
					// format: 'yyyy-MM-dd',
					min_doc_count: 0,
					extended_bounds: {
						min: startDatetime,
						max: endDatetime
					}
				},
				aggregations: {
					bucket_stats: {
						stats: {
							field: 'value'
						}
					}
				}
			}
		}
	};

	let response = await searchTransactions(query);

	return response && response.aggregations && response.aggregations.transactions && response.aggregations.transactions.buckets as { bucket_stats: { count: 0, min: null, max: null, avg: null, sum: null } }[];
}

export async function searchTransactions(query: object) {
	try {
		let response = await getClient().search<Transaction>({
			index: config.AWS_ELASTIC_TRANSACTION_INDEX,
			type: config.AWS_ELASTIC_TRANSACTION_TYPE,
			body: query,
			// timeout: '1m'
		});

		// logger.debug('response', response);

		return response;
	} catch (error) {
		throw new MyError('ES search failed', { error });
	}
}

/* just for testing */
export async function createIndex(index: string, indexType: string, properties: object) {
	try {
		return await getClient().indices.create({
			index: index,
			body: {
				mappings: {
					[indexType]: {
						properties
					}
				}
			}
		});
	} catch (error) {
		throw new MyError('ES delete failed', { error });
	}
}

/* just for testing */
export async function deleteIndex(index: string) {
	try {
		return await getClient().indices.delete({
			index: index,
		});
	} catch (error) {
		throw new MyError('ES delete failed', { error });
	}
}
