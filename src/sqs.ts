import { SQS } from 'aws-sdk';

import logger from './logger';
import config from './config';
import { MyError } from './errors';
import { Ticker } from './interfaces';

let client: SQS | null = null;

export interface Message<T> {
	body: T;
	receiptHandle: string;
}

function getClient(): SQS {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating SQS client...`);
		client = new SQS({
			apiVersion: '2018-04-01',
			accessKeyId: config.AWS_ACCESS_ID,
			secretAccessKey: config.AWS_SECRET_KEY,
			region: config.AWS_REGION,
			logger: logger,
		});
		return client;
	}
}

export async function receiveMessage<T>(timeout?: number) {
	try {
		let params = { QueueUrl: config.AWS_SQS_QUEUE_URL };
		if (timeout) {
			params['WaitTimeSeconds'] = timeout;
		}
		let data = await getClient().receiveMessage(params).promise();

		if (data.Messages && data.Messages.length > 0) {
			/* loop is used to satisfy TypeScript checker */
			for (let message of data.Messages) {
				if (message.ReceiptHandle && message.Body) {
					// if (body && body.TopicArn === config.AWS_SNS_TOPIC) {
					return {
						body: JSON.parse(JSON.parse(message.Body).Message) as T,
						receiptHandle: message.ReceiptHandle
					} as Message<T>;
				}
			}
		}

		return null;
	} catch (error) {
		throw new MyError('SQS receiveMessage failed', { error });
	}
}

export async function deleteMessage(handle: string) {
	try {
		await getClient().deleteMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
			ReceiptHandle: handle
		}).promise();
	} catch (error) {
		throw new MyError('SQS deleteMessage failed', { error });
	}
}

export async function purgeQueue() {
	try {
		await getClient().purgeQueue({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
		}).promise();
	} catch (error) {
		throw new MyError('SQS purgeQueue failed', { error });
	}
}
