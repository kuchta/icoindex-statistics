// import Web3 from 'web3';
// import ethers from 'ethers';
import { BigNumber } from 'bignumber.js';
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
		// client = new ethers.providers.JsonRpcProvider(config.ETHEREUM_URL);
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

export function isAddress(address: string) {
	// return getClient().utils.isAddress(address);
	return utils.isAddress(address);
}
