import { Client } from 'elasticsearch';
import httpAWSES from 'http-aws-es';

import logger, { MyLogger } from './logger';
import { config } from './config';
import { MyError } from './errors';
import { Ticker } from './interfaces';

function LogToMyLogger(this: MyLogger) {
	this.error = logger.error.bind(logger);
	this.warning = logger.warn.bind(logger);
	this.info = logger.info.bind(logger);
	this.debug = logger.debug.bind(logger);
	this.close = () => { /* empty */ };
}

let client: Client | null = null;

function getClient(): Client {
	if (client) {
		return client;
	} else {
		logger.debug1(`Creating ElasticSearch client...`);
		client = new Client({
			host: {
			  protocol: 'https',
			  host: config.AWS_ELASTIC_HOST,
			  port: 443,
			},
			connectionClass: httpAWSES,
			sniffOnStart: true,
			amazonES: {
			  region: config.AWS_REGION,
			  accessKey: config.AWS_ACCESS_ID,
			  secretKey: config.AWS_SECRET_KEY,
			},
			log: LogToMyLogger
		  });
		return client;
	}
}

export function ping() {
	return getClient().ping({
		requestTimeout: 1000
	});
}
