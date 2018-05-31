import Web3 from 'web3';
import ethers from 'ethers';

import config from './config';
import logger from './logger';

type Filter = { address: string; fromBlock?: number, topics?: string[] };

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

function getClient() {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating Ethereum client...`);

		// client = ethers.providers.getDefaultProvider();

		client = new ethers.providers.FallbackProvider([
			new ethers.providers.InfuraProvider(),
			new ethers.providers.EtherscanProvider()
		]);

		// client = new ethers.providers.InfuraProvider();
		// client = new ethers.providers.EtherscanProvider();

		// client = new DebugProvider();

		return client;
	}
}

let web3 = new Web3(new Web3.providers.HttpProvider(config.ETHEREUM_URL));

export function resolveName(name: string) {
	return getClient().resolveName(name);
}

export function lookupAddress(address: string) {
	return getClient().lookupAddress(address);
}

export function getLatestBlockNumber() {
	return getClient().getBlockNumber();
}

export function getBlock(hashOrNumber: string | number) {
	return getClient().getBlock(hashOrNumber);
}

export async function getBalance(address: string) {
	return ethers.utils.formatEther(await getClient().getBalance(address));
}

export async function getTransaction(hash: string) {
	let rec = await getClient().getTransaction(hash);
	return { ...rec,
		value: ethers.utils.formatEther(rec.value),
		gasPrice: ethers.utils.formatEther(rec.gasPrice),
		gasLimit: ethers.utils.formatEther(rec.gasLimit)
	};
}

export function getLogs(address: string, fromBlock?: number) {
	let filter: Filter = { address };
	if (fromBlock) {
		filter.fromBlock = fromBlock;
	}
	return getClient().getLogs(filter);
}

export async function getHistory(address: string) {
	let ret = await getClient().getHistory(address);
	return ret.map((rec: any) => ({
		...rec,
		value: ethers.utils.formatEther(rec.value),
		gasPrice: ethers.utils.formatEther(rec.gasPrice),
		gasLimit: ethers.utils.formatEther(rec.gasLimit)
	}));
}

export function listenForAddressBalanceChange(address: string) {
	getClient().on(address, (balance: any) => {
		logger.info(`Balance changed on address: ${address}. New balance: ${ethers.utils.formatEther(balance)}`);
	});
}
