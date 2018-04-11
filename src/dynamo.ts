import { DynamoDB } from 'aws-sdk';
import uuidv4 from 'uuid/v4';

import { MyError } from './errors';
import { Ticker } from './interfaces';
import { config } from './config';
import logger from './logger';

let client: DynamoDB | null = null;

function getClient(): DynamoDB {
	if (client) {
		return client;
	} else {
		client = new DynamoDB({
			apiVersion: '2018-04-01',
			accessKeyId: config.AWS_ACCESS_ID,
			secretAccessKey: config.AWS_SECRET_KEY,
			region: config.AWS_REGION,
			logger: logger
		});
		return client;
	}
}

export function putItem(ticker: Ticker) {
	return new Promise((resolve, reject) => {
		getClient().putItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Item: {
				uuid: {
					S: uuidv4() as string
				},
				symbol: {
					S: ticker.symbol
				},
				datetime: {
					S: ticker.datetime
				},
				last: {
					N: String(ticker.last)
				}
			}
		}, (error, data) => {
			if (error) {
				reject(error);
			} else {
				resolve(data);
			}
		});
	});
}
