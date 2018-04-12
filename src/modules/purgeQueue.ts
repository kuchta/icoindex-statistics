import logger from '../logger';
import { purgeQueue } from '../sqs';

export const description = 'deletes the messages in a queue';

export default function main() {
	purgeQueue().then(() => {
		logger.info('Queue purged');
	}).catch((error) => {
		logger.error('Purge queue failed', error);
	});
}

