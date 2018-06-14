import logger from '../logger';
import config from '../config';
import { Option, Address } from '../interfaces';
// import { getTransactions } from '../ethereum';
import { sendMessage } from '../sns';
import { getItem, putItem, deleteItem } from '../dynamo';
import { MyError } from '../errors';

export const description = 'Ethereum Command Utility';
export const options: Option[] = [
	{ option: '--add-address <address>', description: 'add address for checking' },
	{ option: '--remove-address <address>', description: 'add address for checking' },
	{ option: '--delete-address <address>', description: 'add address for checking' },
	{ option: '--resolve-name <name>', description: 'resolve ens name to address' },
	{ option: '--lookup-address <address>', description: 'lookup ens name for address' },
	{ option: '--get-latest-block-number', description: 'get latest block number' },
	{ option: '-B, --get-block <block hash or number>', description: 'get block' },
	{ option: '-T, --get-transaction <transaction-id>', description: 'get transation' },
	{ option: '-A, --get-balance <address>', description: 'get address balance' },
	// { option: '-H, --get-history <address>', description: 'get address history' },
	{ option: '-t, --get-transactions <address>', description: 'get address transactions' },
	{ option: '-l, --get-logs <address>', description: 'get address log' },
	{ option: '-L, --listen-for-address-balance-change <address>', description: 'listen for address balance change' },
];

export default async function main(option: {[key: string]: string}) {
	try {
		if (option.addAddress) {
			if (typeof option.addAddress !== 'string') {
				throw new MyError('address argument is required');
			}
			sendMessage({ address: option.addAddress, enabled: true });
		}
		if (option.removeAddress) {
			if (typeof option.removeAddress !== 'string') {
				throw new MyError('address argument is required');
			}
			sendMessage({ address: option.removeAddress, enabled: false });
		}
		if (option.deleteAddress) {
			if (typeof option.deleteAddress !== 'string') {
				throw new MyError('address argument is required');
			}
			deleteItem('address', option.deleteAddress );
		}
		// if (option.resolveName) {
		// 	logger.info(`address: "${await resolveName(option.resolveName)}"`);
		// }
		// if (option.lookupAddress) {
		// 	logger.info(`name: "${await lookupAddress(option.lookupAddress)}"`);
		// }
		// if (option.getBlock) {ZZ
		// 	let hashOrNumber: string | number = option.getBlock;
		// 	if (parseInt(hashOrNumber) !== NaN) {
		// 		hashOrNumber = parseInt(hashOrNumber);
		// 	}
		// 	logger.info('block:', await getBlock(hashOrNumber));
		// }
		// if (option.getTransaction) {
		// 	if (typeof option.getTransaction !== 'string') {
		// 		throw new MyError('Transaction ID argument is required');
		// 	}
		// 	logger.info('transaction:', await getTransaction(option.getTransaction));
		// }
		// if (option.getBalance) {
		// 	if (typeof option.getBalance !== 'string') {
		// 		throw new MyError('Address argument is required');
		// 	}
		// 	logger.info('balance:', await getBalance(option.getBalance));
		// }
		// if (option.getHistory) {
		// 	if (typeof option.getHistory !== 'string') {
		// 		throw new MyError('address argument is required');
		// 	}
		// 	logger.info('history:', await getHistory(option.getHistory));
		// }
		// if (option.getTransactions) {
		// 	if (typeof option.getTransactions !== 'string') {
		// 		throw new MyError('address argument is required');
		// 	}
		// 	logger.info('transactions:', await getTransactions(option.getTransactions));
		// }
		// if (option.listenForAddressBalanceChange) {
		// 	listenForAddressBalanceChange(option.listenForAddressBalanceChange);
		// }
	} catch (error) {
		logger.error('Command failed', error);
	}
}
