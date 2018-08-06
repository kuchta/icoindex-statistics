import * as readline from 'readline';

import R from 'ramda';
import moment from 'moment';

import logger from '../logger';
import config from '../config';
import { MyError } from '../errors';
import { Option, Address, AddressMessage, MessageAttributes, Transaction } from '../interfaces';
import { putItem } from '../dynamo';
import { receiveMessage, deleteMessage } from '../sqs';
import { sendMessage } from '../sns';
import { Addresses } from '../addresses';
import { getLatestBlockNumber, getBlock, getAddressTransactions } from '../ethereum';
import { ESTransaction } from '../etherscan';

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
	logger.info1('addresses', addresses.getAll());

	let startTime;
	let time;

	while (true) {
		startTime = Date.now();

		try {
			if (process.exitCode !== undefined) {
				break;
			}

			/* Check to see if there are new address in the queue and process it */
			await checkAddressQueue();

			if (process.exitCode !== undefined) {
				break;
			}

			/* Finish loading uncompleted addresses */
			await loadUncompletedAddresses();

			if (process.exitCode !== undefined) {
				break;
			}

			/* First sync all addresses to latest block */
			await syncAddresses();
		} catch (error) {
			logger.error('Error', error);
		}

		time = 10000 - (Date.now() - startTime);

		if (time > 0 && process.exitCode === undefined) {
			// process.on('beforeExit', () => return);
			logger.debug(`sleeping for ${time / 1000} sec`);
			await sleep(time);
		}
	}
}

async function checkAddressQueue() {
	logger.info1('Checking queue for new addresses');

	const message = await receiveMessage<AddressMessage>();

	if (message && message.body) {
		if (!message.body.hasOwnProperty('address')) {
			logger.warning(`Message doesn't contain required attribute "address"`, message.body);
		} else if (!message.body.hasOwnProperty('enabled')) {
			logger.warning(`Message doesn't contain required attribute "enabled"`, message.body);
		} else {
			logger.info(`Request for ${message.body.enabled ? 'enabling' : 'disabling'} address "${message.body.address}"`);
			try {
				if (message.body.enabled) {
					addresses.enable(message.body.address);
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
	const uncompletedAddreses = Object.values(addresses.getUncompletedEnabled());

	if (uncompletedAddreses.length > 0) {
		logger.info('completeAddresses: Loading uncompleted history for addresses', uncompletedAddreses);
		for (const address of uncompletedAddreses) {
			await fetchAddressHistory(address);
		}
	}
}

async function fetchAddressHistory(address: Address) {
	logger.info(`Fetching history for address "${address.address}"`);

	if (!address.enabled || address.lastBlock == null) {
		return;
	}

	let value;
	let blockHeight;
	let transaction;

	try {
		do {
			const response = await getAddressTransactions(address.address, address.lastBlock + 1);

			logger.info(`Retrieved transaction history for address ${address.address} after block #${address.lastBlock + 1} containing ${response.transactions.length} transactions`);

			for (transaction of response.transactions) {
				value = parseInt(transaction.value);
				blockHeight = parseInt(transaction.blockNumber);
				saveTransaction({
					uuid: transaction.hash,
					datetime: new Date(parseInt(transaction.timeStamp) * 1000).toISOString(),
					blockHeight,
					value,
					from: transaction.from,
					to: transaction.to
				}, true);
				address.lastBlock = blockHeight;
			}

			if (response.last) {
				delete address.lastBlock;
				address.loadTime = Date.now() - new Date(address.enabledTime).valueOf();
				logger.info(`History of address ${address.address} fetched in ${moment.duration(address.loadTime).humanize()}`);
				generateAddressTransactionHistoryStoredEvent(address.address);
			}
			putItem(address);
		} while (address.lastBlock !== undefined && process.exitCode === undefined);
	} catch (error) {
		logger.error('fetchAddressHistory error:', error);
	}
}

async function syncAddresses() {
	const latestBlock = await getLatestBlockNumber();

	if (latestBlock <= addresses.lastBlock) {
		return;
	}

	const enabledAddresses = addresses.getCompletedEnabled();

	if (R.isEmpty(enabledAddresses)) {
		return;
	}

	logger.info(`Synchronizing addresses to latest block #${latestBlock} from block #${addresses.lastBlock} (${latestBlock - addresses.lastBlock} blocks remaining)`);

	const upToBlock = addresses.lastBlock + 10;

	let block;
	let value;
	for (let blockNumber = addresses.lastBlock + 1; blockNumber <= upToBlock && blockNumber <= latestBlock && process.exitCode === undefined; blockNumber++) {
		try {
			block = await getBlock(blockNumber, true);
			logger.info1(`Procesing block #${blockNumber} containing ${block.transactions.length} transactions`);
			for (const transaction of block.transactions) {
				value = parseFloat(transaction.value);
				if (value > 0 && (enabledAddresses.hasOwnProperty(transaction.from) || enabledAddresses.hasOwnProperty(transaction.to))) {
					saveTransaction({
						uuid: transaction.hash,
						blockHeight: blockNumber,
						datetime: (new Date(block.timestamp * 1000)).toISOString(),
						value: value,
						from: transaction.from,
						to: transaction.to
					});
				}
			}
			addresses.lastBlock = blockNumber;
		} catch (error) {
			logger.error('syncAddresses error:', error);
			logger.debug('block', block);
		}
	}
}

async function saveTransaction(transaction: Transaction, historical = false, lastHistoricalTransactionOfAddress?: string) {
	logger.info1(`Saving ${historical ? 'historical' : 'current' } transaction ${transaction.uuid} from block #${transaction.blockHeight}`);

	try {
		await sendMessage(transaction, { historical });
	} catch (error) {
		logger.error(`${historical ? 'fetchAddressHistory' : 'syncAddresses'} saveTransaction error`, error);
	}
}

async function generateAddressTransactionHistoryStoredEvent(address: string) {
	logger.info1(`Generating address transaction history stored event for address: "${address}"`);

	try {
		await sendMessage({}, { storeEvent: { addressTransactionHistoryStored: address } });
	} catch (error) {
		logger.error('generateAddressHistoryStoredEvent error', error);
	}
}

async function sleep(timeout: number) {
	return new Promise(resolve => setTimeout(resolve, timeout));
}
