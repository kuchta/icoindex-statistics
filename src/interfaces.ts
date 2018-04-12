// export { Ticker } from 'ccxt';

export type Options = {
	option: string;
	description: string;
}[];

export interface Ticker {
	ask: number;
	average?: number;
	baseVolume?: number;
	bid: number;
	change?: number;
	close?: number;
	datetime: string;
	first?: number;
	high: number;
	info: object;
	last?: number;
	low: number;
	open?: number;
	percentage?: number;
	quoteVolume?: number;
	symbol: string;
	timestamp: number;
	vwap?: number;
}
