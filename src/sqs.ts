import AWS from 'aws-sdk';
import ccxt from 'ccxt';

import logger from './logger';
import { MyError } from './errors';
import { config } from './config';

export interface Ticker {
	symbol: string;
	datetime: string;
	last?: number;
}

const sqs = new AWS.SQS({
	apiVersion: '2018-04-01',
	accessKeyId: config.AWS_ACCESS_ID,
	secretAccessKey: config.AWS_SECRET_KEY,
	region: config.AWS_REGION,
	logger: logger
});

export function sendToQueue(ticker: Ticker) {
	return new Promise((resolve, reject) => {
		sqs.sendMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
			DelaySeconds: 0,
			MessageBody: JSON.stringify(ticker)
		}, (error, data) => {
			if (error) {
				reject(error);
			} else {
				resolve(data);
			}
		});
	});
}

export function receiveFromQueue() {
	return new Promise((resolve, reject) => {
		sqs.receiveMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
		}, (error, data) => {
			if (data.Messages.length !== 1) {
				logger.warning('SQS receiveMessage', new MyError('Expected array of length 1', { object: data.Messages }));
			}
			if (error) {
				reject(error);
			} else {
				resolve(data.Messages[0].Body);
			}
		});
	});
}

export function deleteFromQueue(handle: string) {
	return new Promise((resolve, reject) => {
		sqs.deleteMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
			ReceiptHandle: handle
		}, (error, data) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

export function purgeQueue() {
	return new Promise((resolve, reject) => {
		sqs.receiveMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
			MaxNumberOfMessages: 10
		}, (error, data) => {
			if (error) {
				reject(error);
			} else {
				logger.info('Number of received messages:', data.Messages.length);
				data.Messages.forEach((message) => {
					sqs.deleteMessage({
						QueueUrl: config.AWS_SQS_QUEUE_URL,
						ReceiptHandle: message.ReceiptHandle
					}, (error, data) => {
						if (error) {
							reject(error);
						} else {
							logger.info('Message deleted', message.ReceiptHandle);
							purgeQueue();
						}
					});
				});
			}
		});

		// sqs.purgeQueue({
		// 	QueueUrl: config.AWS_SQS_QUEUE_URL,
		// }, (error, data) => {
		// 	if (error) {
		// 		reject(error);
		// 	} else {
		// 		resolve();
		// 	}
		// });
	});
}
