export type Option = {
	option: string;
	description: string;
};

/* My ticker */
export interface Ticker {
	id?: string;
	exchange: string;
	pair: string;
	datetime: string;
	rate: number;
}

/* Minimal CCXT ticker */
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

/* GraphQL getTokenPairRate input */
export interface TickerInputs {
	tickers: TickerInput[];
}

export interface TickerInput {
	exchange?: string;
	pair: string;
	datetime: string;
}

/* GraphQL output */
export interface TickerOutputs {
	getTokenPairRate: TickerOutput[];
}

export interface TickerOutput {
	id?: string;
	exchange: string;
	pair: string;
	datetime: string[];
	rate: number | null;
}
