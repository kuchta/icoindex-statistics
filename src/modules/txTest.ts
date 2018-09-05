import util from 'util';
import path from 'path';

import R from 'ramda';
import test, { Test } from 'tape';
import { GraphQLClient } from 'graphql-request';

import { Option } from '../interfaces';
import { TestData, Transaction, TransactionOutputs } from '../transactions';
import { Block } from '../ethereumTypes';

import config from '../config';
import logger from '../logger';
import { sleep } from '../utils';
import { purgeDatabase, deleteItem } from '../dynamo';
import { purgeQueue } from '../sqs';
import { sendMessage } from '../sns';

import { txMockService } from './txMockService';
import { txFetchService } from './txFetchService';
import { storeService } from './storeService';
import { queryService } from './queryService';
import { getBlockTransactionHash } from './txMockService';

export const description = 'Transaction Test Pipeline';
export const options: Option[] = [
	{ option: '--tx-mock-service-host <host>', description: 'Bind txMockService to this host', defaultValue: config.MOCKSERVICE_HOST },
	{ option: '--tx-mock-service-port <port>', description: 'Bind txMockService to this port', defaultValue: '9000' },
	{ option: '--query-service-host <host>', description: 'Bind queryService to this host', defaultValue: config.QUERYSERVICE_HOST },
	{ option: '--query-service-port <port>', description: 'Bind queryService to this port', defaultValue: '9001' },
	{ option: '-f, --filename <file>', description: 'Load test data from file <file>' },
	{ option: '-n, --start-block-number <number>', description: 'Start with this number as the current block' },
];

export default async function main(options: { [key: string]: string }) {
	const txMockServiceHost = options.txMockServiceHost;
	const txMockServicePort = parseInt(options.txMockServicePort);

	const queryServiceHost = options.queryServiceHost;
	const queryServicePort = parseInt(options.queryServicePort);

	let testData: TestData;
	if (options.filename) {
		testData = require(path.resolve(process.cwd(), options.filename));
	} else {
		testData = require(path.resolve(path.dirname(path.dirname(__dirname)), path.join('testData', 'transactions.json')));
	}

	const startBlockNumber = options.startBlockNumber ? Number(options.startBlockNumber) : Math.floor(testData.fixtures.length / 2);

	const transactions = getTransactions(testData.fixtures);
	const queries = testData.queries;

	logger.warning('Cleaning address queue');
	await purgeQueue(config.AWS_SQS_ADDRESS_URL);

	logger.warning('Cleaning address database');
	await purgeDatabase('address', config.AWS_DYNAMO_ADDRESS_TABLE);

	logger.warning('Cleaning transaction queue');
	await purgeQueue(config.AWS_SQS_TRANSACTION_URL);

	logger.warning('Cleaning transaction database');
	transactions.forEach(async (transaction) => await deleteItem('uuid', transaction.uuid, config.AWS_DYNAMO_TRANSACTION_TABLE));

	logger.info('Sending request to enable address 0x0000000000000000000000000000000000000001');
	await sendMessage({ address: '0x0000000000000000000000000000000000000001', enabled: true }, undefined, config.AWS_SNS_ADDRESS_TOPIC);

	test('txFetchService', async (test) => {
		test.timeoutAfter(60000);

		config.ETHEREUM_URL = `http://${txMockServiceHost}:${txMockServicePort}/ethereum`;
		config.ETHERSCAN_URL = `http://${txMockServiceHost}:${txMockServicePort}/etherscan`;

		const server = await txMockService(startBlockNumber, testData.fixtures, txMockServiceHost, txMockServicePort, () => {
			txFetchService({
				stopPredicate: () => allDataPassed('sentToQueue', transactions),
				txSaved: (transaction) => checkAndMarkData('sentToQueue', test, transactions, transaction),
				complete: () => {
					server.close();
					test.end();
				}
			});
		});
	});

	test('storeService', (test) => {
		test.timeoutAfter(60000);

		config.AWS_SNS_TOPIC = config.AWS_SNS_STORE_TOPIC;
		config.AWS_SQS_URL = config.AWS_SQS_TRANSACTION_URL;
		config.AWS_DYNAMO_TABLE = config.AWS_DYNAMO_TRANSACTION_TABLE;

		storeService({
			stopPredicate: () => allDataPassed('storedToDB', transactions),
			nextThenHandler: (transaction) => checkAndMarkData('storedToDB', test, transactions, transaction),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			completeHandler: () => test.end()
		});
	});

	test('queryService', async (test) => {
		test.timeoutAfter(60000);
		// test.plan(queries.length);

		logger.info('Waiting for transations to propagate to elastic');
		await sleep(5000);

		const server = queryService(queryServiceHost, queryServicePort, async () => {
			try {
				const client = new GraphQLClient(`http://${queryServiceHost}:${queryServicePort}/graphql`);
				const result = await client.request<TransactionOutputs>(`query MyQuery($addresses: [AddressInput]) {
					getAddressTransactions(addresses: $addresses) {
						address,
						receivedCount,
						receivedAmount,
						sentCount,
						sentAmount
					}
				}`, { addresses: R.map(R.prop('query'), queries) });
				const results = result.getAddressTransactions;
				queries.forEach((query, i) => test.same(results[i], query.result, `queryElastic address=${results[i].address}, receivedAmount=${results[i].receivedAmount}, receivedCount=${results[i].receivedCount}, sentAmount=${results[i].sentAmount}, sentCount=${results[i].sentCount}`));
				server.close();
				test.end();
			} catch (error) {
				server.close();
				test.fail(error);
				test.end();
			}
		});
	});
}

const checkedIndexes = {
	sentToQueue: new Set(),
	storedToDB: new Set(),
};

function checkAndMarkData(mark: string, test: Test, transactions: Transaction[], transaction: Transaction) {
	const index = transactions.findIndex((data) =>
		transaction.uuid === data.uuid &&
		transaction.blockNumber === data.blockNumber &&
		Date.parse(transaction.timeStamp) === Date.parse(data.timeStamp) &&
		transaction.from === data.from &&
		transaction.to === data.to &&
		transaction.value === data.value
	);
	if (index >= 0) {
		if (checkedIndexes[mark].has(index)) {
			test.fail(`${mark}: Duplicate transaction: uuid=${transaction.uuid}, timeStamp=${transaction.timeStamp}, value=${transaction.value}`);
		} else {
			checkedIndexes[mark].add(index);
			test.same(transaction, transactions[index], `${mark}: uuid=${transaction.uuid}, timeStamp=${transaction.timeStamp}, value=${transaction.value}`);
		}
	} else {
		test.fail(`${mark}: Unknown transaction: ${util.inspect(transaction, { colors: true, depth: 10 })}`);
	}
}

function allDataPassed(mark: string, transactions: Transaction[]) {
	return checkedIndexes[mark].size >= transactions.length;
}

function getTransactions(blocks: Block[]): Transaction[] {
	return R.reduce((transactions, block) => {
		block.transactions.forEach((transaction, index) => {
			transactions.push({
				uuid: getBlockTransactionHash(block, index),
				blockNumber: parseInt(block.number),
				timeStamp: block.timestamp,
				from: transaction.from,
				to: transaction.to,
				value: Number(transaction.value)
			});
		});
		return transactions;
	}, [] as Transaction[], blocks);
}
