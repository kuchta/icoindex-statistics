import request from 'request-promise-native';

import logger from './logger';
import config from './config';
import { MyError } from './errors';
import { Transaction } from './interfaces';

const BASE_URL = 'http://api.etherscan.io/api';

interface Response<T> {
	status: string;
	message: string;
	result: T[];
}

interface ESTransaction {
	blockNumber: string;
	timeStamp: string;
	hash: string;
	nonce: string;
	blockHash: string;
	transactionIndex: string;
	from: string;
	to: string;
	value: string;
	gas: string;
	gasPrice: string;
	isError: string;
	txreceipt_status: string;
	input: string;
	contractAddress: string;
	cumulativeGasUsed: string;
	gasUsed: string;
	confirmations: string;
}

export default class Etherscan {
	constructor(private url = BASE_URL, private apiKey = config.ETHERSCAN_TOKEN) {}

	async _request<T>(method: string, params: object) {
		try {
			logger.debug(`Calling Etherscan API: ${method.toUpperCase()} ${this.url} with params:`, params);
			return request[method]({ ...params, strictSSL: true, json: true, apikey: this.apiKey, url: this.url }) as T;
		} catch (error) {
			throw new MyError('Etherscan request failed', { error });
		}
	}

	_get<T>(params: object) {
		return this._request<T>('get', {
			qs: params
		});
	}

	async getAddressTransactions(address: string, startBlock: number, sort = 'asc') {
		let ret = await this._get<Response<ESTransaction>>({
			module: 'account',
			action: 'txlist',
			address,
			startblock: startBlock,
			sort
		});
		if (ret.status === "0") {
			return [];
		} else if (ret.status !== "1") {
			throw new MyError(`getAddressTransactions error: ${ret.message} (${ret.status})`);
		} else {
			return ret.result.map(transaction => ({
				uuid: transaction.hash,
				from: transaction.from,
				to: transaction.to,
				blockHeight: parseInt(transaction.blockNumber),
				datetime: new Date(parseInt(transaction.timeStamp) * 1000).toISOString(),
				value: parseInt(transaction.value)
			} as Transaction));
		}
	}
}
