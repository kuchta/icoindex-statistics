// import { config as AWSConfig, Credentials } from 'aws-sdk';
import AWS from 'aws-sdk';
import { Client, ConfigOptions } from 'elasticsearch';
import httpAWSES from 'http-aws-es';

import logger, { MyLogger, LeveledLogMethod } from './logger';
import { config } from './config';
import { MyError } from './errors';
import { Ticker } from './interfaces';
import { integer } from 'aws-sdk/clients/cloudfront';

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
