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
		set: (val) => {
			if (typeof config[key] === 'number') {
				val = parseInt(val);
			}
			logger.debug(`Setting config: ${key}: ${val}`);
			Object.defineProperty(config, key, {
				get: getter(key, value)
			});
		}
	});
});

Object.keys(config).forEach((key) => {
	let env = process.env[`IS_${key}`];
	if (env) {
		config[key] = env;
	}
});

function getter(key: string, value: any) {
	let rep = 0;
	return () => {
		logger.debug(`Getting config: ${key}: ${value}`);

		if (rep > 2) {
			Object.defineProperty(config, key, {
				value: value,
				writable: true
			});
		}
		rep++;
		return value;
	};
}

export default config as Config;
