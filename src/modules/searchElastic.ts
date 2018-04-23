import logger from '../logger';
import { Option, TokenPairRateOnDateTime, TokenPairRateOnDateTimeInput } from '../interfaces';
import { ping, getTicker } from '../elasticsearch';

export const description = 'Search Elastic';
export const args = ['<pair>', '<datetime>'];

export default function main(pair: string, datetime: string) {
	getTicker(pair, datetime)
	.then((result) => logger.info('Result', result))
	.catch((error) => logger.error('Error', error));
}
