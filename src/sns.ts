import R from 'ramda';
import { SNS } from 'aws-sdk';

import logger from './logger';
import config from './config';
import { MyError } from './errors';

let client: SNS | null = null;

function getClient(): SNS {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating SNS client...`);
		client = new SNS({
			apiVersion: '2018-04-01',
			accessKeyId: config.AWS_ACCESS_ID,
			secretAccessKey: config.AWS_SECRET_KEY,
			region: config.AWS_REGION,
			logger: logger,
		});
		return client;
	}
}

export async function sendMessage<T>(message: T, attributes?: {[key: string]: boolean | number | string }) {
	try {
		let msg: SNS.Types.PublishInput = {
			TopicArn: config.AWS_SNS_TOPIC,
			Message: JSON.stringify(message)
		};

		if (attributes) {
			msg.MessageAttributes = R.mapObjIndexed(value => getMessageAttributeValue(value), attributes);
		}

		await getClient().publish(msg).promise();
	} catch (error) {
		throw new MyError('SNS publish failed', { error });
	}
}

function getMessageAttributeValue(value: boolean | number | string) {
	if (typeof value === 'boolean') {
		return {
			DataType: 'String',
			StringValue: String(value)
		};
	} else if (typeof value === 'number') {
		return {
			DataType: 'Number',
			StringValue: String(value)
		};
	} else if (typeof value === 'string') {
		return {
			DataType: 'String',
			StringValue: value
		};
	} else {
		throw new MyError(`getMessageAttributeDataType error: Invalid type of value: ${value} (${typeof value})`);
	}
}
