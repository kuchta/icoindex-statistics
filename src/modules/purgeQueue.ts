import logger from '../logger';
import { purgeQueue, receiveFromQueue } from '../sqs';

export const description = 'Deletes the messages in a queue';

export default function main() {
	logger.info('Running purgeQueue');
	purgeQueue().then(() => {
		logger.info('Queue purged');
	}).catch((error) => {
		logger.error('Purge queue failed', error);
	});
}

