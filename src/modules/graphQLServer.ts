import { buildSchema, GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';
import express from 'express';
import graphqlHTTP from 'express-graphql';

import logger from '../logger';
import config from '../config';
import { Option, Ticker, TickerInput } from '../interfaces';
import { ping, getTicker } from '../elasticsearch';
import schema from '../../schema.gql';

export const description = 'GraphQL Server';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'bind to this host' },
	{ option: '-p, --port <port>', description: 'bind to this port' },
];

export default function main(options: any) {
	let host = options.host || config.GRAPHQL_HOST;
	let port = options.port || config.GRAPHQL_PORT;

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
		logger.info(`GraphQL server is listening on ${server.address().address}:${server.address().port}/graphql`);
	});
}

const resolvers = {
	getTokenPairRate: (args: TickerInput) => {
		return args.input.map(arg => getTicker(arg.pair, arg.datetime));
	}
};
