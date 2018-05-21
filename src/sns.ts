import { SNS } from 'aws-sdk';

import logger from './logger';
import config from './config';
import { MyError } from './errors';
import { Ticker } from './interfaces';

let client: SNS | null = null;

function getClient(): SNS {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating SNS client...`);
		client = new SNS({
			apiVersion: '2018-04-01',
			accessKeyId: config.AWS_ACCESS_ID,
			secretAccessKey: config.AWS_SECRET_KEY,
			region: config.AWS_REGION,
			logger: logger,
		});
		return client;
	}
}

export async function sendTicker(exchange: string, pair: string, datetime: string, rate: number) {
	try {
		await getClient().publish({
			TopicArn: config.AWS_SNS_TOPIC,
			Message: JSON.stringify({ exchange, pair, datetime, rate })
		}).promise();
	} catch (error) {
		throw new MyError('SNS publish failed', { error });
	}
}
