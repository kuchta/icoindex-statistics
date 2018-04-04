declare module 'coinmarketcap-api' {
	interface GlobalOptions {
		convert?: string;
	}

	interface GlobalResult {
		total_market_cap_usd: string;
		total_24h_volume_usd: string;
		bitcoin_percentage_of_market_cap: string;
		active_currencies: string;
		active_assets: string;
		active_markets: string;
		last_updated: string;
	}

	interface TickerOptions {
		start?: number;
		limit?: number;
		convert?: string;
		currency?: string;
	}

	interface TickerResult {
		id: string;
		name: string;
		symbol: string;
		rank: string;
		price_usd: string;
		price_btc: string;
		market_cap_usd: string;
		available_supply: string;
		total_supply: string;
		max_supply: string;
		percent_change_1h: string;
		percent_change_24h: string;
		percent_change_7d: string;
		last_updated: string;
	}

	class CoinMarketCap {
		constructor();
		getGlobal(options: GlobalOptions): GlobalResult;
		getTicker(options: TickerOptions): TickerResult[];
	}
	export = CoinMarketCap
}


