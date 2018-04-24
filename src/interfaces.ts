export type Option = {
	option: string;
	description: string;
};

export interface TickerInput {
	input: Ticker[];
}

export interface Ticker {
	pair: string;
	datetime: string;
	rate: number;
}
