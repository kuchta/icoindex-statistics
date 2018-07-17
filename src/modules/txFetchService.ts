import * as readline from 'readline';

import R from 'ramda';
import Web3 from 'web3';

import logger from '../logger';
import config from '../config';
import { Option, AddressMap, AddressMessage, Transaction } from '../interfaces';
import { putItem, scan } from '../dynamo';
import { receiveMessage, deleteMessage } from '../sqs';
import { sendMessage } from '../sns';
import BlockCypher, { AddressOptions, Address as BcAddress } from '../blockcypher';

export const description = 'Fetch address transactions';
export const options: Option[] = [
];

let addresses: AddressMap;
let lastBlock: number;

const web3 = new Web3(new Web3.providers.HttpProvider(config.ETHEREUM_HOST));

process.on('SIGQUIT', () => {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	logger.info('addresses', addresses);
});

export default async function main(/* options: any */) {
	// let latestBlock = await getClient().getBlockNumber();
	let latestBlock = await web3.eth.getBlockNumber();

	await init(latestBlock);

	while (true) {
		let startTime = Date.now();

		// latestBlock = await web3.eth.getBlockNumber();

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

		// latestBlock = await getClient().getBlockNumber();
		// latestBlock = await web3.eth.getBlockNumber();
	}
}

async function init(latestBlock: number) {
	addresses = await scan('address') as AddressMap;
	if ('lastBlock' in addresses && addresses.lastBlock.value) {
		lastBlock = addresses.lastBlock.value;
		delete addresses.lastBlock;
	} else {
		lastBlock = latestBlock;
		R.forEachObjIndexed<AddressMap>((address) => {
			address.firstBlock = lastBlock;
			address.complete = false;
		}, addresses);
		putItem({ address: 'lastBlock', value: lastBlock });
	}
	logger.info(`lastBlock: ${lastBlock}`);
	logger.info('addresses', addresses);
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
				let { address, enabled } = message.body;
				if (enabled && address in addresses && addresses[address].enabled) {
					logger.warning('checkAndLoadNewAddresses: Requested to enable address already enabled. Skipping...');
				} else if (!enabled && !(address in addresses && addresses[address].enabled)) {
					logger.warning('checkAndLoadNewAddresses: Requested to disable address not enabled. Skipping...');
				} else if (!web3.utils.isAddress(address)) {
					logger.warning(`checkAndLoadNewAddresses: Address ${address} is not valid Ethereum address. Skipping...`);
				} else {
					if (enabled) {
						if (address in addresses && addresses[address].enabled) {
							logger.warning(`address ${address} already enabled`);
						} else {
							/* Enabling address */
							addresses[address] = {
								address,
								enabled: true,
								firstBlock: lastBlock,
								complete: false
							};
							putItem(addresses[address]);
							await fetchAddressHistory(address);
						}
					} else {
						if (address in addresses && !addresses[address].enabled) {
							logger.warning(`address ${address} already disabled`);
						} else {
							/* Disabling address */
							addresses[address].enabled = false;
							addresses[address].lastBlock = lastBlock;
							putItem(addresses[address]);
						}
					}
				}
				deleteMessage(message.receiptHandle);
			} catch (error) {
				logger.error('checkAddressQueue failed', error);
			}
		}
	}
}

async function loadUncompletedAddresses() {
	let uncompletedAddreses = Object.keys(R.filter(address => !address.complete, addresses));

	if (uncompletedAddreses.length > 0) {
		logger.info('completeAddresses: Loading uncompleted history for addresses', uncompletedAddreses);
		for (let address of uncompletedAddreses) {
			await fetchAddressHistory(address);
		}
	}
}

const blockCypher = new BlockCypher('eth', 'main');
const RECORDS_PER_PAGE = 2000;

async function fetchAddressHistory(address: string) {
	logger.info(`Fetching history for address "${address}"`);

	let addressObj: BcAddress;
	const params: AddressOptions = { limit: 2000 };

	let i = 0;
	do {
		addressObj = await blockCypher.getAddress(address, { ...params, before: addresses[address].firstBlock });

		logger.info(`Fetching history for address ${address} before block #${addresses[address].firstBlock}: Page ${++i}/${Math.ceil(addressObj.n_tx / addressObj.txrefs.length)} containing ${addressObj.txrefs.length} transactions`);

		// logger.debug('txrefs', addressObj.txrefs);

		for (let transaction of addressObj.txrefs) {
			try {
				await saveTransaction({
					id: transaction.tx_hash,
					address,
					blockHeight: transaction.block_height,
					datetime: transaction.confirmed,
					value: transaction.value
				} as Transaction);
				addresses[address].firstBlock = transaction.block_height;
			} catch (error) {
				logger.error('loadNewAddress: saving transaction failed:', error);
			}
		}

		if (!addressObj.hasMore) {
			addresses[address].complete = true;
		}
		putItem(addresses[address]);
	} while (addressObj.hasMore && process.exitCode === undefined);
}

async function syncAddresses() {
	let latestBlock = await web3.eth.getBlockNumber();

	if (latestBlock <= lastBlock) {
		return;
	}

	logger.info(`Synchronizing addresses to latest block #${latestBlock} from block #${lastBlock}`);

	let upToBlock = lastBlock + 10;

	for (let blockNumber = lastBlock + 1; blockNumber <= upToBlock && blockNumber <= latestBlock && process.exitCode === undefined; blockNumber++) {
		// logger.debug(`blockNumber: ${blockNumber}, lastBlock + 10: ${lastBlock + 10}`);
		try {
			// let block = await client.getBlock(blockNumber);
			let block = await web3.eth.getBlock(blockNumber, true);
			logger.info(`Procesing block #${blockNumber} containing ${block.transactions.length} transactions`);
			for (let transaction of block.transactions) {
				// let transaction = await client.getTransaction(txid);
				if (transaction.from in addresses && addresses[transaction.from].enabled) {
					saveTransaction({
						id: transaction.hash,
						address: transaction.from,
						blockHeight: blockNumber,
						datetime: (new Date(block.timestamp * 1000)).toISOString(),
						value: -parseFloat(transaction.value)
					} as Transaction);
				}
				if (transaction.to in addresses && addresses[transaction.to].enabled) {
					saveTransaction({
						id: transaction.hash,
						address: transaction.to,
						blockHeight: blockNumber,
						datetime: (new Date(block.timestamp * 1000)).toISOString(),
						value: parseFloat(transaction.value)
					} as Transaction);
				}
			}
			updateLastBlock(blockNumber);
		} catch (error) {
			logger.error('syncAddresses error:', error);
		}
	}
}

function updateLastBlock(blockNumber: number) {
	// logger.debug(`Updating last block #${blockNumber}`);
	lastBlock = blockNumber;
	putItem({ address: 'lastBlock', value: lastBlock });
}

function saveTransaction(transaction: Transaction) {
	logger.info1(`saving transaction ${transaction.id} from block #${transaction.blockHeight}`);
	sendMessage(transaction);
}

async function sleep(timeout: number) {
	return new Promise(resolve => setTimeout(resolve, timeout));
}
