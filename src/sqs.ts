import { SQS } from 'aws-sdk';

import { MyError } from './errors';
import { Ticker } from './interfaces';
import { config } from './config';
import logger from './logger';

let client: SQS | null = null;

function getClient(): SQS {
	if (client) {
		return client;
	} else {
		client = new SQS({
			apiVersion: '2018-04-01',
			accessKeyId: config.AWS_ACCESS_ID,
			secretAccessKey: config.AWS_SECRET_KEY,
			region: config.AWS_REGION,
			logger: logger
		});
		return client;
	}
}

export function sendMessage(ticker: Ticker) {
	return new Promise((resolve, reject) => {
		getClient().sendMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
			DelaySeconds: 0,
			MessageBody: JSON.stringify(ticker)
		}, (error, data) => {
			if (error) {
				reject(new MyError('SQS sendMessage failed', { error }));
			} else {
				resolve(data);
			}
		});
	});
}

export function receiveMessage() {
	return new Promise((resolve, reject) => {
		getClient().receiveMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
		}, (error, data) => {
			if (error) {
				reject(new MyError('SQS receiveMessage failed', { error }));
			} else if (!data.Messages) {
				reject(new MyError('SQS receiveMessage didn\'t contain Messages field', { object: data }));
			} else if (data.Messages.length !== 1) {
				reject(new MyError('SQS receiveMessage retuned Messages field of length != 1', { object: data.Messages }));
			} else {
				let message = data.Messages[0];
				if (!message.ReceiptHandle) {
					reject(new MyError('SQS receiveMessage didn\'t contain Messages[0].ReceiptHandle field', { object: message }));
				} else {
					getClient().deleteMessage({
						QueueUrl: config.AWS_SQS_QUEUE_URL,
						ReceiptHandle: message.ReceiptHandle
					}, (error) => {
						if (error) {
							reject(new MyError('SQS receiveMessage => deleteMessage failed', { error }));
						} else if (!message.Body) {
							reject(new MyError('SQS receiveMessage didn\'t contain Body field', { object: message }));
						} else {
							resolve(JSON.parse(message.Body));
						}
					});
				}
			}
		});
	});
}

export function deleteMessage(handle: string) {
	return new Promise((resolve, reject) => {
		getClient().deleteMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
			ReceiptHandle: handle
		}, (error) => {
			if (error) {
				reject(new MyError('SQS deleteMessage failed', { error }));
			} else {
				resolve();
			}
		});
	});
}

export function purgeQueue() {
	return new Promise((resolve, reject) => {
		getClient().receiveMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
			MaxNumberOfMessages: 10
		}, (error, data) => {
			if (error) {
				reject(new MyError('SQS purgeQueue => receiveMessage failed', { error }));
			} else if (!data.Messages) {
				reject(new MyError('SQS purgeQueue => receiveMessage didn\'t contain Messages field', { object: data }));
			} else {
				data.Messages.forEach((message) => {
					if (!message.ReceiptHandle) {
						reject(new MyError('SQS purgeQueue => receiveMessage didn\'t contain ReceiptHandle field', { object: message }));
					} else {
						getClient().deleteMessage({
							QueueUrl: config.AWS_SQS_QUEUE_URL,
							ReceiptHandle: message.ReceiptHandle
						}, (error) => {
							if (error) {
								reject(new MyError('SQS purgeQueue => deleteMessage failed', { error }));
							} else {
								purgeQueue();
							}
						});
					}
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
