import { buildSchema, GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';
import express from 'express';
import graphqlHTTP from 'express-graphql';

import logger from '../logger';
import config from '../config';
import { Option, Ticker, TickerInput } from '../interfaces';
import { ping, getTicker } from '../elasticsearch';
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
		formatError: error => ({
			message: error.message,
			locations: error.locations,
			stack: error.stack ? error.stack.split('\n') : [],
			path: error.path
			})
	}));

	let server = app.listen(port, host, () => {
		if (listening) {
			listening();
		}
		logger.info(`GraphQL server is listening on ${server.address().address}:${server.address().port}/graphql`);
	});
}

const resolvers = {
	getTokenPairRate: async (input: TickerInput) => {
		return input.tickers.map(async ticker => {
			try {
				let pair = ticker.pair.split('/');
				if (pair.length !== 2) {
					throw new MyError(`Invalid pair format supplied: "${ticker.pair}"`);
				}
				if (pair[1] === 'USD') {
					return await getTicker(ticker.pair, ticker.datetime);
				} else {
					let first = await getTicker(`${pair[0]}/USD`, ticker.datetime);
					let second = await getTicker(`${pair[1]}/USD`, ticker.datetime);
					return {
							pair: ticker.pair,
							datetime: second.datetime,
							rate: first.rate / second.rate
					};
				}
			} catch (error) {
				logger.warning('getTokenPairRate error', error);
				return ticker;
			}
		});
	}
};
