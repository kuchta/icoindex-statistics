import path from 'path';

import R from 'ramda';
import test, { Test } from 'tape';
import { GraphQLClient } from 'graphql-request';

import config from '../config';
import logger from '../logger';

import { Option } from '../interfaces';
import { TestData, Transaction, TransactionOutput, TransactionOutputs, AddressInput } from '../transactions';
import { Block } from '../ethereumTypes';

import { purgeDatabase } from '../dynamo';
import { purgeQueue } from '../sqs';
import { sendMessage } from '../sns';

import { txMockService } from './txMockService';
import { txFetchService } from './txFetchService';
import { storeService } from './storeService';
import { queryService } from './queryService';

export const description = 'Transaction test pipeline';
export const options: Option[] = [
	{ option: '--tx-mock-service-host <host>', description: 'Bind txMockService to this host', defaultValue: config.MOCKSERVICE_HOST },
	{ option: '--tx-mock-service-port <port>', description: 'Bind txMockService to this port', defaultValue: String(config.MOCKSERVICE_PORT) },
	{ option: '--query-service-host <host>', description: 'Bind queryService to this host', defaultValue: config.QUERYSERVICE_HOST },
	{ option: '--query-service-port <port>', description: 'Bind queryService to this port', defaultValue: String(config.QUERYSERVICE_PORT) },
	{ option: '-f, --filename <file>', description: 'Load test data from file <file>', defaultValue: './testData/transactions.json' },
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

	const transactions = getTransactions(testData.fixtures);
	const queries = testData.queries;

	await purgeQueue(ADDRESS_QUEUE);
	await purgeQueue(TRANSACTION_QUEUE);

	test('txFetchService', async (test) => {
		test.plan(transactions.length);

		config.AWS_DYNAMO_TABLE = ADDRESS_TABLE;
		config.AWS_SQS_QUEUE_URL = ADDRESS_QUEUE;
		config.AWS_SNS_TOPIC = TRANSACTION_TOPIC;
		config.ETHEREUM_URL = `http://${txMockServiceHost}:${txMockServicePort}/ethereum`;
		config.ETHERSCAN_URL = `http://${txMockServiceHost}:${txMockServicePort}/etherscan`;

		await purgeDatabase('address');
		await sendMessage({ address: '0x0000000000000000000000000000000000000001', enabled: true }, undefined, ADDRESS_TOPIC);

		txMockService(Math.floor(testData.fixtures.length / 2), testData.fixtures, txMockServiceHost, txMockServicePort, (server) => {
			txFetchService({
				stopPredicate: () => {
					if (allDataPassed('sentToQueue', transactions)) {
						server.close();
						return true;
					} else {
						return false;
					}
				},
				txSaved: (transaction) => checkAndMarkData('sentToQueue', test, transactions, transaction)
			});
		});
	});

	test('storeService', async (test) => {
		test.plan(transactions.length);

		config.AWS_DYNAMO_TABLE = TRANSACTION_TABLE;
		config.AWS_SQS_QUEUE_URL = TRANSACTION_QUEUE;
		config.AWS_SNS_TOPIC = STORE_TOPIC;

		storeService({
			stopPredicate: () => allDataPassed('sentToDB', transactions),
			nextThenHandler: (transaction) => checkAndMarkData('sentToDB', test, transactions, transaction),
			nextErrorHandler: (error) => test.fail(error),
			errorHandler: (error) => test.fail(error),
			completeHandler: () => test.end()
		});
	});

	test('queryService', (test) => {
		test.plan(queries.length);

		config.AWS_ELASTIC_HOST = ELASTIC_HOST;

		const server = queryService(queryServiceHost, queryServicePort, () => {
			const client = new GraphQLClient(`http://${queryServiceHost}:${queryServicePort}/graphql`);
			client.request<TransactionOutputs>(`query MyQuery($addresses: [AddressInput]) {
				getAddressTransactions(addresses: $addresses) {
					address,
					receivedCount,
					receivedAmount,
					sentCount,
					sentAmount
				}
			}`, { addresses: R.map(R.prop('query'), queries) })
			.then((data) => {
				server.close();
				const results = data.getAddressTransactions;
				queries.forEach((query, i) => test.same(results[i], query.result, `address=${results[i].address}, receivedAmount=${results[i].receivedAmount}, receivedCount=${results[i].receivedCount}, sentAmount=${results[i].sentAmount}, sentCount=${results[i].sentCount}`));
				test.end();
			}).catch((error) => {
				server.close();
				test.fail(error);
			});
		});
	});
}

const checkedIndexes = {
	sentToQueue: new Set(),
	sentToDB: new Set(),
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
		checkedIndexes[mark].add(index);
		test.same(transaction, transactions[index], `${mark}: timeStamp=${transaction.timeStamp}, from=${transaction.from}, to=${transaction.to}, value=${transaction.value}`);
	}
}

function allDataPassed(mark: string, transactions: Transaction[]) {
	return checkedIndexes[mark].size >= transactions.length ? true : false;
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

export function getBlockTransactionHash(block: Block, index: number) {
	return `0x0000000000000000000000000000000000${String(Number(block.number)).padStart(2, '0')}${String(index).padStart(4, '0')}`;
}
