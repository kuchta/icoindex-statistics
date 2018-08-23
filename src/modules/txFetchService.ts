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

export const description = 'Transaction Fetch Service';
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

export async function txFetchService({ purgeDatabase = false, purgeQueue = false, stopPredicate = () => false, txSaved = (transaction) => null, complete = () => null }: {
		purgeDatabase?: boolean,
		purgeQueue?: boolean,
		stopPredicate?: () => boolean,
		txSaved?: (transaction: Transaction) => void,
		complete?: () => void } = {}) {

	stopPred = stopPredicate;
	txSav = txSaved;

	latestBlock = await getLatestBlockNumber();

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
	let unspentBlockTime;

	let enabledUncompletedAddreses;
	let enabledCompletedAddresses;

	while (!shouldExit()) {
		startTime = Date.now();

		try {
			enabledUncompletedAddreses = Object.values(getEnabledUncompletedAddresses());
			enabledCompletedAddresses = getEnabledCompletedAddresses();

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

			if (enabledUncompletedAddreses.length > 0) {
				for (const address of enabledUncompletedAddreses) {
					await fetchAddressHistory(address);
				}
			}

			if (enabledCompletedAddresses && !R.isEmpty(enabledCompletedAddresses)) {
				await syncAddresses(enabledCompletedAddresses);
			}

			await checkAddressQueue();
		} catch (error) {
			logger.error('Error', error);
		} finally {
			unspentBlockTime = 10000 - (Date.now() - startTime);

			if (unspentBlockTime > 0 && latestBlock === lastBlock && R.isEmpty(enabledUncompletedAddreses) && !shouldExit()) {
				logger.debug(`sleeping for ${unspentBlockTime / 1000} seconds`);
				await sleep(unspentBlockTime);
			}
		}
	}
	complete();
	logger.info('txFetchService finished');
}

async function fetchAddressHistory(address: Address) {
	if (!address.enabled || address.lastBlock === undefined || address.lastBlock + 1 > lastBlock) {
		return;
	}

	logger.info(`Fetching history for address "${address.address}"`);

	try {
		let value;
		let blockNumber;
		let transaction;
		let i = 10;
		let startTime;
		let fromBlock = address.lastBlock + 1;
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

			logger.debug(`Transaction history of address ${address.address} from block #${fromBlock} to block #${lastBlock} containing ${transactions.length} transactions retrieved and processed in ${humanizeDuration(Date.now() - startTime)}`);

			if (transactions.length < 10000) {
				delete address.lastBlock;
				address.loadTime = Date.now() - Date.parse(address.enabledTime);
				logger.info1(`History of address ${address.address} retrieved in ${humanizeDuration(address.loadTime)}`);
				generateAddressTransactionHistoryStoredEvent(address.address);
			}
			putItem(address);

		}
	} catch (error) {
		logger.error('fetchAddressHistory error', error);
	}
}

async function syncAddresses(enabledAddresses: R.Dictionary<Address>) {
	if (lastBlock >= latestBlock) {
		return;
	}

	const fromBlock = lastBlock + 1;
	const toBlock = fromBlock + 9 < latestBlock ? fromBlock + 9 : latestBlock;

	const remainingBlocks = latestBlock - toBlock;
	const averageBlockTime = getAverageBlockTime();
	logger.info(`Synchronizing addresses from block #${fromBlock} to block #${toBlock}: ${remainingBlocks} blocks remaining${remainingBlocks && averageBlockTime ? ' (' + humanizeDuration(remainingBlocks * averageBlockTime) + ')' : ''}`);

	let block;
	let transaction;

	try {
		let startTime;
		let blockTime;
		let value;

		for (let blockNumber = fromBlock; blockNumber <= toBlock && !shouldExit(); blockNumber++) {
			startTime = Date.now();

			block = await getBlock(blockNumber, true);

			// logger.debug(`API Request took ${Date.now() - startTime} ms`);
			for (transaction of block.transactions) {
				if (typeof transaction === 'object') {
					// value = parseFloat(transaction.value);
					value = transaction.value.toNumber();
					if (value > 0 && (enabledAddresses.hasOwnProperty(transaction.from) || (transaction.to && enabledAddresses.hasOwnProperty(transaction.to)))) {
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

			logger.info1(`Block #${blockNumber} containing ${block.transactions.length} transactions retrieved and processed in ${humanizeDuration(blockTime)}`);
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
				} else if (!message.body.enabled) {
					logger.warning(`Message body doesn't contain required attribute "enabled"`, message.body);
				} else {
					logger.info(`Request for ${message.body.enabled ? 'enabling' : 'disabling'} address "${message.body.address}"`);
					try {
						if (message.body.enabled) {
							enableAddress(message.body.address);
						} else {
							disableAddress(message.body.address);
						}
					} catch (error) {
						logger.error(`checkAddressQueue: ${message.body.enabled ? 'enabling' : 'disabling'} address failed`, error);
					}
				}
				deleteMessage(message.receiptHandle);
			}
		}
	} catch (error) {
		logger.error('checkAddressQueue failed', error);
	}
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
	const addressObj = addresses[address];
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

function setLastBlock(num: number) {
	lastBlock = num;
	putItem({ address: 'lastBlock', value: lastBlock });
}

const last100BlockTimes: number[] = [];
function updateAverageBlockTime(time: number) {
	last100BlockTimes.push(time);
	if (last100BlockTimes.length > 100) {
		last100BlockTimes.shift();
	}
}

function humanizeDuration(time: number) {
	const duration = moment.duration(time);
	if (duration.years()) {
		return `${duration.years()} years and ${duration.months()} months`;
	} else if (duration.months()) {
		return `${duration.months()} months and ${duration.days()} days`;
	} else if (duration.days()) {
		return `${duration.days()} days and ${duration.hours()} hours`;
	} else if (duration.hours()) {
		return `${duration.hours()} hours and ${duration.minutes()} minutes`;
	} if (duration.minutes()) {
		return `${duration.minutes()} minutes and ${duration.seconds()} seconds`;
	} if (duration.seconds()) {
		return `${duration.seconds()} seconds and ${duration.milliseconds()} ms`;
	} else {
		return `${duration.milliseconds()} ms`;
	}
}

function getAverageBlockTime() {
	return last100BlockTimes.length > 0 ? last100BlockTimes.reduce((acc, val) => acc + val) / last100BlockTimes.length : null;
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
