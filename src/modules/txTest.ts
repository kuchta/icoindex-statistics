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
	{ option: '-f, --filename <file>', description: 'Load test data from file <file>', defaultValue: './testData/transactions.json' },
	{ option: '-n, --start-block-number <number>', description: 'Start with this number as the current block' },
];

const ADDRESS_TABLE = 'icoindexstaging.blockchainaddress';
const ADDRESS_QUEUE = 'https://sqs.eu-west-1.amazonaws.com/234333348657/icoindex-staging-queue-blockchain-address';
const ADDRESS_TOPIC = 'arn:aws:sns:eu-west-1:234333348657:icoindex-staging-event-add-blockchain-address';
const TRANSACTION_TABLE = 'icoindexstaging.transactionhistory';
const TRANSACTION_QUEUE = 'https://sqs.eu-west-1.amazonaws.com/234333348657/icoindex-staging-queue-transaction';
const TRANSACTION_TOPIC = 'arn:aws:sns:eu-west-1:234333348657:icoindex-staging-event-add-transaction';
const STORE_TOPIC = 'arn:aws:sns:eu-west-1:234333348657:icoindex-staging-event-stats-store';
const ELASTIC_HOST = 'search-icoindex-staging-gywi2nq266suyvyjfux67mhf44.eu-west-1.es.amazonaws.com';

export default async function main(options: { [key: string]: string }) {
	const txMockServiceHost = options.txMockServiceHost;
	const txMockServicePort = parseInt(options.txMockServicePort);

	const queryServiceHost = options.queryServiceHost;
	const queryServicePort = parseInt(options.queryServicePort);

	const testData: TestData = require(path.resolve(process.cwd(), options.filename));

	const startBlockNumber = options.startBlockNumber ? Number(options.startBlockNumber) : Math.floor(testData.fixtures.length / 2);

	const transactions = getTransactions(testData.fixtures);
	const queries = testData.queries;

	test('txFetchService', async (test) => {
		// test.timeoutAfter(60000);

		config.AWS_DYNAMO_TABLE = ADDRESS_TABLE;
		config.AWS_SQS_QUEUE_URL = ADDRESS_QUEUE;
		config.AWS_SNS_TOPIC = TRANSACTION_TOPIC;
		config.ETHEREUM_URL = `http://${txMockServiceHost}:${txMockServicePort}/ethereum`;
		config.ETHERSCAN_URL = `http://${txMockServiceHost}:${txMockServicePort}/etherscan`;

		logger.warning('Cleaning address database');
		await purgeDatabase('address');

		logger.warning('Cleaning address queue');
		await purgeQueue(ADDRESS_QUEUE);

		logger.warning('Cleaning transaction queue');
		await purgeQueue(TRANSACTION_QUEUE);

		logger.info('Sending request to enable address 0x0000000000000000000000000000000000000001');
		await sendMessage({ address: '0x0000000000000000000000000000000000000001', enabled: true }, undefined, ADDRESS_TOPIC);

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
		// test.timeoutAfter(60000);

		config.AWS_DYNAMO_TABLE = TRANSACTION_TABLE;
		config.AWS_SQS_QUEUE_URL = TRANSACTION_QUEUE;
		config.AWS_SNS_TOPIC = STORE_TOPIC;

		logger.warning('Cleaning transaction database');
		transactions.forEach((transaction) => deleteItem('uuid', transaction.uuid));

		storeService({
			stopPredicate: () => allDataPassed('storedToDB', transactions),
			nextThenHandler: (transaction) => checkAndMarkData('storedToDB', test, transactions, transaction),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			completeHandler: () => test.end()
		});
	});

	test('queryService', async (test) => {
		// test.timeoutAfter(60000);

		logger.info('Waiting for transations to propagate to elastic');
		await sleep(5000);

		config.AWS_ELASTIC_HOST = ELASTIC_HOST;

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

async function sleep(timeout: number) {
	return new Promise(resolve => setTimeout(resolve, timeout));
}
