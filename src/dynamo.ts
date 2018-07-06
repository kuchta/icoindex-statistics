import { DynamoDB } from 'aws-sdk';

import logger from './logger';
import config from './config';
import { MyError } from './errors';

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

export async function putItem(item: object) {
	try {
		await getClient().putItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Item: DynamoDB.Converter.marshall(item)
		}).promise();
	} catch (error) {
		throw new MyError('Dynamo putItem failed', { error });
	}
}

export async function getItem(keyName: string, keyValue: string) {
	try {
		let ret = await getClient().getItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Key: {
				[keyName]: {
					S: keyValue
				}
			}
		}).promise();

		if (ret.Item) {
			return DynamoDB.Converter.unmarshall(ret.Item);
		}

		return null;
	} catch (error) {
		throw new MyError('Dynamo getItem failed', { error });
	}
}

export async function scan(keyName: string) {
	try {
		let result = await getClient().scan({ TableName: config.AWS_DYNAMO_TABLE }).promise();
		if (result.Items && result.Items.length > 0) {
			return result.Items.reduce((acc, value) => {
				let obj = DynamoDB.Converter.unmarshall(value);
				let key = obj[keyName];
				// delete obj[keyName];
				acc[key] = obj;
				return acc;
			}, {});
		} else {
			return {};
		}
	} catch (error) {
		throw new MyError('Dynamo scan failed', { error });
	}
}

/* Currently not used */
export async function deleteItem(keyName: string, keyValue: string) {
	try {
		await getClient().deleteItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Key: {
				[keyName]: {
					S: keyValue
				}
			}
		}).promise();
	} catch (error) {
		throw new MyError('Dynamo deleteItem failed', { error });
	}
}

/* We don't have permission for this operation */
export async function describeTable() {
	try {
		await getClient().describeTable({ TableName: config.AWS_DYNAMO_TABLE }).promise();
	} catch (error) {
		throw new MyError('Dynamo describeTable failed', { error });
	}
}
