import { AddressInfo } from 'net';
// import { Server } from 'http';
import express from 'express';
import graphqlHTTP from 'express-graphql';
import { buildSchema } from 'graphql';

import logger from '../logger';
import config from '../config';

import { MyError } from '../errors';
import { Option } from '../interfaces';
import { TickerInputs, TickerOutput,  } from '../tickers';
import { AddressInputs, TransactionOutput } from  '../transactions';

import { getTicker, getAddressAggregations } from '../elastic';

import schema from '../../schema.gql';

export const description = 'Query Service';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'Bind service to this host', defaultValue: config.QUERYSERVICE_HOST },
	{ option: '-p, --port <port>', description: 'Bind service to this port', defaultValue: String(config.QUERYSERVICE_PORT) },
];

const rootValue: any = {};

export default function main(options: { [key: string]: string }) {
	queryService(options.host, parseInt(options.port), (address, port) => {
		logger.info(`Query service is listening on ${address}:${port}/graphql`);
	});
}

export function queryService(host: string, port: number, listening?: (address: string, port: number) => void) {
	const app = express();

	app.use('/graphql', graphqlHTTP({
		schema: buildSchema(schema),
		graphiql: process.env.NODE_ENV !== 'production',
		formatError: (error) => ({
			message: error.message,
			locations: error.locations,
			stack: error.stack ? error.stack.split('\n') : [],
			path: error.path
		}),
		rootValue
	}));

	const server = app.listen(port, host, () => {
		process.on('beforeExit', () => {
			server.close();
		});

		if (listening) {
			const address = server.address() as AddressInfo;
			listening(address.address, address.port);
		}
	});

	return server;
}

rootValue.getTokenPairRate = async function (input: TickerInputs) {
	logger.debug('Request for getTokenPairRate', input);
	return input.tickers.map(async ({ exchange, pair, datetime }): Promise<TickerOutput> => {
		exchange = exchange || 'coinmarketcap';
		const output: TickerOutput = {
			exchange: exchange,
			pair: pair,
			datetime: [ datetime ],
		};
		try {
			const tickers = pair.split('/');
			if (tickers.length !== 2) {
				throw new MyError(`Invalid pair format supplied: "${pair}"`);
			}
			if (tickers[1] === 'USD') {
				const ret = await getTicker(pair, datetime, exchange);
				output.datetime = [ ret.datetime ];
				output.id = [ ret.uuid ];
				output.rate = ret.rate;
			} else {
				const first = await getTicker(`${tickers[0]}/USD`, datetime, exchange);
				const second = await getTicker(`${tickers[1]}/USD`, datetime, exchange);
				output.datetime = [ first.datetime, second.datetime ];
				output.id = [ first.uuid, second.uuid ];
				output.rate = first.rate / second.rate;
			}
		} catch (error) {
			logger.error(`getTokenPairRate for pair ${pair} failed`, error);
		} finally {
			logger.debug('Response for getTokenPairRate', output);
			return output;
		}
	});
};

rootValue.getAddressTransactions = async function (input: AddressInputs, ...args: any[]) {
// rootValue.getAddressTransactions = async function (root: any, args: any, context: any) {
	logger.debug('Request for getAddressTransactions', input);
	return input.addresses.map(async ({ address, startDatetime, endDatetime, granularity }): Promise<TransactionOutput> => {
		const output: TransactionOutput = {
			address
		};
		try {
			const inTxs = await getAddressAggregations(address, startDatetime, endDatetime, granularity, true);
			output.receivedCount = inTxs.map((bucket) => bucket.bucket_stats.count);
			output.receivedAmount = inTxs.map((bucket) => bucket.bucket_stats.sum || 0);

			const outTxs = await getAddressAggregations(address, startDatetime, endDatetime, granularity, false);
			output.sentCount = outTxs.map((bucket) => bucket.bucket_stats.count);
			output.sentAmount = outTxs.map((bucket) => bucket.bucket_stats.sum || 0);
		} catch (error) {
			logger.error(`getAddressTransactions for address ${address} failed`, error);
			throw new MyError(error.message);
		} finally {
			logger.debug('Response for getAddressTransactions', output);
			return output;
		}
	});
};
