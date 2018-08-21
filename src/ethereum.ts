// import Web3 from 'web3';
// import Eth from 'ethjs';
import { RequestManager, providers, utils } from 'eth-connect';

import config from './config';
import logger from './logger';

export { getAddressTransactions } from './etherscan';

let client: RequestManager;

function getClient(): RequestManager {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating Ethereum client...`);

		// client = new Web3(new Web3.providers.HttpProvider(config.ETHEREUM_URL));
		// client = new Eth(new Eth.HttpProvider(config.ETHEREUM_URL));
		client = new RequestManager(new providers.HTTPProvider(config.ETHEREUM_URL));

		return client;
	}
}

export function getLatestBlockNumber() {
	// return getClient().eth.getBlockNumber();
	return getClient().eth_blockNumber();
}

export function getBlock(blockNumber: number, returnTransactionObjects = false) {
	// return getClient().eth.getBlock(blockNumber, returnTransactionObjects);
	return getClient().eth_getBlockByNumber(blockNumber, returnTransactionObjects);
}

// export function getBlocks(blockNumbers: number[], returnTransactionObjects = false) {
// 	const batch = new (getClient().BatchRequest)();
// 	for (let blockNumber in blockNumbers) {
// 		batch.add(Web3.eth.getBlock.request(blockNumber, returnTransactionObjects));
// 	}
// 	let res = batch.execute();
// 	return res;
// }

export function isAddress(address: string) {
	// return getClient().utils.isAddress(address);
	return utils.isAddress(address);
}
