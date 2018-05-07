import { SQS } from 'aws-sdk';

import logger from './logger';
import config from './config';
import { MyError } from './errors';
import { Ticker } from './interfaces';

let client: SQS | null = null;

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

export function sendTicker(ticker: Ticker) {
	return new Promise<SQS.SendMessageResult>((resolve, reject) => {
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

export function receiveTicker() {
	return new Promise<Ticker>((resolve, reject) => {
		getClient().receiveMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
		}, (error, data) => {
			if (error) {
				reject(new MyError('SQS receiveMessage failed', { error }));
			} else if (!data.Messages) {
				reject(new MyError("SQS receiveMessage didn't contain Messages field", { object: data }));
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
	// @ts-ignore: 'resolve' is declared but its value is never read.
	return new Promise((resolve, reject) => {
		getClient().receiveMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
			MaxNumberOfMessages: 10
		}, (error, data) => {
			if (error) {
				reject(new MyError('SQS purgeQueue => receiveMessage failed', { error }));
			} else if (data.Messages) {
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
								process.stdout.write('.');
							}
						});
					}
				});
				purgeQueue();
			}
		});
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
}
