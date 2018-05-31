import R from 'ramda';
import { DynamoDB } from 'aws-sdk';
import uuidv4 from 'uuid/v4';

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
		item = R.map(value => isNaN(value) ? { S: value } : { N: String(value) }, item);
		await getClient().putItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Item: { ...item, uuid: { S: uuidv4() as string } }
		}).promise();
	} catch (error) {
		throw new MyError('Dynamo putItem failed', { error });
	}
}

/* Currently not used */
export async function removeItem(uuid: string) {
	try {
		await getClient().deleteItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Key: {
				uuid: {
					S: uuid
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
