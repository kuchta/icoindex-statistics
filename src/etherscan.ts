import config from './config';
import { MyError } from './errors';
import Remoting from './remoting';

const BASE_URL = 'http://api.etherscan.io/api';

interface Response<T> {
	status: string;
	message: string;
	result: T[];
}

export interface ESTransaction {
	blockHash: string;
	blockNumber: string;
	confirmations: string;
	contractAddress: string;
	cumulativeGasUsed: string;
	from: string;
	gas: string;
	gasPrice: string;
	gasUsed: string;
	hash: string;
	input: string;
	isError: string;
	nonce: string;
	timeStamp: string;
	to: string;
	transactionIndex: string;
	txreceipt_status: string;
	value: string;
}

export default class Etherscan extends Remoting {
	constructor(apiKey = config.ETHERSCAN_TOKEN, url = BASE_URL) {
		super(apiKey, url);
	}

	async getAddressTransactions(address: string, startBlock: number, endBlock: number) {
		try {
			let ret = await this._get<Response<ESTransaction>>({
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
