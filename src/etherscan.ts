import { MyError } from './errors';
import config from './config';
import logger from './logger';
import Remoting from './remoting';

const BASE_URL = 'http://api.etherscan.io/api';

export interface Response<T> {
	status: string;
	message: string;
	result: T[];
}

export interface Transaction {
	blockHash?: string;
	blockNumber: string;
	timeStamp: string;
	transactionIndex?: string;
	hash: string;
	from: string;
	to: string;
	value: string;
	input?: string;
	gas?: string;
	gasPrice?: string;
	gasUsed?: string;
	nonce?: string;
	confirmations?: string;
	contractAddress?: string;
	cumulativeGasUsed?: string;
	isError?: string;
	txreceipt_status?: string;
}

class Etherscan extends Remoting {
	constructor(url = config.ETHERSCAN_URL, apiKey = config.ETHERSCAN_TOKEN) {
		super(url || BASE_URL, apiKey);
	}

	async getAddressTransactions(address: string, startBlock: number, endBlock: number) {
		try {
			let ret = await this._get<Response<Transaction>>('/', {
				module: 'account',
				action: 'txlist',
				sort: 'asc',
				address,
				startBlock,
				endBlock
			});
			if (ret.status === "0") {
				return [];
			} else if (ret.status !== "1") {
				throw new MyError(`getAddressTransactions error: ${ret.message} (${ret.status})`);
			} else {
				return ret.result;
			}
		} catch (error) {
			throw new MyError('getAddressTransactions error', error);
		}
	}
}

let client: Etherscan;

function getClient() {
	if (client) {
		return client;
	} else {
		logger.debug(`Creating Etherscan client...`);

		client = new Etherscan();

		return client;
	}
}

export function getAddressTransactions(address: string, startBlock: number, endBlock: number) {
	return getClient().getAddressTransactions(address, startBlock, endBlock);
}
