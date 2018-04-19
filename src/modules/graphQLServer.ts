import { buildSchema, GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';
import express from 'express';
import graphqlHTTP from 'express-graphql';

import logger from '../logger';
import { Options, TokenPairRateOnDateTime, TokenPairRateOnDateTimeInput } from '../interfaces';
import { ping, getTicker } from '../elasticsearch';
import schema from '../../schema.gql';

export const description = 'GraphQL Server';
export const options: Options = [
	{ option: '-p, --ping', description: 'just ping ElasticSearch Cluster' },
];

export default function main(options: any) {
	if (options.ping) {
		logger.info('Pinging ElasticSearch server...');
		ping().then(() => {
			logger.info('ElasticSearch is alive');
		}).catch((error) => {
			logger.error('Ping ElasticSearch failed', error);
		});
	} else {
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
		app.listen(4000, (options: any) => logger.info('Running graphQL server on localhost:4000/graphql', options));
	}
}

const resolvers = {
	getTokenPairRate: (args: TokenPairRateOnDateTimeInput) => {
		return args.input.map(arg => getTicker(arg.pair, arg.datetime));
	}
};
