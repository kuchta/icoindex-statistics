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

export async function putItem<T>(item: T) {
	try {
		await getClient().putItem({
			TableName: config.AWS_DYNAMO_TABLE,
			Item: DynamoDB.Converter.marshall(item)
		}).promise();
	} catch (error) {
		throw new MyError('Dynamo putItem failed', { error });
	}
}

export async function getItem<T>(keyName: string, keyValue: string) {
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
			return DynamoDB.Converter.unmarshall(ret.Item) as T;
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
				delete obj[keyName];
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

function objectToPutItemInputAttributeMap<T>(obj: T): DynamoDB.PutItemInputAttributeMap {
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
			if (Array.isArray(value)) {
				item[key] = { L: value };
			} else {
				item[key] = { M: objectToPutItemInputAttributeMap(value) };
			}
		} else {
			throw new MyError(`objectToPutItemInputAttributeMap invalid value "${value}" of type "${typeof value}"`);
		}
	});
	return item;
}
function attributeMapToObject<T>(item: DynamoDB.MapAttributeValue) {
	logger.debug('attributeMapToObject', item);
	let obj = {} as T;
	Object.entries(item).forEach(([key, value]) => {
		if ('NULL' in value) {
			obj[key] = null;
		} else if ('BOOL' in value) {
			obj[key] = Boolean(value.BOOL);
		} else if ('N' in value) {
			obj[key] = Number(value);
		} else if ('S' in value) {
			obj[key] = value;
		} else if ('M' in value) {
			if (value.M) {
				obj[key] = attributeMapToObject(value.M);
			} else {
				obj[key] = value.M;
			}
		} else {
			throw new MyError(`toPutItemInputAttributeMap invalid value "${value}" of type "${typeof value}"`);
		}
	});
	return obj;
}
