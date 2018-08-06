declare module '*/interfaces' {
	export interface Config {
		AWS_REGION: string;
		AWS_ACCESS_ID: string;
		AWS_SECRET_KEY: string;
		AWS_SNS_TOPIC: string;
		AWS_SQS_QUEUE_URL: string;
		AWS_DYNAMO_TABLE: string;
		AWS_ELASTIC_HOST: string;
		AWS_ELASTIC_TICKER_INDEX: string;
		AWS_ELASTIC_TICKER_TYPE: string;
		AWS_ELASTIC_TRANSACTION_INDEX: string;
		AWS_ELASTIC_TRANSACTION_TYPE: string;
		GRAPHQL_HOST: string;
		GRAPHQL_PORT: number;
		DYNAMO_INTERVAL: number;
		EXCHANGE_INTERVAL: number;
		EXCHANGE_TIMEOUT: number;
		MAX_DATETIME_PROXIMITY: string;
		ETHEREUM_HOST: string;
		ETHERSCAN_TOKEN: string;
		ETHPLORER_TOKEN: string;
	}

	export type Option = {
		option: string;
		description?: string;
	};

	/* My ticker */
	export interface Ticker {
		uuid: string;
		exchange: string;
		pair: string;
		datetime: string;
		rate: number;
	}

	export interface CCXTTickers {
		[x: string]: CCXTTicker;
	}

	export interface CCXTTicker {
		symbol: string;
		datetime: string;
		close: number;
	}

	export interface Exchange {
		id: string;
		fetchTickers(): Promise<CCXTTickers>;
	}

	export interface TestQuery {
		query: TickerInput;
		result: TickerOutput;
	}

	/* GraphQL getTokenPairRate input */
	export interface TickerInputs {
		tickers: TickerInput[];
	}

	export interface TickerInput {
		exchange?: string;
		pair: string;
		datetime: string;
	}

	/* GraphQL getTokenPairRate output */
	export interface TickerOutputs {
		getTokenPairRate: TickerOutput[];
	}

	export interface TickerOutput {
		exchange: string;
		pair: string;
		datetime: string[];
		id?: string[];
		rate?: number;
	}

	export interface AddressMessage {
		address: string;
		enabled: boolean;
	}

	export interface Address {
		address: string;
		enabled: boolean;
		enabledTime: string;
		lastBlock?: number; // Only used if address is disabled of address history is still loading
		loadTime?: number;
	}

	export interface AddressMap {
		lastBlock: { value: number };
		[address: string]: Address
	}

	export interface Transaction {
		uuid: string;
		blockHeight: number;
		datetime: string;
		value: number;
		from: string;
		to: string;
	}

	export interface MessageAttributes {
		historical?: boolean;
		storeEvent?: object;
	};

	/* GraphQL getAddressTransactions input */
	export interface AddressInputs {
		addresses: AddressInput[];
	}

	export interface AddressInput {
		address: string;
		startDatetime: string;
		endDatetime: string;
		granularity: string;
	}

	export interface TransactionOutput {
		address: string;
		receivedAmount?: any[];
		receivedCount?: any[];
		sentAmount?: any[];
		sentCount?: any[];
	}
}

declare module '*/config.json' {
	import { Config } from './interfaces';
	const content: Config;
	export default content;
}

declare module '*/package.json' {
	const content: any;
	export default content;
}

declare module '*/schema.gql' {
	const content: string;
	export default content;
}

declare module '*/testData/tickers.json' {
	import { TickerOutput } from './interfaces';
	import { TestQuery } from './interfaces';
	const content: { fixtures: TickerOutput[], queries: TestQuery[] };
	export default content;
}

declare module 'tokenbucket' {
	const content: any;
	export default content;
}
