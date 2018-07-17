import logger from '../logger';
import { Option, AddressMap, AddressMessage } from '../interfaces';
import { purgeQueue, receiveMessage } from '../sqs';
import { sendMessage } from '../sns';
import { scan, deleteItem } from '../dynamo';
import { MyError } from '../errors';
import { createIndex, deleteIndex, searchTransactions } from '../elastic';

export const description = 'Ethereum Command Utility';
export const options: Option[] = [
	{ option: '--list-queue', description: 'list addresses in queue' },
	{ option: '--list-db', description: 'list addresses in queue' },
	{ option: '--add-address <address>', description: 'add address' },
	{ option: '--remove-address <address>', description: 'remove address' },
	{ option: '--delete-address <address>', description: 'delete address from DynamoDB' },
	{ option: '-S, --search-transactions <address startDatetime endDatetime interval>', description: 'search transactions in elastic' },
	{ option: '-P, --purge-queue', description: 'purge queue' },
	{ option: '-C, --create-index', description: 'create elastic index' },
	{ option: '-D, --delete-index', description: 'delete elastic index' },
];

export default async function main(option: {[key: string]: string}) {
	try {
		if (option.listQueue) {
			let message;
			while (message = await receiveMessage<AddressMessage>(5)) {
				if (message && message.body) {
					logger.info(`address: ${message.body.address}, enabled: ${message.body.enabled}`);
				}
			}
		}
		if (option.listDb) {
			let addresses = await scan('address') as AddressMap;
			logger.info('addresses', addresses);
		}
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
			deleteItem('address', option.deleteAddress);
		}
		if (option.searchTransactions) {
			let results;
			let args = option.searchTransactions.split(' ');
			if (args.length !== 4) {
				throw new MyError('Invalud number of arguments. Expected 4 arguments in double quotes');
			}
			results = await searchTransactions(args[0], args[1], args[2], args[3]);
			if (results) {
				logger.info('Results', results);
			} else {
				logger.info('no results');
			}
		}
		if (option.purgeQueue) {
			await purgeQueue();
			logger.info('queue purged');
		}
		if (option.createIndex) {
			await createIndex({
				uuid: {
					type: 'string',
					index: 'not_analyzed'
				},
				address: {
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
					type: 'double'
				}
			});
			logger.info('index created');
		}
		if (option.deleteIndex) {
			await deleteIndex();
			logger.info('index deleted');
		}
	} catch (error) {
		logger.error('Command failed', error);
	}
}
