import R from 'ramda';
import { SQS } from 'aws-sdk';
// import { MessageAttributeValue, MessageBodyAttributeMap } from 'aws-sdk/clients/sqs';

import logger from './logger';
import config from './config';
import { MyError } from './errors';
import { MessageAttributes } from '*/interfaces';

let client: SQS;

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
			// logger: logger,
		});
		return client;
	}
}

export async function receiveMessage<T>(visibilityTimeout?: number) {
	try {
		let params = {};
		if (visibilityTimeout != null && typeof visibilityTimeout === 'number') {
			params['VisibilityTimeout'] = visibilityTimeout;
		}

		const messages = await getClient().receiveMessage({ ...params, QueueUrl: config.AWS_SQS_QUEUE_URL, MaxNumberOfMessages: 1, WaitTimeSeconds: 0 }).promise();

		if (messages.Messages && messages.Messages.length > 0) {
			/* loop is used to satisfy TypeScript checker */
			for (const message of messages.Messages) {
				if (message.Body && message.ReceiptHandle) {
					let body;
					let content: T;

					try {
						body = JSON.parse(message.Body);
					} catch (error) {
						throw new MyError(`Error parsing message's "Body": ${error.message}`, { object: message });
					}

					try {
						content = JSON.parse(body.Message);
					} catch (error) {
						throw new MyError(`Error parsing message's "Body.Message": ${error.message}`, { object: message });
					}

					const ret: Message<T> = {
						body: content,
						receiptHandle: message.ReceiptHandle
					};

					if (body.MessageAttributes) {
						ret.attributes = R.mapObjIndexed(value => messageAttributeToValue(value), body.MessageAttributes as MessageBodyAttributeMap);
					}

					return ret;
				} else {
					throw new MyError(`Message doesn't contain "Body" or "ReceiptHandle`, { object: message });
				}
			}
		}

		return null;
	} catch (error) {
		throw new MyError('SQS receiveMessage failed', { error });
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

export async function purgeQueue(queue?: string) {
	try {
		await getClient().purgeQueue({
			QueueUrl: queue || config.AWS_SQS_QUEUE_URL,
		}).promise();
	} catch (error) {
		throw new MyError('SQS purgeQueue failed', { error });
	}
}

const valueRegExp = /(.*)\((.*)\)/;

function messageAttributeToValue(attribute: MessageAttributeValue) {
	if (attribute.Type === 'Number') {
		return Number(attribute.Value);
	} else if (attribute.Type === 'String') {
		if (attribute.Value) {
			const ret = valueRegExp.exec(attribute.Value);
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
