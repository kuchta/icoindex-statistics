export interface Config {
	AWS_REGION: string;
	AWS_ACCESS_ID: string;
	AWS_SECRET_KEY: string;
	AWS_SQS_QUEUE_URL: string;
	AWS_DYNAMO_INTERVAL: number;
	EXCHANGE_INTERVAL: number;
}

export const config: Config = {
	AWS_REGION: process.env.AWS_REGION,
	AWS_ACCESS_ID: process.env.AWS_ACCESS_ID,
	AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
	AWS_SQS_QUEUE_URL: 'https://sqs.eu-west-1.amazonaws.com/234333348657/icoindex-staging-queue-coin-trading',
	AWS_DYNAMO_INTERVAL: 5000,
	EXCHANGE_INTERVAL: 5000
};
