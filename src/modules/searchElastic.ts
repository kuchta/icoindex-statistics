import logger from '../logger';
import { Options, TokenPairRateOnDateTime, TokenPairRateOnDateTimeInput } from '../interfaces';
import { ping, getTicker } from '../elasticsearch';

export const description = 'Search Elastic';
export const args = ['<pair>', '<datetime>'];

export default function main(pair: string, datetime: string) {
	getTicker(pair, datetime)
	.then((result) => logger.info('result', result))
	.catch((error) => logger.error('error', error));
}
