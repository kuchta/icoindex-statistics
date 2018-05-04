import { Server } from 'http';
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
	queryService(options.host || config.GRAPHQL_HOST, options.port || config.GRAPHQL_PORT);
}

export function queryService(host: string, port: number, listening?: () => void) {
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
		logger.info(`GraphQL server is listening on ${server.address().address}:${server.address().port}/graphql`);

		if (listening) {
			listening();
		}
	});

	return server;
}

const resolvers = {
	getTokenPairRate: async (input: TickerInputs) => {
		return input.tickers.map(async (ticker): Promise<TickerOutput> => {
			if (ticker.exchange === undefined) {
				ticker.exchange = 'coinmarketcap';
			}
			try {
				let pair = ticker.pair.split('/');
				if (pair.length !== 2) {
					throw new MyError(`Invalid pair format supplied: "${ticker.pair}"`);
				}
				if (pair[1] === 'USD') {
					let ret = await getTicker(ticker.pair, ticker.datetime, ticker.exchange);
					return { ...ret, datetime: [ ret.datetime ]};
				} else {
					let first = await getTicker(`${pair[0]}/USD`, ticker.datetime, ticker.exchange);
					let second = await getTicker(`${pair[1]}/USD`, ticker.datetime, ticker.exchange);
					return {
						exchange: ticker.exchange,
						pair: ticker.pair,
						datetime: [ first.datetime, second.datetime ],
						rate: (first.rate && second.rate) ? first.rate / second.rate : null
					};
				}
			} catch (error) {
				return {
					exchange: ticker.exchange,
					pair: ticker.pair,
					datetime: [ ticker.datetime ],
					rate: null
				};
			}
		});
	}
};
