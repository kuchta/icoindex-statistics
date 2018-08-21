import * as readline from 'readline';

import R from 'ramda';
import moment from 'moment';
import { TransactionObject } from 'eth-connect/dist/Schema';

import logger from '../logger';

import { MyError } from '../errors';
import { Option, MessageAttributes } from '../interfaces';
import { AddressMap, Address, AddressMessage, Transaction } from '../transactions';

import { scan, purgeDatabase as purgeD, putItem } from '../dynamo';
import { purgeQueue as purgeQ, receiveMessage, deleteMessage } from '../sqs';
import { sendMessage } from '../sns';
import { getLatestBlockNumber, getBlock, getAddressTransactions, isAddress } from '../ethereum';

export const description = 'Fetch address transactions';
export const options: Option[] = [
	{ option: '-D, --purge-database', description: 'Purge database' },
	{ option: '-Q, --purge-queue', description: 'Purge queue' },
];

let addresses: AddressMap;
let latestBlock: number;
let lastBlock: number;
let timeoutId: number;
let stopPred: () => boolean;
let txSav: (transaction: Transaction) => void;

process.on('SIGINT', () => clearTimeout(timeoutId));

process.on('SIGQUIT', () => {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	logger.debug('addresses', addresses);
});

export default function main(options: { [key: string]: string }) {
	txFetchService({ purgeDatabase: Boolean(options.purgeDatabase), purgeQueue: Boolean(options.purgeQueue) });
}

export async function txFetchService({ purgeDatabase = false, purgeQueue = false, stopPredicate = () => false, txSaved = (transaction) => null }: {
		purgeDatabase?: boolean,
		purgeQueue?: boolean,
		stopPredicate?: () => boolean,
		txSaved?: (transaction: Transaction) => void } = {}) {

	stopPred = stopPredicate;
	txSav = txSaved;

	latestBlock = await getLatestBlockNumber();

	if (purgeDatabase) {
		await purgeD('address');
		logger.warning('Database purged');
	}

	if (purgeQueue) {
		await purgeQ();
		logger.warning('Queue purged');
	}

	addresses = await scan('address') as AddressMap;

	if (addresses.lastBlock && addresses.lastBlock.value) {
		lastBlock = addresses.lastBlock.value;
		delete addresses.lastBlock;
	} else {
		lastBlock = latestBlock;
		R.forEachObjIndexed((address) => {
			address.lastBlock = -1;
			putItem(address);
		}, addresses);
	}

	logger.info(`Latest block: #${latestBlock}, last processed block: #${lastBlock}`);

	let lastReportedLatestBlock = latestBlock;
	let lastReportedLastBlock = lastBlock;

	let startTime;
	let time;

	let enabledUncompletedAddreses;
	let enabledCompletedAddresses;

	try {
		while (!shouldExit()) {
			startTime = Date.now();

			enabledUncompletedAddreses = Object.values(getEnabledUncompletedAddresses());

			if (enabledUncompletedAddreses.length > 0) {
				await loadUncompletedAddresses(enabledUncompletedAddreses);
			}

			enabledCompletedAddresses = getEnabledCompletedAddresses();
			if (enabledCompletedAddresses && !R.isEmpty(enabledCompletedAddresses)) {
				await syncAddresses(enabledCompletedAddresses);
			}

			if (lastBlock >= latestBlock) {
				latestBlock = await getLatestBlockNumber();
				if (!enabledCompletedAddresses || R.isEmpty(enabledCompletedAddresses)) {
					setLastBlock(latestBlock);
				}
				if (latestBlock !== lastReportedLatestBlock || lastBlock !== lastReportedLastBlock) {
					logger.info(`Latest block: #${latestBlock}, last processed block: #${lastBlock}`);

					lastReportedLatestBlock = latestBlock;
					lastReportedLastBlock = lastBlock;
				}
			}

			await checkAddressQueue();

			time = 10000 - (Date.now() - startTime);

			if (time > 0 && latestBlock === lastBlock && enabledCompletedAddresses && !R.isEmpty(enabledCompletedAddresses)) {
				logger.debug(`sleeping for ${time / 1000} sec`);
				await sleep(time);
			}
		}
	} catch (error) {
		logger.error('Error', error);
	}
}

async function loadUncompletedAddresses(addresses: Address[]) {
	logger.debug('Loading uncompleted history for addresses', addresses);
	for (const address of addresses) {
		await fetchAddressHistory(address);
	}
}

async function fetchAddressHistory(address: Address) {
	if (!address.enabled || address.lastBlock === undefined || address.lastBlock + 1 > lastBlock) {
		return;
	}

	let value;
	let blockNumber;
	let transaction;

	logger.info(`Fetching history for address "${address.address}"`);

	try {
		while (address.lastBlock !== undefined && !shouldExit()) {
			const transactions = await getAddressTransactions(address.address, address.lastBlock + 1, lastBlock);

			logger.info(`Retrieved transaction history of address ${address.address} from block #${address.lastBlock + 1} to block #${lastBlock} containing ${transactions.length} transactions`);

			for (transaction of transactions) {
				value = parseInt(transaction.value);
				blockNumber = parseInt(transaction.blockNumber);
				if (value !== 0) {
					saveTransaction({
						uuid: transaction.hash,
						blockNumber,
						timeStamp: new Date(parseInt(transaction.timeStamp) * 1000).toISOString(),
						from: transaction.from,
						to: transaction.to,
						value
					}, true);
				}
				address.lastBlock = blockNumber;
			}

			if (transactions.length < 10000) {
				delete address.lastBlock;
				address.loadTime = Date.now() - Date.parse(address.enabledTime);
				logger.info1(`History of address ${address.address} retrieved in ${moment.duration(address.loadTime).humanize()}`);
				generateAddressTransactionHistoryStoredEvent(address.address);
			}
			putItem(address);
		}
	} catch (error) {
		logger.error('fetchAddressHistory error:', error);
	}
}

async function syncAddresses(enabledAddresses: R.Dictionary<Address>) {
	if (lastBlock >= latestBlock) {
		return;
	}

	let block;
	let transaction;
	let value;

	const fromBlock = lastBlock + 1;
	const toBlock = fromBlock + 9 < latestBlock ? fromBlock + 9 : latestBlock;

	logger.info(`Synchronizing addresses from block #${fromBlock} to block #${toBlock} (${latestBlock - toBlock} blocks remaining)`);

	try {
		for (let blockNumber = fromBlock; blockNumber <= toBlock && !shouldExit(); blockNumber++) {
			block = await getBlock(blockNumber, true);
			logger.info1(`Procesing block #${blockNumber} containing ${block.transactions.length} transactions`);
			for (transaction of block.transactions) {
				if (typeof transaction === 'object') {
					// value = parseFloat(transaction.value);
					value = transaction.value.toNumber();
					if (value > 0 && (enabledAddresses.hasOwnProperty(transaction.from) || (transaction.to && enabledAddresses.hasOwnProperty(transaction.to)))) {
						saveTransaction({
							uuid: transaction.hash,
							blockNumber: blockNumber,
							timeStamp: new Date(block.timestamp * 1000).toISOString(),
							value: value,
							from: transaction.from,
							to: transaction.to || '0x0000000000000000000000000000000000000000'
						});
					}
				}
			}
			setLastBlock(blockNumber);
		}
	} catch (error) {
		logger.error('syncAddresses error:', { error, object: { block, transaction } });
	}
}

async function checkAddressQueue() {
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
					enableAddress(message.body.address);
				} else {
					disableAddress(message.body.address);
				}
			} catch (error) {
				logger.error(`checkAddressQueue failed: ${error}`);
			}
			deleteMessage(message.receiptHandle);
		}
	}
}

function setLastBlock(num: number) {
	lastBlock = num;
	putItem({ address: 'lastBlock', value: lastBlock });
}

function enableAddress(address: string) {
	if (!isAddress(address)) {
		throw new MyError(`Address ${address} is not valid Ethereum address. Skipping...`);
	}

	let addressObj: Address = addresses[address];
	if (addressObj) {
		if (addressObj.enabled) {
			throw new MyError('Requested to enable address already enabled. Skipping...');
		} else {
			addressObj.enabled = true;
			addressObj.enabledTime = new Date().toISOString();
		}
	} else {
		addressObj = {
			address,
			enabled: true,
			enabledTime: new Date().toISOString(),
			lastBlock: -1
		};
		addresses[address] = addressObj;
	}
	putItem(addressObj);
}

function disableAddress(address: string) {
	let addressObj = addresses[address];
	if (!(addressObj && addressObj.enabled)) {
		throw new MyError('Requested to disable address not enabled. Skipping...');
	}
	addressObj.enabled = false;
	addressObj.lastBlock = lastBlock;
	putItem(addressObj);
}

async function saveTransaction(transaction: Transaction, historical = false) {
	logger.info2(`Saving ${historical ? 'historical' : 'current' } transaction ${transaction.uuid} from block #${transaction.blockNumber}`, transaction);

	try {
		await sendMessage(transaction, { historical });
		txSav(transaction);
	} catch (error) {
		logger.error(`${historical ? 'fetchAddressHistory' : 'syncAddresses'} saveTransaction error`, error);
	}
}

async function generateAddressTransactionHistoryStoredEvent(address: string) {
	logger.debug(`Generating address transaction history stored event for address: "${address}"`);

	try {
		await sendMessage({}, {
			storeEvent: {
				event: 'addressTransactionHistoryStored',
				address,
			}
		});
	} catch (error) {
		logger.error('generateAddressHistoryStoredEvent error', error);
	}
}

function getEnabledAddresses() {
	return R.filter(address => address.enabled, addresses);
}

function getEnabledCompletedAddresses() {
	return R.filter(address => address.enabled && address.lastBlock === undefined, addresses);
}

function getEnabledUncompletedAddresses() {
	return R.filter(address => address.enabled && address.lastBlock !== undefined, addresses);
}

function shouldExit() {
	return stopPred() || process.exitCode !== undefined;
}

async function sleep(timeout: number) {
	return new Promise(resolve => timeoutId = setTimeout(resolve, timeout));
}
