import { MyError } from '../errors';
import { Option } from '../interfaces';
import { AddressMap, AddressMessage } from '../transactions';

import config from '../config';
import logger from '../logger';
import { scan, deleteItem, putItem, purgeDatabase } from '../dynamo';
import { purgeQueue, receiveMessage } from '../sqs';
import { sendMessage } from '../sns';
import { createIndex, deleteIndex, searchTransactions } from '../elastic';

export const description = 'Transaction Management Utility';
export const options: Option[] = [
	{ option: '--list-addresses', description: 'List addresses in Dynamo' },
	{ option: '--list-address-queue', description: 'List addresses in queue' },
	{ option: '--enable-address <address>', description: 'Enable address' },
	{ option: '--disable-address <address>', description: 'Disable address' },
	{ option: '--delete-address <address>', description: 'Delete address from Dynamo' },
	{ option: '--purge-addresses', description: 'Purge address database' },
	{ option: '--set-last-block <number>', description: 'Set last block' },
	{ option: '-S, --search-transactions <address startDatetime endDatetime received|sent', description: 'Search transactions in Elastic' },
	{ option: '-P, --purge-queue', description: 'Purge queue' },
	{ option: '-C, --create-index', description: 'Create elastic index' },
	{ option: '-D, --delete-index', description: 'Delete elastic index' },
];

export default async function main(options: {[ key: string]: string }) {
	try {
		if (options.listAddresses) {
			const addresses = await scan();
			logger.info('addresses', addresses);
		}
		if (options.listAddressQueue) {
			let message;
			while (message = await receiveMessage<AddressMessage>(5)) {
				if (message && message.body) {
					logger.info(`address: ${message.body.address}, enabled: ${message.body.enabled}`);
				}
			}
		}
		if (options.enableAddress) {
			if (typeof options.enableAddress !== 'string') {
				throw new MyError('Address argument is required');
			}
			sendMessage({ address: options.enableAddress, enabled: true });
		}
		if (options.disableAddress) {
			if (typeof options.disableAddress !== 'string') {
				throw new MyError('Address argument is required');
			}
			sendMessage({ address: options.disableAddress, enabled: false });
		}
		if (options.deleteAddress) {
			if (typeof options.deleteAddress !== 'string') {
				throw new MyError('Address argument is required');
			}
			deleteItem('address', options.deleteAddress);
		}
		if (options.purgeAddresses) {
			await purgeDatabase('address');
			logger.info('Address database purged');
		}
		if (options.setLastBlock) {
			if (typeof options.setLastBlock !== 'string') {
				throw new MyError('Number argument is required');
			}
			putItem({ address: 'lastBlock', value: Number(options.setLastBlock) });
		}
		if (options.searchTransactions) {
			const args = options.searchTransactions.split(' ');
			if (args.length !== 4) {
				throw new MyError('Invalud number of arguments. Expected 4 arguments in double quotes');
			}
			const results = await searchTransactions({
				query: {
					and: [{
						term: args[3] === 'received' ? { to: args[0] } : { from: args[0] }
					}, {
						range: {
							timeStamp: {
								gte: args[1],
								lte: args[2],
							}
						}
					}]
				}
			});
			if (results) {
				logger.info('Results', results);
			} else {
				logger.info('No results');
			}
		}
		if (options.purgeQueue) {
			await purgeQueue();
			logger.info('Queue purged');
		}
		if (options.createIndex) {
			await createIndex(config.AWS_ELASTIC_TRANSACTION_INDEX, config.AWS_ELASTIC_TRANSACTION_TYPE, {
				uuid: {
					type: 'string',
					index: 'not_analyzed'
				},
				blockNumber: {
					type: 'integer'
				},
				timeStamp: {
					type: 'date',
					format: 'strict_date_optional_time'
				},
				from: {
					type: 'string',
					index: 'not_analyzed'
				},
				to: {
					type: 'string',
					index: 'not_analyzed'
				},
				value: {
					type: 'long'
				}
			});
			logger.info('Index created');
		}
		if (options.deleteIndex) {
			await deleteIndex(config.AWS_ELASTIC_TRANSACTION_INDEX);
			logger.info('Index deleted');
		}
	} catch (error) {
		logger.error('Command failed', error);
	}
}
