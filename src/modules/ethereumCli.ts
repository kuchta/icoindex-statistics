import ethers from 'ethers';

import logger from '../logger';
import { Option } from '../interfaces';
import { resolveName, lookupAddress, getLatestBlockNumber, getBlock, getBalance, getHistory, getLogs, getTransaction, listenForAddressBalanceChange } from '../ethereum';
import { MyError } from '../errors';

export const description = 'Ethereum Command Utility';
export const options: Option[] = [
	{ option: '--resolve-name <name>', description: 'resolve ens name to address' },
	{ option: '--lookup-address <address>', description: 'lookup ens name for address' },
	{ option: '--get-latest-block-number', description: 'get latest block number' },
	{ option: '-B, --get-block <block hash or number>', description: 'get block' },
	{ option: '-A, --get-balance <address>', description: 'get address balance' },
	{ option: '-H, --get-history <address>', description: 'get address history' },
	{ option: '-l, --get-logs <address>', description: 'get address log' },
	{ option: '-T, --get-transaction <transaction-id>', description: 'get transation' },
	{ option: '-L, --listen-for-address-balance-change <address>', description: 'listen for address balance change' },
];

export default async function main(option: {[key: string]: string}) {
	try {
		if (option.resolveName) {
			logger.info(`address: "${await resolveName(option.resolveName)}"`);
		}
		if (option.lookupAddress) {
			logger.info(`name: "${await lookupAddress(option.lookupAddress)}"`);
		}
		if (option.getLatestBlockNumber) {
			logger.info('latest block:', await getLatestBlockNumber());
		}
		if (option.getBlock) {
			let hashOrNumber: string | number = option.getBlock;
			if (parseInt(hashOrNumber) !== NaN) {
				hashOrNumber = parseInt(hashOrNumber);
			}
			logger.info('block:', await getBlock(hashOrNumber));
		}
		if (option.getBalance) {
			if (typeof option.getBalance !== 'string') {
				throw new MyError('Address argument is required');
			}
			logger.info('balance:', await getBalance(option.getBalance));
		}
		if (option.getTransaction) {
			if (typeof option.getTransaction !== 'string') {
				throw new MyError('Transaction ID argument is required');
			}
			logger.info('transaction:', await getTransaction(option.getTransaction));
		}
		if (option.getHistory) {
			if (typeof option.getHistory !== 'string') {
				throw new MyError('address argument is required');
			}
			logger.info('history:', await getHistory(option.getHistory));
		}
		if (option.getLogs) {
			if (typeof option.getLogs !== 'string') {
				throw new MyError('address argument is required');
			}
			logger.info('logs:', await getLogs(option.getLogs));
		}
		if (option.listenForAddressBalanceChange) {
			listenForAddressBalanceChange(option.listenForAddressBalanceChange);
		}
	} catch (error) {
		logger.error('command failed', error);
	}
}
