import config from './config';
import { Transaction } from './interfaces';
import Remoting from './remoting';

const BASE_URL = 'http://api.ethplorer.io';

interface EPTransaction {
	timestamp: number;	// operation timestamp
	from: string;		// source address (if two addresses involved),
	to: string;			// destination address (if two addresses involved),
	hash: string;		// transaction hash
	value: number;		// ETH value (as is, not reduced to a floating point value),
	input: string;		// input data
	success: boolean;	// true if transactions was completed, false if failed
}

export default class Ethplorer extends Remoting {
	constructor(apiKey = config.ETHPLORER_TOKEN, url = BASE_URL) {
		super(apiKey, url);
	}

	async getAddressTransactions(address: string, startBlock: number, sort = 'asc') {
		let ret = await this._get<EPTransaction[]>({
			module: 'account',
			action: 'txlist',
			address,
			startblock: startBlock,
			sort
		});
		return ret.map(transaction => ({
			uuid: transaction.hash,
			from: transaction.from,
			to: transaction.to,
			datetime: new Date(transaction.timestamp * 1000).toISOString(),
			value: transaction.value
		} as Transaction));
	}
}
