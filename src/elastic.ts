import moment from 'moment';
import { Client, ConfigOptions, Explanation, SearchResponse, DeleteDocumentResponse } from 'elasticsearch';
import AWS from 'aws-sdk';
import { integer } from 'aws-sdk/clients/cloudfront';
import httpAWSES from 'http-aws-es';

import logger, { MyLogger, LeveledLogMethod } from './logger';
import config from './config';
import { MyError } from './errors';
import { Ticker, TickerOutput } from './interfaces';
import { DescribeTrustedAdvisorCheckRefreshStatusesRequest } from 'aws-sdk/clients/support';

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
			connectionClass: httpAWSES,
			// sniffOnStart: true,
			// amazonES: {
			//   region: config.AWS_REGION,
			//   accessKey: config.AWS_ACCESS_ID,
			//   secretKey: config.AWS_SECRET_KEY,
			// },
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
			index: config.AWS_ELASTIC_INDEX,
			type: config.AWS_ELASTIC_TYPE,
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

/* just for testing */
export async function createIndex() {
	try {
		return await getClient().indices.create({
			index: config.AWS_ELASTIC_INDEX,
			body: {
				mappings: {
					[config.AWS_ELASTIC_TYPE]: {
						properties: {
							pair: {
								type: 'string',
								index: 'not_analyzed'
							},
							datetime: {
								type: 'date',
								format: 'strict_date_optional_time'
							},
							last: {
								type: 'double'
							}
						}
					}
				}
			}
		});
	} catch (error) {
		throw new MyError('ES delete failed', { error });
	}
}

/* just for testing */
export async function deleteIndex() {
	try {
		return await getClient().indices.delete({
			index: config.AWS_ELASTIC_INDEX,
		});
	} catch (error) {
		throw new MyError('ES delete failed', { error });
	}
}

/* just for testing */
export async function removeTicker(id: string) {
	try {
		return await getClient().delete({
			index: config.AWS_ELASTIC_INDEX,
			type: config.AWS_ELASTIC_TYPE,
			id: id
		});
	} catch (error) {
		throw new MyError('ES delete failed', { error });
	}
}
