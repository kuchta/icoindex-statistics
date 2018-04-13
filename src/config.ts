import logger from './logger';
import { MyError } from './errors';

export interface Config {
	readonly AWS_REGION: string;
	readonly AWS_ACCESS_ID: string;
	readonly AWS_SECRET_KEY: string;
	readonly AWS_SQS_QUEUE_URL: string;
	readonly AWS_DYNAMO_TABLE: string;
	readonly AWS_ELASTIC_HOST: string;
	readonly DYNAMO_INTERVAL: number;
	readonly EXCHANGE_INTERVAL: number;
}

export const config: Config = {
	AWS_REGION: getEnvVar('AWS_REGION'),
	AWS_ACCESS_ID: getEnvVar('AWS_ACCESS_ID'),
	AWS_SECRET_KEY: getEnvVar('AWS_SECRET_KEY'),
	AWS_SQS_QUEUE_URL: `https://sqs.${getEnvVar('AWS_REGION')}.amazonaws.com/234333348657/icoindex-staging-queue-coin-trading`,
	AWS_DYNAMO_TABLE: 'icoindexstaging.cointradinghistory',
	AWS_ELASTIC_HOST: `search-icoindex-staging-gywi2nq266suyvyjfux67mhf44.${getEnvVar('AWS_REGION')}.es.amazonaws.com`,
	DYNAMO_INTERVAL: 100,
	EXCHANGE_INTERVAL: 5000
};

function getEnvVar(variable: string): string {
	let env = process.env[variable];
	if (env) {
		return env;
	} else {
		throw new MyError(`Environment variable ${variable} not set`);
	}
}

for (let [key, value] of Object.entries(config)) {
	Object.defineProperty(config, key, {
		get: () => {
			logger.debug(`Getting config: ${key}: "${value}"`);
			return value;
		}
	});
}
