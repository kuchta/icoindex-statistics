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
	get AWS_REGION() { return getConfigValue('AWS_REGION'); },
	get AWS_ACCESS_ID() { return getConfigValue('AWS_ACCESS_ID'); },
	get AWS_SECRET_KEY() { return getConfigValue('AWS_SECRET_KEY'); },
	get AWS_SQS_QUEUE_URL() { return getConfigValue('AWS_SQS_QUEUE_URL'); },
	get AWS_DYNAMO_TABLE() { return getConfigValue('AWS_DYNAMO_TABLE'); },
	get AWS_ELASTIC_HOST() { return getConfigValue('AWS_ELASTIC_HOST'); },
	get DYNAMO_INTERVAL() { return getConfigValue('DYNAMO_INTERVAL'); },
	get EXCHANGE_INTERVAL() { return getConfigValue('EXCHANGE_INTERVAL'); }
	// AWS_REGION: getEnvVar('AWS_REGION'),
	// AWS_ACCESS_ID: getEnvVar('AWS_ACCESS_ID'),
	// AWS_SECRET_KEY: getEnvVar('AWS_ACCESS_ID'),
	// AWS_SQS_QUEUE_URL: `https://sqs.${getEnvVar('AWS_REGION')}.amazonaws.com/234333348657/icoindex-staging-queue-coin-trading`,
	// AWS_DYNAMO_TABLE: 'icoindexstaging.cointradinghistory',
	// AWS_ELASTIC_HOST: `https://search-icoindex-staging-gywi2nq266suyvyjfux67mhf44.${getEnvVar('AWS_REGION')}.es.amazonaws.com`,
	// DYNAMO_INTERVAL: 100,
	// EXCHANGE_INTERVAL: 5000
};

function getConfigValue(key: 'DYNAMO_INTERVAL'): number;
function getConfigValue(key: 'EXCHANGE_INTERVAL'): number;
function getConfigValue(key: keyof Config): string;
function getConfigValue(key: keyof Config): string | number {
	let ret;
	switch (key) {
		case 'AWS_REGION':
		case 'AWS_ACCESS_ID':
		case 'AWS_SECRET_KEY':
			ret = getEnvVar(key);
			break;
		case 'AWS_SQS_QUEUE_URL':
			ret = `https://sqs.${getEnvVar('AWS_REGION')}.amazonaws.com/234333348657/icoindex-staging-queue-coin-trading`;
			break;
		case 'AWS_DYNAMO_TABLE':
			ret = 'icoindexstaging.cointradinghistory';
			break;
		case 'AWS_ELASTIC_HOST':
			ret = `https://search-icoindex-staging-gywi2nq266suyvyjfux67mhf44.${getEnvVar('AWS_REGION')}.es.amazonaws.com`;
			break;
		case 'DYNAMO_INTERVAL':
			ret = 100;
			break;
		case 'EXCHANGE_INTERVAL':
			ret = 5000;
			break;
		default:
			logger.warning('Config: Unknown configuration key: "${key}"');
			ret = '';
			break;
	}
	logger.debug1(`Getting config: ${key}: "${ret}"`);
	return ret;
}

function getEnvVar(variable: string): string {
	let env = process.env[variable];
	if (env) {
		// logger.debug1(`Env: "${env}"`);
		return env;
	} else {
		throw new MyError(`Environment variable ${variable} not set`);
	}
}
