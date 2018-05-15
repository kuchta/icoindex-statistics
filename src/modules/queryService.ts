import { Server } from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import graphqlHTTP from 'express-graphql';
import { buildSchema, GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';

import logger from '../logger';
import config from '../config';
import { Option, TickerInputs, TickerOutput } from '../interfaces';
import { ping, getTicker } from '../elastic';
import schema from '../../schema.gql';
import { MyError } from '../errors';

export const description = 'GraphQL Server';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'bind to this host' },
	{ option: '-p, --port <port>', description: 'bind to this port' },
];

export default function main(options: any) {
	queryService(options.host || config.GRAPHQL_HOST, options.port || config.GRAPHQL_PORT, (address, port) => {
		logger.info(`GraphQL server is listening on ${address}:${port}/graphql`);
	});
}

export function queryService(host: string, port: number, listening?: (address: string, port: number) => void) {
	let app = express();

	app.use('/graphql', graphqlHTTP({
		schema: buildSchema(schema),
		rootValue: resolvers,
		graphiql: true,
		formatError: (error) => ({
			message: error.message,
			locations: error.locations,
			stack: error.stack ? error.stack.split('\n') : [],
			path: error.path
		})
	}));

	let server = app.listen(port, host, () => {
		if (listening) {
			let address = server.address() as AddressInfo;
			listening(address.address, address.port);
		}
	});

	return server;
}

const resolvers = {
	getTokenPairRate: async (input: TickerInputs) => {
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
				logger.debug(error);
			} finally {
				return output;
			}
		});
	}
};
