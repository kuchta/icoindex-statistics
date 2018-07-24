import { AddressInfo } from 'net';
import { Server } from 'http';
import express from 'express';
import graphqlHTTP from 'express-graphql';
import { buildSchema } from 'graphql';

import logger from '../logger';
import config from '../config';
import { Option, TickerInputs, TickerOutput, AddressInputs, TransactionOutput } from '../interfaces';
import { getTicker, getAddressAggregations } from '../elastic';
import schema from '../../schema.gql';
import { MyError } from '../errors';

export const description = 'GraphQL Server';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'bind to this host' },
	{ option: '-p, --port <port>', description: 'bind to this port' },
];

export default function main(options: {[key: string]: string}) {
	queryService(options.host || config.GRAPHQL_HOST, parseInt(options.port) || config.GRAPHQL_PORT, (address, port) => {
		logger.info(`GraphQL server is listening on ${address}:${port}/graphql`);
	});
}

export function queryService(host: string, port: number, listening?: (address: string, port: number) => void) {
	let app = express();

	app.use('/graphql', graphqlHTTP({
		schema: buildSchema(schema),
		graphiql: true,
		formatError: (error) => ({
			message: error.message,
			locations: error.locations,
			stack: error.stack ? error.stack.split('\n') : [],
			path: error.path
		}),
		rootValue: {
			getTokenPairRate,
			getAddressTransactions
		}
	}));

	let server = app.listen(port, host, () => {
		process.on('beforeExit', () => {
			server.close();
		});

		if (listening) {
			let address = server.address() as AddressInfo;
			listening(address.address, address.port);
		}
	});

	return server;
}

async function getTokenPairRate(input: TickerInputs) {
	logger.info1('Request for getTokenPairRate', input);
	return input.tickers.map(async ({ exchange, pair, datetime }): Promise<TickerOutput> => {
		exchange = exchange || 'coinmarketcap';
		const output: TickerOutput = {
			exchange: exchange,
			pair: pair,
			datetime: [ datetime ],
		};
		try {
			let tickers = pair.split('/');
			if (tickers.length !== 2) {
				throw new MyError(`Invalid pair format supplied: "${pair}"`);
			}
			if (tickers[1] === 'USD') {
				let ret = await getTicker(pair, datetime, exchange);
				output.datetime = [ ret.datetime ];
				output.id = [ ret.uuid ];
				output.rate = ret.rate;
			} else {
				let first = await getTicker(`${tickers[0]}/USD`, datetime, exchange);
				let second = await getTicker(`${tickers[1]}/USD`, datetime, exchange);
				output.datetime = [ first.datetime, second.datetime ];
				output.id = [ first.uuid, second.uuid ];
				output.rate = first.rate / second.rate;
			}
		} catch (error) {
			logger.error(`getTokenPairRate for pair ${pair} failed`, error);
		} finally {
			logger.info1('Response for getTokenPairRate', output);
			return output;
		}
	});
}

async function getAddressTransactions(input: AddressInputs) {
	logger.info1('Request for getAddressTransactions', input);
	return input.addresses.map(async ({ address, startDatetime, endDatetime, granularity }): Promise<TransactionOutput> => {
		let output: TransactionOutput = {
			address
		};
		try {
			let inTxs = await getAddressAggregations(address, startDatetime, endDatetime, granularity, true);
			output.receivedCount = inTxs.map((bucket) => bucket.bucket_stats.count);
			output.receivedAmount = inTxs.map((bucket) => bucket.bucket_stats.sum || 0);

			let outTxs = await getAddressAggregations(address, startDatetime, endDatetime, granularity, false);
			output.sentCount = outTxs.map((bucket) => bucket.bucket_stats.count);
			output.sentAmount = outTxs.map((bucket) => bucket.bucket_stats.sum || 0);
		} catch (error) {
			logger.error(`getAddressTransactions for address ${address} failed`, error);
		} finally {
			return output;
		}
	});
}
