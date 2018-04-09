import { SQS } from 'aws-sdk';

import logger from './logger';
import { MyError } from './errors';
import { config } from './config';
import { Ticker } from './interfaces';

const sqs = new SQS({
	apiVersion: '2018-04-01',
	accessKeyId: config.AWS_ACCESS_ID,
	secretAccessKey: config.AWS_SECRET_KEY,
	region: config.AWS_REGION,
	logger: logger
});

export function sendMessage(ticker: Ticker) {
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

export function receiveMessage() {
	return new Promise((resolve, reject) => {
		sqs.receiveMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
		}, (error, messages) => {
			if (error) {
				reject(error);
			} else if (messages.Messages.length !== 1) {
				reject(new MyError('SQS received messages of length != 1', { object: messages.Messages }));
			} else {
				sqs.deleteMessage({
					QueueUrl: config.AWS_SQS_QUEUE_URL,
					ReceiptHandle: messages.Messages[0].ReceiptHandle
				}, (error, data) => {
					if (error) {
						reject(error);
					} else {
						resolve(JSON.parse(messages.Messages[0].Body));
					}
				});
			}
		});
	});
}

export function deleteMessage(handle: string) {
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
