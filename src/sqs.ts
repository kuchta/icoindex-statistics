import R from 'ramda';
import { SQS } from 'aws-sdk';
// import { MessageAttributeValue, MessageBodyAttributeMap } from 'aws-sdk/clients/sqs';

import logger from './logger';
import config from './config';
import { MyError } from './errors';
import { MessageAttributes } from '*/interfaces';

let client: SQS | null = null;

export interface Message<T> {
	receiptHandle: string;
	body: T;
	attributes?: MessageAttributes;
}

type MessageBodyAttributeMap = {[key: string]: MessageAttributeValue};

interface MessageAttributeValue {
	Type: string;
	Value: string;
}

function getClient() {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating SQS client...`);
		client = new SQS({
			apiVersion: '2018-04-01',
			accessKeyId: config.AWS_ACCESS_ID,
			secretAccessKey: config.AWS_SECRET_KEY,
			region: config.AWS_REGION,
			logger: logger,
		});
		return client;
	}
}

export async function receiveMessage<T>(visibilityTimeout?: number) {
	try {
		let params = { QueueUrl: config.AWS_SQS_QUEUE_URL, MaxNumberOfMessages: 1, WaitTimeSeconds: 0 };
		if (visibilityTimeout != null) {
			params['VisibilityTimeout'] = visibilityTimeout;
		}
		let data = await getClient().receiveMessage(params).promise();

		if (data.Messages && data.Messages.length > 0) {
			/* loop is used to satisfy TypeScript checker */
			for (let message of data.Messages) {
				if (message.ReceiptHandle && message.Body) {
					const body = JSON.parse(message.Body);
					let ret: Message<T> = {
						body: JSON.parse(body.Message) as T,
						receiptHandle: message.ReceiptHandle
					};

					if (body.MessageAttributes) {
						ret.attributes = R.mapObjIndexed(value => messageAttributeToValue(value), body.MessageAttributes as MessageBodyAttributeMap);
					}

					return ret;
				} else {
					throw new MyError("SQS receiveMessage: Message doesn't contain Body or ReceiptHandle", { object: message });
				}
			}
		}

		return null;
	} catch (error) {
		throw new MyError('SQS receiveMessage failed', { error });
	}
}

const valueRegExp = /(.*)\((.*)\)/;

function messageAttributeToValue(attribute: MessageAttributeValue) {
	if (attribute.Type === 'Number') {
		return Number(attribute.Value);
	} else if (attribute.Type === 'String') {
		if (attribute.Value) {
			let ret = valueRegExp.exec(attribute.Value);
			if (ret && ret[1] && ret[2]) {
				if (ret[1] === 'boolean') {
					return Boolean(ret[2]);
				} else if (ret[1] === 'object') {
					return JSON.parse(ret[2]);
				} else {
					throw new MyError(`messageAttributeToValue error: Invalid embedded type "${ret[1]}" of value "${ret[2]}"`);
				}
			} else {
				return attribute.Value;
			}
		} else {
			throw new MyError('messageAttributeToValue error: Value of type string is empty');
		}
	} else {
		throw new MyError(`messageAttributeToValue error: Invalid type "${attribute.Type}" of value "${attribute.Value}"`);
	}
}

export async function deleteMessage(handle: string) {
	try {
		await getClient().deleteMessage({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
			ReceiptHandle: handle
		}).promise();
	} catch (error) {
		throw new MyError('SQS deleteMessage failed', { error });
	}
}

export async function purgeQueue() {
	try {
		await getClient().purgeQueue({
			QueueUrl: config.AWS_SQS_QUEUE_URL,
		}).promise();
	} catch (error) {
		throw new MyError('SQS purgeQueue failed', { error });
	}
}
