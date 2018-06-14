import moment from 'moment';
import { Subscription, Observable, interval, pipe } from 'rxjs';
import { map, flatMap, filter, takeWhile } from 'rxjs/operators';
import { coinmarketcap } from 'ccxt';

import logger from '../logger';
import config from '../config';
import { MyError } from '../errors';
import { Option, AddressMap, AddressMessage, Address, Transaction } from '../interfaces';
import { getItem, putItem, scan, deleteItem } from '../dynamo';
import { Message, receiveMessage, deleteMessage } from '../sqs';
import { sendMessage } from '../sns';
import { getLatestBlockNumber, getAddressesMovements } from '../ethereum';
import BlockCypher, { AddressOptions, Address as BcAddress } from '../blockcypher';

export const description = 'Fetch tickers from exchange';
export const options: Option[] = [
];

let blockCypher = new BlockCypher('eth', 'main');

export default async function main(/* options: any */) {
// 	run(await scan('address') as AddressMap);
// }

	let addresses = await scan('address') as AddressMap;
	while (process.exitCode === undefined) {

// async function run(addresses: AddressMap) {

		logger.info1('addresses', addresses);

		// let startTime = Date.now();

		try {
			/* First check to see if there are new addresses in the queue and load them */
			await checkAndLoadNewAddresses(addresses);

			/* Then update all addresses to latest block */
			await updateAddresses(addresses);
		} catch (error) {
			logger.error('Error', error);
		}

		// if (process.exitCode === undefined) {
		// 	let time = 10 * 1000 - (Date.now() - startTime);
		// 	logger.debug(`time: ${time * 1000}`);

		// 	setTimeout(run, time > 0 ? time : 0, addresses);
		// }
	}
}

async function checkAndLoadNewAddresses(addresses: AddressMap) {
	logger.info1('Checking for new addresses');

	let message = await receiveMessage<AddressMessage>(0);

	while (message) {
		logger.debug('message:', message);

		if (message.body) {
			if (!message.body.address) {
				logger.warning(`Message doesn't contain required attribute "address"`, message.body);
			} else if (!message.body.enabled) {
				logger.warning(`Message doesn't contain required attribute "enabled"`, message.body);
			} else {
				let { address, enabled } = message.body;
				if (enabled && address in addresses && addresses[address].enabled) {
					logger.warning('checkAndLoadNewAddresses: Requested to enable address already enabled');
				} else if (!enabled && !(address in addresses && addresses[address].enabled)) {
					logger.warning('checkAndLoadNewAddresses: Requested to disable address not enabled');
				} else {
					try {
						if (enabled) {
							/* Enabling address */
							let lastBlock = await getLatestBlockNumber();

							let startBlock;
							if (address in addresses) {
								startBlock = addresses[address].lastBlock;
							}
							let addressObj = await loadNewAddress(address, startBlock);
							putItem<Address>({ address, enabled, lastBlock });
							addresses[address] = { enabled, lastBlock };
						} else {
							/* Disabling address */
							putItem<Address>({ address, enabled, lastBlock: addresses[address].lastBlock });
							delete addresses[address];
						}
						deleteMessage(message.receiptHandle);
					} catch (error) {
						logger.error('checkAndLoadNewAddress failed', error);
					}
				}
			}
		}

		message = await receiveMessage<AddressMessage>(0);
	}
}

async function loadNewAddress(address: string, fromBlock?: number) {
	logger.info1(`loadNewAddress: Loading history for address: ${address}`);
	let params: AddressOptions = { limit: 2000, confirmations: 1 };
	if (fromBlock) {
		params = { ...params, after: fromBlock };
	}
	let addressObj: BcAddress;
	let earliestBlock = 0;
	/* We can't interrupt this loop because we only know last block but BlockCypher returns block in descending order */
	do {
		if (earliestBlock) {
			params = { ...params, before: earliestBlock };
		}
		addressObj = await blockCypher.getAddress(address, params);
		addressObj.txrefs.forEach((tx) => {
			earliestBlock = tx.block_height;
			try {
				let transaction = {
					id: tx.tx_hash,
					address,
					blockHeight: tx.block_height,
					datetime: tx.confirmed,
					value: tx.value
				};
				logger.info1('loadNewAddress: saving transaction', transaction);
				sendMessage<Transaction>(transaction);
			} catch (error) {
				logger.error('loadNewAddress: saving transaction failed:', error);
			}
		});
		logger.debug(`BlockCypher returned ${addressObj.txrefs.length} transactions`);
	} while (addressObj.hasMore /* || process.exitCode === undefined */);
}

async function updateAddresses(addresses: object) {
	/* TODO */
	// let latestBlockNumber = await getLatestBlockNumber();
	logger.info1(`Updating addresses:`, addresses);
}
