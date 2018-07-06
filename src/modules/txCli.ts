import logger from '../logger';
import { Option, AddressMessage } from '../interfaces';
import { receiveMessage } from '../sqs';
import { sendMessage } from '../sns';
import { deleteItem } from '../dynamo';
import { MyError } from '../errors';

export const description = 'Ethereum Command Utility';
export const options: Option[] = [
	{ option: '--list-addresses', description: 'list addresses in queue' },
	{ option: '--add-address <address>', description: 'add address' },
	{ option: '--remove-address <address>', description: 'remove address' },
	{ option: '--delete-address <address>', description: 'delete address from DynamoDB' }
];

export default async function main(option: {[key: string]: string}) {
	try {
		if (option.listAddresses) {
			let message;
			while (message = await receiveMessage<AddressMessage>(5)) {
				if (message && message.body) {
					logger.info(`address: ${message.body.address}, enabled: ${message.body.enabled}`);
				}
			}
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
	} catch (error) {
		logger.error('Command failed', error);
	}
}
