import logger from '../logger';
import { config } from '../config';

export const description = 'print the config';

export default function main() {
	logger.info('Config', config);
}
