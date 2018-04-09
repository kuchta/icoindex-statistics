import { DynamoDB } from 'aws-sdk';
import uuidv4 from 'uuid/v4';

import logger from './logger';
import { MyError } from './errors';
import { config } from './config';
import { Ticker } from './interfaces';

const dynamoDB = new DynamoDB({
	apiVersion: '2018-04-01',
	accessKeyId: config.AWS_ACCESS_ID,
	secretAccessKey: config.AWS_SECRET_KEY,
	region: config.AWS_REGION,
	logger: logger
});

export function putItem(ticker: Ticker) {
	return new Promise((resolve, reject) => {
		dynamoDB.putItem({
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
				logger.info('putItem:', data);
				resolve(data);
			}
		});
	});
}
