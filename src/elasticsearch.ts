import { Client } from 'elasticsearch';

import { MyError } from './errors';
import { Ticker } from './interfaces';
import { config } from './config';
import logger, { MyLogger } from './logger';

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
		client = new Client({
			host: `${config.AWS_ELASTIC_URL}:9200`,
			sniffOnStart: true,
			// log: LogToMyLogger
		});
		return client;
	}
}

export function ping() {
	return getClient().ping({
		requestTimeout: 1000
	});
}
