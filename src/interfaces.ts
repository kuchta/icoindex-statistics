export type Option = {
	option: string;
	description: string;
};

export interface TickerInput {
	tickers: Ticker[];
}

export interface Ticker {
	pair: string;
	datetime: string;
	rate: number;
}
