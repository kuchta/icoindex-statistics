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
		QUERYSERVICE_HOST: string;
		QUERYSERVICE_PORT: number;
		MOCKSERVICE_HOST: string;
		MOCKSERVICE_PORT: number;
		DYNAMO_INTERVAL: number;
		EXCHANGE_INTERVAL: number;
		EXCHANGE_TIMEOUT: number;
		MAX_DATETIME_PROXIMITY: string;
		ETHEREUM_URL: string;
		ETHERSCAN_URL: string;
		ETHERSCAN_TOKEN: string;
		ETHPLORER_URL: string;
		ETHPLORER_TOKEN: string;
		BLOCKCYPHER_URL: string;
		BLOCKCYPHER_TOKEN: string;
	}

	export type Option = {
		option: string;
		description?: string;
		defaultValue?: string;
	};

	export interface MessageAttributes {
		historical?: boolean;
		storeEvent?: object;
	}
}

declare module '*/fixtures' {
	export interface Query<Q, R> {
		query: Q;
		result: R;
	}
}

declare module '*/tickers' {
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
		close?: number;
	}

	export interface Exchange {
		id: string;
		fetchTickers(): Promise<CCXTTickers>;
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

	export interface TickerFixture {
		pair: string;
		datetime: string;
		rate: number;
	}

	import { Query } from './fixtures';

	export interface TestData {
		fixtures: TickerFixture[];
		queries: Query<TickerInput, TickerOutput>[];
	}
}

declare module '*/transactions' {
	export interface Transaction {
		uuid: string;
		blockNumber: number;
		timeStamp: string;
		from: string;
		to: string;
		value: number;
	}

	export interface AddressMap {
		lastBlock?: { value: number };
		[address: string]: Address
	}

	export interface Address {
		address: string;
		enabled: boolean;
		enabledTime: string;
		lastBlock?: number; // Only used if address is disabled of address history is still loading
		loadTime?: number;
	}

	export interface AddressMessage {
		address: string;
		enabled: boolean;
	}

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

	/* GraphQL getAddressTransactions output */
	export interface TransactionOutputs {
		getAddressTransactions: TransactionOutput[];
	}

	export interface TransactionOutput {
		address: string;
		receivedAmount?: any[];
		receivedCount?: any[];
		sentAmount?: any[];
		sentCount?: any[];
	}

	import { Block } from './ethreumTypes';
	import { Query } from './fixtures';

	export interface TestData {
		fixtures: Block[];
		queries: Query<AddressInput, TransactionOutput>[];
	}
}

declare module '*/ethereumTypes' {
	export interface Block {
		number: string;
		timestamp: string;
		transactions: Transaction[];
		hash?: string;
		transactionsRoot?: string;
		size?: string;
		parentHash?: string;
		stateRoot?: string;
		receiptsRoot?: string;
		miner?: string;
		uncles?: string;
		sha3Uncles?: string;
		logsBloom?: string;
		difficulty?: string;
		totalDifficulty?: string;
		extraData?: string;
		nonce?: string;
		mixHash?: string;
		gasLimit?: string;
		gasUsed?: string;
	}

	export interface Transaction {
		blockHash?: string;
		blockNumber?: string;
		transactionIndex?: string;
		hash: string;
		from: string;
		to: string;
		value: string;
		input?: string;
		gas?: string;
		gasPrice?: string;
		nonce?: string;
		// r?: string;
		// s?: string;
		// v?: string;
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
	import { TestData } from './tickers';
	const content: TestData;
	export default content;
}

declare module '*/testData/transactions.json' {
	import { TestData } from './transactions';
	const content: TestData;
	export default content;
}

// declare module 'tokenbucket' {
// 	const content: any;
// 	export default content;
// }
