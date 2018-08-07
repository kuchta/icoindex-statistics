import Web3 from 'web3';

import config from './config';
import logger from './logger';
// import { MyError } from './errors';

import { Option, Address, AddressMessage, Transaction } from './interfaces';

// import BlockCypher, { AddressOptions, Address as BcAddress } from './blockcypher';
import Etherscan, { ESTransaction } from './etherscan';
// import Ethplorer from './ethplorer';

// const historyApi = new BlockCypher('eth', 'main');
const historyApi = new Etherscan();
// const historyApi = new Ethplorer();

let client: any = null;

function getClient(): Web3 {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating Ethereum client...`);

		client = new Web3(new Web3.providers.HttpProvider(config.ETHEREUM_HOST));

		return client;
	}
}

export function getLatestBlockNumber() {
	return getClient().eth.getBlockNumber();
}

export function getTransaction(txid: string) {
	return getClient().eth.getTransaction(txid);
}

export function getBlock(blockNumber: number, returnTransactionObjects = false) {
	return getClient().eth.getBlock(blockNumber, returnTransactionObjects);
}

export function isAddress(address: string) {
	return getClient().utils.isAddress(address);
}

export function getAddressTransactions(address: string, startBlock: number, endBlock: number) {
	return historyApi.getAddressTransactions(address, startBlock, endBlock);
}
