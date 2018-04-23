import logger from '../logger';
import config from '../config';

export const description = 'Print the config';

export default function main() {
	logger.info('Configuration:', config);
}
