import { DynamoDB } from 'aws-sdk';
import uuidv4 from 'uuid/v4';

import logger from './logger';
import config from './config';
// import { MyError } from './errors';
// import { Ticker } from './interfaces';

let client: DynamoDB | null = null;

function getClient(): DynamoDB {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating DynamoDB client...`);
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

export function insertTicker(exchange: string, pair: string, datetime: string, rate: number) {
	return new Promise((resolve, reject) => {
		getClient().putItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Item: {
				uuid: {
					S: uuidv4() as string
				},
				exchange: {
					S: exchange
				},
				pair: {
					S: pair
				},
				datetime: {
					S: datetime
				},
				rate: {
					N: String(rate)
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

/* Not working for now */
export function removeTicker(uuid: string) {
	return new Promise((resolve, reject) => {
		getClient().deleteItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Key: {
				uuid: {
					S: uuid
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

/* We don't have permission for this operation */
export function describeTable() {
	return new Promise((resolve, reject) => {
		getClient().describeTable({
			TableName: config.AWS_DYNAMO_TABLE
		}, (error, data) => {
			if (error) {
				reject(error);
			} else {
				resolve(data);
			}
		});
	});
}

/* We Don't have permission for this operation*/
export function updateTable() {
	return new Promise((resolve, reject) => {
		getClient().updateTable({
			TableName: config.AWS_DYNAMO_TABLE,
			AttributeDefinitions: [{
				AttributeName: 'pair',
				AttributeType: 'S',
			}, {
				AttributeName: 'datetime',
				AttributeType: 'S',
			}, {
				AttributeName: 'rate',
				AttributeType: 'N',
			}]
		}, (error, data) => {
			if (error) {
				reject(error);
			} else {
				resolve(data);
			}
		});
	});
}
