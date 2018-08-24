import { DynamoDB } from 'aws-sdk';

import { MyError } from './errors';

import logger from './logger';
import config from './config';

let client: DynamoDB;

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
			// logger: logger
		});
		return client;
	}
}

export async function getItem(keyName: string, keyValue: string) {
	try {
		const ret = await getClient().getItem({
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

/* Currently not used */
export async function deleteItem(keyName: string, keyValue: string, table?: string) {
	try {
		await getClient().deleteItem({
			TableName: table || config.AWS_DYNAMO_TABLE,
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

export async function scan(keyName?: string, removeKey = false) {
	try {
		const result = await getClient().scan({ TableName: config.AWS_DYNAMO_TABLE }).promise();
		if (keyName) {
			if (result.Items) {
				return result.Items.reduce((acc, value) => {
					const obj = DynamoDB.Converter.unmarshall(value);
					const key = obj[keyName];
					if (removeKey) {
						delete obj[keyName];
					}
					acc[key] = obj;
					return acc;
				}, {});
			} else {
				return {};
			}
		} else {
			if (result.Items) {
				return result.Items.map(value => DynamoDB.Converter.unmarshall(value));
			} else {
				return [];
			}
		}
	} catch (error) {
		throw new MyError('Dynamo scan failed', { error });
	}
}

export async function purgeDatabase(keyName: string) {
	try {
		const records = await scan() as { [key: string]: any; }[];
		for (const record of records) {
			await deleteItem(keyName, record[keyName]);
		}
	} catch (error) {
		throw new MyError('Dynamo purgeDatabase failed', { error });
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
