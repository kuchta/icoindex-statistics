import moment from 'moment';
// import Web3 from 'web3';
// import ethers, { providers, Transaction } from 'ethers';

import config from './config';
import logger from './logger';
import { MyError } from './errors';

import BlockCypher from './blockcypher';

type Filter = { address: string; fromBlock?: number, topics?: string[] };

let addresses = [ '0x86fa049857e0209aa7d9e616f7eb3b3b78ecfdb0' ];

let client: any = null;

// class DebugProvider extends ethers.providers.Provider { //(ethers.providers.Provider as { new(testnet: string): any; }) {
// 	constructor() {
// 		super('homestead');
// 		this.subprovider = new ethers.providers.EtherscanProvider('homestead');
// 	}
// 	perform(method: string, params: string) {
// 		console.log('calling perform');
// 		let retPromise = this.subprovider.perform(method, params);
// 		retPromise.then((result: any) => {
// 			console.log('DEBUG', method, params, '=>', result);
// 		});
// 		return retPromise;
// 	}
// }

function getClient(): BlockCypher {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating Ethereum client...`);
		// client = ethers.providers.getDefaultProvider();

		// client = new ethers.providers.FallbackProvider([
		// 	new ethers.providers.InfuraProvider(),
		// 	new ethers.providers.EtherscanProvider()
		// ]);

		// client = new ethers.providers.InfuraProvider();
		// client = new ethers.providers.EtherscanProvider();

		// client = new DebugProvider();

		client = new BlockCypher('eth', 'main', config.BLOCKCYPHER_TOKEN);
		client.init();

		return client;
	}
}

// let web3 = new Web3(new Web3.providers.HttpProvider(config.ETHEREUM_URL));

export async function getTransactions(address: string) {
	try {
		return await getClient().getAddressFull(address, { limit: 2000, confirmations: 1 });
		// let blockCounter = 1;
		// let blockLapTime = moment();
		// let transactions: Transaction[] = [];
		// for (let i = await getLatestBlockNumber(); i > 0; i--, blockCounter++) {
		// 	let block = await getBlock(i);
		// 	for (let j = block.transactions.length; j < 0; j--) {
		// 		let transaction = await getTransaction(block.transactions[j]);
		// 		if (transaction.from === address || transaction.to === address) {
		// 			logger.info1('found transaction', transaction);
		// 			transactions.push(transaction);
		// 		}
		// 	}
		// 	process.stdout.write('.');
		// 	if (blockCounter % 1000 === 0) {
		// 		logger.info1(`1000 blocks in ${moment.duration(moment().diff(blockLapTime)).asMilliseconds() / 1000} seconds`);
		// 		blockLapTime = moment();
		// 	}
		// }
	} catch (error) {
		throw new MyError('Ethereum getTransaction failed', { error });
	}
}

// export function resolveName(name: string) {
// 	return getClient().resolveName(name);
// }

// export function lookupAddress(address: string) {
// 	return getClient().lookupAddress(address);
// }

// export function getLatestBlockNumber() {
// 	return getClient().getBlockNumber();
// }

// export function getBlock(hashOrNumber: string | number) {
// 	return getClient().getBlock(hashOrNumber);
// }

// export async function getBalance(address: string) {
// 	return ethers.utils.formatEther(await getClient().getBalance(address));
// }

// export async function getTransaction(hash: string) {
// 	return await getClient().getTransaction(hash);
// 	// return { ...rec,
// 	// 	value: ethers.utils.formatEther(rec.value),
// 	// 	gasPrice: ethers.utils.formatEther(rec.gasPrice),
// 	// 	gasLimit: ethers.utils.formatEther(rec.gasLimit)
// 	// };
// }

// export function getLogs(address: string, fromBlock?: number) {
// 	let filter: Filter = { address };
// 	if (fromBlock) {
// 		filter.fromBlock = fromBlock;
// 	}
// 	logger.debug('filter', filter);
// 	return getClient().getLogs(filter);
// }

// // export async function getHistory(address: string) {
// // 	let ret = await getClient().getHistory(address);
// // 	return ret.map((rec: any) => ({
// // 		...rec,
// // 		value: ethers.utils.formatEther(rec.value),
// // 		gasPrice: ethers.utils.formatEther(rec.gasPrice),
// // 		gasLimit: ethers.utils.formatEther(rec.gasLimit)
// // 	}));
// // }

// export function listenForAddressBalanceChange(address: string) {
// 	getClient().on(address, (balance: any) => {
// 		logger.info(`Balance changed on address: ${address}. New balance: ${ethers.utils.formatEther(balance)}`);
// 	});
// }
