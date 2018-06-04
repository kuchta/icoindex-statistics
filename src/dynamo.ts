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

export async function putItem(obj: object) {
	try {
		let item = { ...toPutItemInputAttributeMap(obj), uuid: { S: uuidv4() as string } };
		await getClient().putItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Item: item
		}).promise();
	} catch (error) {
		throw new MyError('Dynamo putItem failed', { error });
	}
}

function toPutItemInputAttributeMap(obj: any): DynamoDB.PutItemInputAttributeMap {
	let item: any = {};
	Object.entries(obj).forEach(([key, value]) => {
		if (value == null) {
			item[key] = { NULL: true };
		} else if (typeof value === 'boolean') {
			item[key] = { BOOL: value };
		} else if (typeof value === 'number') {
			item[key] = { N: String(value) };
		} else if (typeof value === 'string') {
			item[key] = { S: value };
		} else if (typeof value === 'object') {
			item[key] = { M: toPutItemInputAttributeMap(value) };
		} else {
			throw new MyError(`toPutItemInputAttributeMap invalid value "${value}" of type "${typeof value}"`);
		}
	});
	return item;
}

/* Currently not used */
export async function deleteItem(uuid: string) {
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
