import config from './config';
import { Transaction } from './transactions';
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
	constructor(url = config.ETHPLORER_URL, apiKey = config.ETHPLORER_TOKEN) {
		super(url || BASE_URL, apiKey);
	}

	async getAddressTransactions(address: string, startBlock: number, sort = 'asc') {
		let ret = await this._get<EPTransaction[]>('/', {
			module: 'account',
			action: 'txlist',
			address,
			startblock: startBlock,
			sort
		});
		return ret.map(transaction => ({
			uuid: transaction.hash,
			timeStamp: new Date(transaction.timestamp * 1000).toISOString(),
			from: transaction.from,
			to: transaction.to,
			value: transaction.value
		} as Transaction));
	}
}
