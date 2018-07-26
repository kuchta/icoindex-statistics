import config from '../config';
import logger from '../logger';
import { Option, AddressMap, AddressMessage } from '../interfaces';
import { purgeQueue, receiveMessage } from '../sqs';
import { sendMessage } from '../sns';
import { scan, deleteItem } from '../dynamo';
import { MyError } from '../errors';
import { createIndex, deleteIndex, searchTransactions } from '../elastic';
import { getAddressTransactions } from '../ethereum';

export const description = 'Ethereum Command Utility';
export const options: Option[] = [
	{ option: '--list-queue', description: 'list addresses in queue' },
	{ option: '--list-db', description: 'list addresses in Dynamo' },
	{ option: '--enable-address <address>', description: 'enable address' },
	{ option: '--disable-address <address>', description: 'disable address' },
	{ option: '--delete-address <address>', description: 'delete address from Dynamo' },
	{ option: '-S, --search-transactions <address startDatetime endDatetime received|sent', description: 'search transactions in Elastic' },
	{ option: '-P, --purge-queue', description: 'purge queue' },
	{ option: '-C, --create-index', description: 'create elastic index' },
	{ option: '-D, --delete-index', description: 'delete elastic index' },
];

export default async function main(options: {[key: string]: string}) {
	try {
		if (options.listQueue) {
			let message;
			while (message = await receiveMessage<AddressMessage>(5)) {
				if (message && message.body) {
					logger.info(`address: ${message.body.address}, enabled: ${message.body.enabled}`);
				}
			}
		}
		if (options.listDb) {
			let addresses = await scan('address') as AddressMap;
			logger.info('addresses', addresses);
		}
		if (options.enableAddress) {
			if (typeof options.enableAddress !== 'string') {
				throw new MyError('address argument is required');
			}
			sendMessage({ address: options.enableAddress, enabled: true });
		}
		if (options.disableAddress) {
			if (typeof options.disableAddress !== 'string') {
				throw new MyError('address argument is required');
			}
			sendMessage({ address: options.disableAddress, enabled: false });
		}
		if (options.deleteAddress) {
			if (typeof options.deleteAddress !== 'string') {
				throw new MyError('address argument is required');
			}
			deleteItem('address', options.deleteAddress);
		}
		if (options.searchTransactions) {
			let results;
			let args = options.searchTransactions.split(' ');
			if (args.length !== 4) {
				throw new MyError('Invalud number of arguments. Expected 4 arguments in double quotes');
			}
			results = await searchTransactions({
				query: {
					and: [{
						term: args[3] === 'received' ? { to: args[0] } : { from: args[0] }
					}, {
						range: {
							datetime: {
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
				logger.info('no results');
			}
		}
		if (options.purgeQueue) {
			await purgeQueue();
			logger.info('queue purged');
		}
		if (options.createIndex) {
			await createIndex(config.AWS_ELASTIC_TRANSACTION_INDEX, config.AWS_ELASTIC_TRANSACTION_TYPE, {
				uuid: {
					type: 'string',
					index: 'not_analyzed'
				},
				from: {
					type: 'string',
					index: 'not_analyzed'
				},
				to: {
					type: 'string',
					index: 'not_analyzed'
				},
				datetime: {
					type: 'date',
					format: 'strict_date_optional_time'
				},
				blockHeight: {
					type: 'integer'
				},
				value: {
					type: 'long'
				}
			});
			logger.info('index created');
		}
		if (options.deleteIndex) {
			await deleteIndex(config.AWS_ELASTIC_TRANSACTION_INDEX);
			logger.info('index deleted');
		}
	} catch (error) {
		logger.error('Command failed', error);
	}
}
