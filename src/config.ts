export interface Config {
	AWS_REGION: undefined | string ;
	AWS_ACCESS_ID: undefined | string;
	AWS_SECRET_KEY: undefined | string;
	AWS_SQS_QUEUE_URL: string;
	AWS_DYNAMO_TABLE: string;
	AWS_ELASTIC_URL: string;
	AWS_DYNAMO_INTERVAL: number;
	EXCHANGE_INTERVAL: number;
}

export const config: Config = {
	AWS_REGION: process.env.AWS_REGION,
	AWS_ACCESS_ID: process.env.AWS_ACCESS_ID,
	AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
	AWS_SQS_QUEUE_URL: `https://sqs.${process.env.AWS_REGION}.amazonaws.com/234333348657/icoindex-staging-queue-coin-trading`,
	AWS_DYNAMO_TABLE: 'icoindexstaging.cointradinghistory',
	AWS_ELASTIC_URL: `https://search-icoindex-staging-gywi2nq266suyvyjfux67mhf44.${process.env.AWS_REGION}.es.amazonaws.com`,
	AWS_DYNAMO_INTERVAL: 100,
	EXCHANGE_INTERVAL: 5000
};
