import { Client, ConfigOptions, SearchResponse, DeleteDocumentResponse } from 'elasticsearch';
import AWS from 'aws-sdk';
import { integer } from 'aws-sdk/clients/cloudfront';
import httpAWSES from 'http-aws-es';

import logger, { MyLogger, LeveledLogMethod } from './logger';
import { config } from './config';
import { MyError } from './errors';
import { Ticker, TokenPairRateOnDateTime } from './interfaces';

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
		this.info = logger.info.bind(logger);
		this.debug = logger.debug.bind(logger);
		this.close = () => { /* empty */ };
		this.trace = (method, requestUrl, body, responseBody, responseStatus) => {
			logger.debug('ElasticSearch TRACE', { method, requestUrl, body, responseBody, responseStatus });
		};
	}
}

// AWSConfig.update({
// 	credentials: new Credentials(config.AWS_ACCESS_ID, config.AWS_SECRET_KEY),
// 	region: config.AWS_REGION
// });

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
			sniffOnStart: true,
			// amazonES: {
			//   region: config.AWS_REGION,
			//   accessKey: config.AWS_ACCESS_ID,
			//   secretKey: config.AWS_SECRET_KEY,
			// },
			log: LogToMyLogger
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

export function getTicker(pair: string, datetime: string) {
	return new Promise<TokenPairRateOnDateTime>((resolve, reject) => {
		getClient().search<TokenPairRateOnDateTime>({
			index: config.AWS_ELASTIC_INDEX,
			type: config.AWS_ELASTIC_TYPE,
			body: {
				query: {
					function_score: {
						functions: [
							{
								linear: {
									datetime: {
										origin: datetime,
										scale: '20m'
									}
								}
							}
						],
						score_mode: 'multiply',
						boost_mode: 'multiply',
						query: {
							match: {
								pair: pair
							},
							// match_all: {}
						}
					}
				}
			}
		}, function (error, response) {
			if (error) {
				reject(new MyError('ES search failed', { error }));
			} else {
				logger.info1('response', response);
				resolve(response.hits.hits[0]._source);
			}
		});
	});
}

export function deleteTicker(id: string) {
	return new Promise<DeleteDocumentResponse>((resolve, reject) => {
		getClient().delete({
			index: config.AWS_ELASTIC_INDEX,
			type: config.AWS_ELASTIC_TYPE,
			id: `uuid=${id}`
		}, function (error, response) {
			if (error) {
				reject(new MyError('ES delete failed', { error }));
			} else {
				resolve(response);
			}
		});
	});
}

// logger.info('ahojda');
// getClient().indices.getMapping({})
// .then((value) => logger.info('mapping', value))
// .catch((error) => logger.error('mapping', error));
