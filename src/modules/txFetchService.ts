import * as readline from 'readline';

import R from 'ramda';
import moment from 'moment';
// import { TransactionObject } from 'eth-connect/dist/Schema';

import { MyError } from '../errors';
import { Option, MessageAttributes } from '../interfaces';
import { AddressMap, Address, AddressMessage, Transaction } from '../transactions';

import config from '../config';
import logger from '../logger';
import { humanizeDuration } from '../utils';
import { scan, purgeDatabase as purgeD, putItem, deleteItem } from '../dynamo';
import { purgeQueue as purgeQ, receiveMessage, deleteMessage } from '../sqs';
import { sendMessage } from '../sns';
import { getLatestBlockNumber, getBlock, getAddressTransactions, isAddress } from '../ethereum';

export const description = 'Transaction Fetch Service';
export const options: Option[] = [
	{ option: '-U, --make-completed-uncompleted', description: 'Make completed addresses uncompleted' },
	{ option: '-D, --purge-database', description: 'Purge database' },
	{ option: '-Q, --purge-queue', description: 'Purge queue' },
];

const MAX_NUMBER_OF_HISTORY_CALLS_PER_CYCLE = config.MAX_NUMBER_OF_HISTORY_CALLS_PER_CYCLE || 10;
const MAX_NUMBER_OF_CURRENT_CALLS_PER_CYCLE = config.MAX_NUMBER_OF_CURRENT_CALLS_PER_CYCLE || 10;

const WAIT_TIME = 10000;

let latestBlock: number;
let lastBlock: number | undefined;
let stopPred: () => boolean;
let txSav: (transaction: Transaction) => void;

let addresses: AddressMap;

export default function main(options: { [key: string]: string }) {
	txFetchService({ makeCompletedUncompleted: Boolean(options.makeCompletedUncompleted), purgeDatabase: Boolean(options.purgeDatabase), purgeQueue: Boolean(options.purgeQueue) });
}

export async function txFetchService({ makeCompletedUncompleted = false, purgeDatabase = false, purgeQueue = false, stopPredicate = () => false, txSaved = (transaction) => null, complete = () => null }: {
		makeCompletedUncompleted?: boolean,
		purgeDatabase?: boolean,
		purgeQueue?: boolean,
		stopPredicate?: () => boolean,
		txSaved?: (transaction: Transaction) => void,
		complete?: () => void } = {}) {

	stopPred = stopPredicate;
	txSav = txSaved;

	if (purgeDatabase) {
		await purgeD('address');
		logger.warning('Address database purged');
	}

	if (purgeQueue) {
		await purgeQ();
		logger.warning('Address queue purged');
	}

	addresses = await scan('address') as AddressMap;

	if (addresses.lastBlock && addresses.lastBlock.value) {
		lastBlock = addresses.lastBlock.value;
	}

	if (makeCompletedUncompleted) {
		if (!lastBlock) {
			logger.error('Last block must be set to make completed addresses uncompleted');
		} else {
			doMakeCompletedUncompleted(addresses, lastBlock);
		}
	}

	latestBlock = await getLatestBlockNumber();

	let startTime;
	let unspentTime;

	let enabledUncompletedAddreses: AddressMap;
	let enabledCompletedAddresses: AddressMap;

	while (!shouldExit()) {
		startTime = Date.now();
		try {
			enabledUncompletedAddreses = getEnabledUncompletedAddresses(addresses);
			enabledCompletedAddresses = getEnabledCompletedAddresses(addresses);

			if (R.isEmpty(enabledCompletedAddresses)) {
				if (R.isEmpty(enabledUncompletedAddreses)) {
					if (lastBlock) {
						setLastBlock(undefined);
					}
				} else {
					setLastBlock(latestBlock);
				}
			}

			reportLastestBlock();

			if (!R.isEmpty(enabledCompletedAddresses)) {
				await syncAddresses(enabledCompletedAddresses);
			}

			if (!R.isEmpty(enabledUncompletedAddreses)) {
				for (const address in enabledUncompletedAddreses) {
					await fetchAddressHistory(enabledUncompletedAddreses[address]);
				}
			}

			await checkAddressQueue();

			if (lastBlock && lastBlock >= latestBlock) {
				latestBlock = await getLatestBlockNumber();
			}
		} catch (error) {
			logger.error('Error', error);
		} finally {
			unspentTime = WAIT_TIME - (Date.now() - startTime);

			if (unspentTime > 0 && (!lastBlock || latestBlock === lastBlock) && R.isEmpty(getEnabledUncompletedAddresses(addresses)) && !shouldExit()) {
				logger.debug(`sleeping for ${unspentTime / 1000} seconds`);
				await sleep(unspentTime);
			}

			logger.debug('tick');
		}
	}
	complete();
	logger.info('txFetchService finished');
}

async function fetchAddressHistory(address: Address) {
	if (!lastBlock || address.lastBlock === undefined || address.lastBlock + 1 > lastBlock) {
		logger.debug('fetchAddressHistory: Nothing to do');
		return;
	}

	logger.info(`Fetching history for address "${address.address}"`);

	try {
		let value;
		let blockNumber;
		let transaction;
		let startTime;
		let fromBlock = address.lastBlock + 1;
		let i = MAX_NUMBER_OF_HISTORY_CALLS_PER_CYCLE;
		while (address.lastBlock !== undefined && i-- > 0 && !shouldExit()) {
			startTime = Date.now();

			const transactions = await getAddressTransactions(address.address, address.lastBlock + 1, lastBlock);

			for (transaction of transactions) {
				value = parseInt(transaction.value);
				blockNumber = parseInt(transaction.blockNumber);
				if (value !== 0) {
					await saveTransaction({
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

			logger.info(`Transaction history of address ${address.address} from block #${fromBlock} to block #${address.lastBlock} containing ${transactions.length} transactions retrieved and processed in ${humanizeDuration(Date.now() - startTime)}`);

			if (transactions.length < 10000) {
				address.loadTime = Date.now() - Date.parse(address.enabledTime);
				delete address.lastBlock;
				logger.info1(`History of address ${address.address} retrieved in ${humanizeDuration(address.loadTime)}`);
				generateAddressTransactionHistoryStoredEvent(address.address);
			}
			putItem(address);
		}
	} catch (error) {
		logger.error('fetchAddressHistory error', error);
	}
}

async function syncAddresses(enabledAddresses: AddressMap) {
	if (!lastBlock || lastBlock >= latestBlock) {
		logger.debug('syncAddresses: Nothing to do');
		return;
	}

	const fromBlock = lastBlock + 1;
	const toBlock = fromBlock + MAX_NUMBER_OF_CURRENT_CALLS_PER_CYCLE < latestBlock ? fromBlock + MAX_NUMBER_OF_CURRENT_CALLS_PER_CYCLE : latestBlock;

	const remainingBlocks = latestBlock - toBlock;
	const averageBlockTime = getAverageBlockTime();

	let msg = `Synchronizing addresses from block #${fromBlock} to block #${toBlock}`;
	if (remainingBlocks) {
		msg += `: ${remainingBlocks} blocks remaining`;
	}
	if (remainingBlocks && averageBlockTime) {
		msg += ` (${humanizeDuration(remainingBlocks * averageBlockTime)})`;
	}
	logger.info(msg);

	let block;
	let transaction;

	try {
		let startTime;
		let blockTime;
		let value;

		for (let blockNumber = fromBlock; blockNumber <= toBlock && !shouldExit(); blockNumber++) {
			startTime = Date.now();

			block = await getBlock(blockNumber, true);

			if (!block) {
				logger.warning('syncAddresses: getBlock returned null');
				return;
			}

			for (transaction of block.transactions) {
				if (typeof transaction === 'object') {
					// value = parseFloat(transaction.value);
					value = transaction.value.toNumber();
					if (value > 0 && (transaction.from in enabledAddresses || (transaction.to && transaction.to in enabledAddresses))) {
						await saveTransaction({
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
			blockTime = Date.now() - startTime;

			logger.info1(`Block #${blockNumber} containing ${String(block.transactions.length).padStart(3, ' ')} transactions retrieved and processed in ${String(blockTime).padStart(4, ' ')} ms`);
			updateAverageBlockTime(blockTime);
		}
	} catch (error) {
		logger.error('syncAddresses error', { error, object: { block, transaction } });
	}
}

async function checkAddressQueue() {
	try {
		const message = await receiveMessage<AddressMessage>();

		if (message) {
			if (!message.receiptHandle) {
				logger.warning(`Message doesn't contain required attribute "receiptHandle"`, message);
			} else {
				if (!message.body) {
					logger.warning(`Message doesn't contain required attribute "body"`, message);
				} else if (!message.body.address) {
					logger.warning(`Message body doesn't contain required attribute "address"`, message.body);
				} else if (message.body.enabled == null) {
					logger.warning(`Message body doesn't contain required attribute "enabled"`, message.body);
				} else {
					logger.info(`Request for ${message.body.enabled ? 'enabling' : 'disabling'} address "${message.body.address}"`);
					try {
						if (message.body.enabled) {
							await enableAddress(message.body.address);
						} else {
							disableAddress(message.body.address);
						}
					} catch (error) {
						logger.error(`checkAddressQueue: ${message.body.enabled ? 'enabling' : 'disabling'} address failed`, error);
					}
				}
				await deleteMessage(message.receiptHandle);
			}
		}
	} catch (error) {
		logger.error('checkAddressQueue failed', error);
	}
}

async function enableAddress(address: string) {
	if (!isAddress(address)) {
		throw new MyError(`Address ${address} is not valid Ethereum address. Skipping...`);
	}

	let addressObj: Address = addresses[address];
	if (addressObj) {
		if (addressObj.enabled === true) {
			throw new MyError('Requested to enable address already enabled. Skipping...');
		}
		addressObj.enabled = true;
		addressObj.enabledTime = new Date().toISOString();
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
	if (!isAddress(address)) {
		throw new MyError(`Address ${address} is not valid Ethereum address. Skipping...`);
	}

	let addressObj: Address = addresses[address];
	if (!addressObj || addressObj.enabled === false) {
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

let lastReportedLatestBlock: number;
let lastReportedLastBlock: number | undefined;

function reportLastestBlock(logLevel = 'info') {
	if (latestBlock !== lastReportedLatestBlock || lastBlock !== lastReportedLastBlock) {
		let msg = `Latest block: #${latestBlock}`;
		if (lastBlock) {
			msg += `, last processed block: #${lastBlock}`;
		}
		logger[logLevel](msg);

		lastReportedLatestBlock = latestBlock;
		lastReportedLastBlock = lastBlock;
	}
}

function setLastBlock(num?: number) {
	if (num) {
		lastBlock = num;
		putItem({ address: 'lastBlock', value: lastBlock });
	} else {
		lastBlock = undefined;
		deleteItem('address', 'lastBlock');
	}
}

const last100BlockTimes: number[] = [];
function updateAverageBlockTime(time: number) {
	last100BlockTimes.push(time);
	if (last100BlockTimes.length > 100) {
		last100BlockTimes.shift();
	}
}

function getAverageBlockTime() {
	return last100BlockTimes.length > 0 ? last100BlockTimes.reduce((acc, val) => acc + val) / last100BlockTimes.length : null;
}

function doMakeCompletedUncompleted(addresses: AddressMap, lastBlock: number) {
	R.forEachObjIndexed((address: Address) => address.lastBlock = lastBlock, getEnabledCompletedAddresses(addresses));
}

function getDisabledAddresses(addresses: AddressMap): AddressMap {
	return measureFunctionTime(getDisabledAddresses.name, R.filter((address: Address) => address.enabled !== undefined && !address.enabled), addresses);
}

function getEnabledCompletedAddresses(addresses: AddressMap): AddressMap {
	return measureFunctionTime(getEnabledCompletedAddresses.name, R.filter((address: Address) => address.enabled && address.lastBlock === undefined), addresses);
}

function getEnabledUncompletedAddresses(addresses: AddressMap): AddressMap {
	return measureFunctionTime(getEnabledUncompletedAddresses.name, R.filter((address: Address) => address.enabled && address.lastBlock !== undefined), addresses);
}

function measureFunctionTime<T>(funcName: string, func: (...args: T[]) => T, ...args: T[]) {
	const startTime = Date.now();

	const ret = func(...args);

	const filteringTime = Date.now() - startTime;
	if (filteringTime > 10) {
		logger.warning(`Filtering function ${funcName} took ${filteringTime} ms`);
	}

	return ret;
}

function shouldExit() {
	return stopPred() || process.exitCode !== undefined;
}

let timeoutId: number;

async function sleep(timeout: number) {
	return new Promise(resolve => timeoutId = setTimeout(resolve, timeout));
}

process.on('SIGINT', () => clearTimeout(timeoutId));

process.on('SIGQUIT', () => {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	reportLastestBlock('debug');
	logger.debug('addresses', {
		enabled: {
			uncompleted: getEnabledUncompletedAddresses(addresses),
			completed: getEnabledCompletedAddresses(addresses)
		},
		disabled: getDisabledAddresses(addresses)
	});
});
