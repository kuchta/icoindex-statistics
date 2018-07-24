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
	{ option: '--list-db', description: 'list addresses in queue' },
	{ option: '--add-address <address>', description: 'add address' },
	{ option: '--remove-address <address>', description: 'remove address' },
	{ option: '--delete-address <address>', description: 'delete address from DynamoDB' },
	{ option: '-S, --search-transactions <address startDatetime endDatetime received|sent', description: 'search transactions in elastic' },
	{ option: '-P, --purge-queue', description: 'purge queue' },
	{ option: '-C, --create-index', description: 'create elastic index' },
	{ option: '-D, --delete-index', description: 'delete elastic index' },
	{ option: '-T, --test', description: 'test new code' }
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
		if (options.addAddress) {
			if (typeof options.addAddress !== 'string') {
				throw new MyError('address argument is required');
			}
			sendMessage({ address: options.addAddress, enabled: true });
		}
		if (options.removeAddress) {
			if (typeof options.removeAddress !== 'string') {
				throw new MyError('address argument is required');
			}
			sendMessage({ address: options.removeAddress, enabled: false });
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
		if (options.test) {
			let ret = await getAddressTransactions('0xddbd2b932c763ba5b1b7ae3b362eac3e8d40121a', 6000000);
			logger.info('ret', ret);
		}
	} catch (error) {
		logger.error('Command failed', error);
	}
}
