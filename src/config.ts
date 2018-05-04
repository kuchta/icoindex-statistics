import logger from './logger';
import { MyError } from './errors';
import config from '../config.json';

export interface Config {
	AWS_REGION: string;
	AWS_ACCESS_ID: string;
	AWS_SECRET_KEY: string;
	AWS_SQS_QUEUE_URL: string;
	AWS_DYNAMO_TABLE: string;
	AWS_ELASTIC_HOST: string;
	AWS_ELASTIC_INDEX: string;
	AWS_ELASTIC_TYPE: string;
	GRAPHQL_HOST: string;
	GRAPHQL_PORT: number;
	DYNAMO_INTERVAL: number;
	EXCHANGE_INTERVAL: number;
	MAX_DATETIME_PROXIMITY: string;
}

// const config: Config = configJson;

Object.entries(config).forEach(([key, value]) => {
	Object.defineProperty(config, key, {
		get: getter(key, value),
		set: (value) => {
			if (typeof config[key] === 'number') {
				value = parseInt(value);
			}
			logger.debug(`Setting config: ${key}: ${format(value)}`);
			Object.defineProperty(config, key, {
				get: getter(key, value)
			});
		}
	});
});

function getter(key: string, value: any) {
	let rep = 5; // This is actually just 3 times, because cli parser takes every config item 2 times
	return () => {
		if (--rep <= 0) {
			logger.debug(`Getting config: ${key}: ${format(value)}...`);
			Object.defineProperty(config, key, {
				value: value,
				writable: true
			});
		} else {
			logger.debug(`Getting config: ${key}: ${format(value)}`);
		}
		return value;
	};
}

function format(value: any) {
	return typeof value === 'string' ? `"${value}"` : value;
}

/* Load config from environment */
Object.keys(config).forEach((key) => {
	let env = process.env[`IS_${key}`];
	if (env) {
		config[key] = env;
	}
});

export default config as Config;
