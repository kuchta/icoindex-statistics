import { from } from 'rxjs';
import { GraphQLClient } from 'graphql-request';

import logger from '../logger';
import config from '../config';
import { Option, Ticker, TickerInput } from '../interfaces';

import { fetchService } from './fetchService';
import { storeService } from './storeService';
import { queryService } from './queryService';

export const description = 'Test pipeline';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'bind to this host' },
	{ option: '-p, --port <port>', description: 'bind to this port' },
];

let testData: Ticker[] = [{
	pair: 'ABC/BCD',
	datetime: '2018-01-01T00:00Z',
	rate: 1
}, {
	pair: 'BCD/CDE',
	datetime: '2018-01-01T23:59Z',
	rate: 2
}, {
	pair: 'BCD/DEF',
	datetime: '2018-01-02T00:00Z',
	rate: 3
}];

const query = `query MyQuery($tickers: [TickerInput]) {
	getTokenPairRate(tickers: $tickers) {
		pair
		datetime
		rate
	}
}`;

export default function main(options: any) {
	let host = options.host || 'localhost';
	let port = options.port || 12345;

	fetchService(from(testData));
	storeService();
	queryService(host, port, async () => {
		const client = new GraphQLClient(`http://${host}:${port}/graphql`);
		await sleep(5);
		client.request(query, {
			tickers: [{
				pair: 'ABC/BCD',
				datetime: '2018-01-01T00:00Z'
			}, {
				pair: 'BCD/CDE',
				datetime: '2018-01-01T23:59Z'
			}, {
				pair: 'BCD/DEF',
				datetime: '2018-01-02T00:00Z'
			}]
		}).then(data => console.log(data));
	});
}

function sleep(seconds: number) {
	return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
