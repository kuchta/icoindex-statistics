import R from 'ramda';

import ethers, { providers } from 'ethers';

import logger from '../logger';
import { Option, AddressMap, AddressMessage, Transaction } from '../interfaces';
import { putItem, scan } from '../dynamo';
import { receiveMessage, deleteMessage } from '../sqs';
import { sendMessage } from '../sns';
import BlockCypher, { AddressOptions, Address as BcAddress } from '../blockcypher';

export const description = 'Fetch address transactions';
export const options: Option[] = [
];

let addresses: AddressMap;

let client: any = null;

function getClient(): providers.Provider {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating Ethereum client...`);
		client = new ethers.providers.InfuraProvider();
		return client;
	}
}

export default async function main(/* options: any */) {
	addresses = await scan('address') as AddressMap;
	logger.info('addresses', addresses);

	while (process.exitCode === undefined) {
		let startTime = Date.now();

		try {
			let latestBlock = await getClient().getBlockNumber();

			/* Check to see if there are new address in the queue and process it */
			await checkAddressQueue(latestBlock);

			/* Finish loading uncompleted addresses */
			await loadUncompletedAddresses();

			/* First sync all addresses to latest block */
			await syncAddresses(latestBlock);

		} catch (error) {
			logger.error('Error', error);
		}

		let time = Date.now() - startTime;

		if (10 * 1000 - time > 0 && process.exitCode === undefined) {
			// process.on('beforeExit', () => return);
			logger.debug(`sleeping for ${time / 1000} sec`);
			await sleep(time);
		}
	}
}

async function checkAddressQueue(latestBlockNumber: number) {
	logger.info('Checking queue for new addresses');

	let message = await receiveMessage<AddressMessage>();

	logger.debug('message:', message);

	if (message && message.body) {
		if (!message.body.address) {
			logger.warning(`Message doesn't contain required attribute "address"`, message.body);
		} else if (!message.body.enabled) {
			logger.warning(`Message doesn't contain required attribute "enabled"`, message.body);
		} else {
			let { address, enabled } = message.body;
			if (enabled && address in addresses && addresses[address].enabled) {
				logger.warning('checkAndLoadNewAddresses: Requested to enable address already enabled. Skipping...');
			} else if (!enabled && !(address in addresses && addresses[address].enabled)) {
				logger.warning('checkAndLoadNewAddresses: Requested to disable address not enabled. Skipping...');
			} else {
				try {
					if (enabled) {
						/* Enabling address */
						addresses[address] = {
							address,
							enabled: true,
							firstBlock: latestBlockNumber,
							complete: false
						};
						await fetchAddressHistory(address);
					} else {
						/* Disabling address */
						delete addresses[address];
					}
					deleteMessage(message.receiptHandle);
					putItem(addresses[address]);
				} catch (error) {
					logger.error('checkAddressQueue failed', error);
				}
			}
		}
	}
}

async function loadUncompletedAddresses() {
	let uncompletedAddreses = R.filter(address => !address.complete, addresses);
	let uncompletedAddresesA = Object.values(uncompletedAddreses);

	if (uncompletedAddresesA.length > 0) {
		logger.info1('completeAddresses: Loading uncompleted history for addresses', Object.keys(uncompletedAddreses));
		uncompletedAddresesA.forEach(addressObj => fetchAddressHistory(addressObj.address), uncompletedAddreses);
	}
}

const blockCypher = new BlockCypher('eth', 'main');
const RECORDS_PER_PAGE = 2000;

async function fetchAddressHistory(address: string) {
	logger.info(`Fetching history for address: ${address}`);

	let addressObj: BcAddress;
	const params: AddressOptions = { limit: 2000, confirmations: 1 };

	let i = 0;
	do {
		addressObj = await blockCypher.getAddress(address, { ...params, before: addresses[address].firstBlock });

		logger.info(`Fetching adress ${address}: Page ${++i}/${Math.ceil(addressObj.n_tx / RECORDS_PER_PAGE)}  ${addressObj.txrefs.length} transactions before block #${addresses[address].firstBlock}`);

		addressObj.txrefs.forEach((tx) => {
			try {
				saveTransaction({
					id: tx.tx_hash,
					address,
					blockHeight: tx.block_height,
					datetime: tx.confirmed,
					value: tx.value
				} as Transaction);
				addresses[address].firstBlock = tx.block_height;
			} catch (error) {
				logger.error('loadNewAddress: saving transaction failed:', error);
			}
		});

		if (!addressObj.hasMore) {
			addresses[address].complete = true;
		}
	} while (addressObj.hasMore || process.exitCode === undefined);
}



async function syncAddresses(latestBlock: number) {
	logger.info(`Synchronizing addresses to latest block #${latestBlock} from block #${addresses.lastBlock}`);

	let client = getClient();

	try {
		R.range(addresses.lastBlock, latestBlock).forEach(async (blockNumber) => {
			let block = await client.getBlock(blockNumber);
			logger.info(`Procesing block #${blockNumber} containing #${block.transactions.length}`);
			block.transactions.forEach(async (txid) => {
				let transaction = await client.getTransaction(txid);
				if (transaction.from in addresses) {
					saveTransaction({
						id: transaction.hash,
						address: transaction.from,
						blockHeight: blockNumber,
						datetime: (new Date(block.timestamp * 1000)).toISOString(),
						value: -transaction.value.toNumber()
					} as Transaction);
				}
				if (transaction.to in addresses) {
					saveTransaction({
						id: transaction.hash,
						address: transaction.to,
						blockHeight: blockNumber,
						datetime: (new Date(block.timestamp * 1000)).toISOString(),
						value: transaction.value.toNumber()
					} as Transaction);
				}
			});
		});
	} catch (error) {
		logger.error('syncAddresses error:', error);
	}
}

function saveTransaction(transaction: Transaction) {
	logger.info1('loadNewAddress: saving transaction', transaction);
	sendMessage(transaction);
}

async function sleep(timeout: number) {
	return new Promise(resolve => setTimeout(resolve, timeout));
}
