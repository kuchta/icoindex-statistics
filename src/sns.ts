import R from 'ramda';
import { SNS } from 'aws-sdk';

import logger from './logger';
import config from './config';
import { MyError } from './errors';
import { MessageAttributes } from '*/interfaces';

let client: SNS;

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
			// logger: logger,
		});
		return client;
	}
}

export async function sendMessage(message: object, attributes?: MessageAttributes, topic?: string) {
	try {
		const msg: SNS.Types.PublishInput = {
			TopicArn: topic || config.AWS_SNS_TOPIC,
			Message: JSON.stringify(message)
		};

		if (attributes) {
			msg.MessageAttributes = R.mapObjIndexed(value => valueToMessageAttribute(value), attributes);
		}

		await getClient().publish(msg).promise();
	} catch (error) {
		throw new MyError('SNS publish failed', { error });
	}
}

function valueToMessageAttribute(value: boolean | number | string | object) {
	if (typeof value === 'boolean') {
		return {
			DataType: 'String',
			StringValue: `boolean(${value})`
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
	} else if (typeof value === 'object') {
		return {
			DataType: 'String',
			StringValue: `object(${JSON.stringify(value)})`
		};
	} else {
		throw new MyError(`valueToMessageAttribute error: Invalid type of value: ${value} (${typeof value})`);
	}
}
