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

/* Not used - tickers are sent through SNS */
// export function sendTicker(exchange: string, pair: string, datetime: string, rate: number) {
// 	return new Promise<SQS.SendMessageResult>((resolve, reject) => {
// 		getClient().sendMessage({
// 			QueueUrl: config.AWS_SQS_QUEUE_URL,
// 			DelaySeconds: 0,
// 			MessageBody: JSON.stringify({ exchange, pair, datetime, rate })
// 		}, (error, data) => {
// 			if (error) {
// 				reject(new MyError('SQS sendMessage failed', { error }));
// 			} else {
// 				resolve(data);
// 			}
// 		});
// 	});
// }

export async function receiveTicker() {
	try {
		while (true) {
			let data = await getClient().receiveMessage({ QueueUrl: config.AWS_SQS_QUEUE_URL }).promise();

			if (!data.Messages) {
				continue;
			}

			for (let message of data.Messages) {
				if (message.Body) {
					let body = JSON.parse(message.Body);
					if (body && body.TopicArn === config.AWS_SNS_TOPIC) {
						if (message.ReceiptHandle) {
							await deleteMessage(message.ReceiptHandle);
						}
						let ticker = JSON.parse(body.Message);
						return ticker as Ticker;
					}
				}
			}
		}
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
