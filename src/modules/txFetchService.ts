import * as readline from 'readline';

import R from 'ramda';

import logger from '../logger';
import config from '../config';
import { MyError } from '../errors';
import { Option, Address, AddressMessage, Transaction } from '../interfaces';
import { putItem } from '../dynamo';
import { receiveMessage, deleteMessage } from '../sqs';
import { sendMessage } from '../sns';
import { Addresses } from '../addresses';
import { getLatestBlockNumber, getBlock, getTransaction, getAddressTransactions, isAddress, } from '../ethereum';

export const description = 'Fetch address transactions';
export const options: Option[] = [
];

const addresses = new Addresses();

process.on('SIGQUIT', () => {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	logger.info1('addresses', addresses.getAll());
});

export default async function main(/* options: any */) {

	await addresses.init();

	logger.info(`lastBlock: ${addresses.lastBlock}`);
	logger.info('addresses', addresses.getAll());

	while (true) {
		let startTime = Date.now();

		try {
			if (process.exitCode !== undefined) {
				break;
			}

			/* Finish loading uncompleted addresses */
			await loadUncompletedAddresses();

			if (process.exitCode !== undefined) {
				break;
			}

			/* Check to see if there are new address in the queue and process it */
			await checkAddressQueue();

			if (process.exitCode !== undefined) {
				break;
			}

			/* First sync all addresses to latest block */
			await syncAddresses();
		} catch (error) {
			logger.error('Error', error);
		}

		let time = 10000 - (Date.now() - startTime);

		if (time > 0 && process.exitCode === undefined) {
			// process.on('beforeExit', () => return);
			logger.debug(`sleeping for ${time / 1000} sec`);
			await sleep(time);
		}
	}
}

async function checkAddressQueue() {
	logger.info('Checking queue for new addresses');

	let message = await receiveMessage<AddressMessage>();

	if (message && message.body) {
		logger.info(`Request for ${message.body.enabled ? 'enabling' : 'disabling'} address "${message.body.address}"`);

		if (!message.body.hasOwnProperty('address')) {
			logger.warning(`Message doesn't contain required attribute "address"`, message.body);
		} else if (!message.body.hasOwnProperty('enabled')) {
			logger.warning(`Message doesn't contain required attribute "enabled"`, message.body);
		} else {
			try {
				if (message.body.enabled) {
					addresses.enable(message.body.address);
					await fetchAddressHistory(addresses.get(message.body.address));
				} else {
					addresses.disable(message.body.address);
				}
			} catch (error) {
				logger.error('checkAddressQueue failed', error);
			}
			deleteMessage(message.receiptHandle);
		}
	}
}

async function loadUncompletedAddresses() {
	let uncompletedAddreses = addresses.getUncompleted();

	if (uncompletedAddreses.length > 0) {
		logger.info('completeAddresses: Loading uncompleted history for addresses', uncompletedAddreses);
		for (let address of uncompletedAddreses) {
			await fetchAddressHistory(address);
		}
	}
}

async function fetchAddressHistory(address: Address) {
	logger.info(`Fetching history for address "${address.address}"`);

	let transactions: Transaction[];

	let i = 0;
	try {
		do {
			transactions = await getAddressTransactions(address.address, address.firstBlock - 1);

			logger.info(`Retrieved transactions history for address ${address.address} before block #${address.firstBlock} containing ${transactions.length} transactions`);

			for (let transaction of transactions) {
				try {
					if (transaction.value > 0) {
						await saveTransaction(transaction);
						address.firstBlock = transaction.blockHeight;
					}
				} catch (error) {
					logger.error('loadNewAddress: saving transaction failed:', error);
				}
			}

			if (transactions.length <= 0) {
				address.complete = true;
			}
			putItem(address);
		} while (transactions.length && process.exitCode === undefined);
	} catch (error) {
		logger.error('fetchAddressHistory error:', error);
	}
}

async function syncAddresses() {
	let latestBlock = await getLatestBlockNumber();

	if (latestBlock <= addresses.lastBlock) {
		return;
	}

	logger.info(`Synchronizing addresses to latest block #${latestBlock} from block #${addresses.lastBlock}`);

	let upToBlock = addresses.lastBlock + 10;

	for (let blockNumber = addresses.lastBlock + 1; blockNumber <= upToBlock && blockNumber <= latestBlock && process.exitCode === undefined; blockNumber++) {
		// logger.debug(`blockNumber: ${blockNumber}, lastBlock + 10: ${lastBlock + 10}`);
		try {
			// let block = await client.getBlock(blockNumber);
			let block = await getBlock(blockNumber, true);
			logger.info(`Procesing block #${blockNumber} containing ${block.transactions.length} transactions`);
			for (let transaction of block.transactions) {
				// let transaction = await client.getTransaction(txid);
				if ((transaction.from in addresses && addresses[transaction.from].enabled)
						|| (transaction.to in addresses && addresses[transaction.to].enabled)) {
					saveTransaction({
						uuid: transaction.hash,
						from: transaction.from,
						to: transaction.to,
						blockHeight: blockNumber,
						datetime: (new Date(block.timestamp * 1000)).toISOString(),
						value: parseFloat(transaction.value)
					} as Transaction);
				}
			}
			addresses.lastBlock = blockNumber;
		} catch (error) {
			logger.error('syncAddresses error:', error);
		}
	}
}

function saveTransaction(transaction: Transaction) {
	logger.info1(`saving transaction ${transaction.uuid} from block #${transaction.blockHeight}`);
	sendMessage(transaction);
}

async function sleep(timeout: number) {
	return new Promise(resolve => setTimeout(resolve, timeout));
}
