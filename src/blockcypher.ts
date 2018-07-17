import request from 'request-promise-native';
import TokenBucket from 'tokenbucket';

import logger from './logger';
import config from './config';
import { MyError } from './errors';

const BASE_URL = 'https://api.blockcypher.com/v1';
let token: string;
let tokenBucket: any;

export interface Address {
	address: string;
	total_received: number;
	total_sent: number;
	balance: number;
	unconfirmed_balance: number;
	final_balance: number;
	n_tx: number;
	unconfirmed_n_tx: number;
	final_n_tx: number;
	tx_url: string;
	txrefs: TXRef[];
	unconfirmed_txrefs: TXRef[];
	hasMore: boolean;
}

export interface TXRef {
	block_height: number;
	tx_hash: string;
	tx_input_n: number;
	tx_output_n: number;
	value: number;
	double_spend: boolean;
	confirmations: number;
	ref_balance: number;
	confirmed: string;
	double_of: string;
}

export interface AddressOptions {
	before?: number;
	after?: number;
	limit?: number;
	confirmations?: number;
}

async function init() {
	token = config.BLOCKCYPHER_TOKEN;

	const tokenInfo = await request.get(`${BASE_URL}/tokens/${token}`, { strictSSL: true, json: true });

	const dayTokenBucket = new TokenBucket({
		size: tokenInfo['limits']['api/day'],
		tokensToAddPerInterval: tokenInfo['limits']['api/day'],
		interval: 'day'
	});

	const hourTokenBucket = new TokenBucket({
		size: tokenInfo['limits']['api/hour'],
		tokensToAddPerInterval: tokenInfo['limits']['api/hour'],
		interval: 'hour',
		parentBucket: dayTokenBucket
	});

	tokenBucket = new TokenBucket({
		size: tokenInfo['limits']['api/hour'],
		tokensToAddPerInterval: tokenInfo['limits']['api/hour'],
		interval: 'second',
		parentBucket: hourTokenBucket
	});
}

export default class BlockCypher {
	url: string;

	/**
	 * <b>BlockCypher API Client</b>.
	 * @constructor
	 * @param {string}	coin	The coin for which you're using the BlockCypher API. Can be 'btc', 'ltc', 'doge', or 'bcy'.
	 * @param {string}	chain	The chain for which you're using the BlockCypher API. Can be 'main', 'test', or 'test3'.
	 */
	constructor(private coin: string, private chain: string) {
		this.url = `${BASE_URL}/${coin}/${chain}`;
	}

	async _request<T>(method: string, path: string, params: object) {
		try {
			if (!tokenBucket) {
				await init();
			}
			await tokenBucket.removeTokens(1);
			const url = `${this.url}${path}`;
			logger.debug(`Calling BlockCypher API: ${method.toUpperCase()} ${url} with params:`, params);
			return request[method]({ ...params, strictSSL: true, json: true, token, url }) as T;
		} catch (error) {
			throw new MyError('BlockCypher request failed', { error });
		}
	}

	_get<T>(path: string, params: object) {
		return this._request<T>('get', path, {
			qs: params
		});
	}

	_post(path: string, params: object, data: object) {
		return this._request('post', path, {
			qs: params,
			body: data
		});
	}

	_del(path: string, params: object) {
		return this._request('del', path, {
			qs: params
		});
	}

	getChain() {
		return this._get('/', {});
	}

	getBlock(hashOrHeight: string | number, params: object) {
		return this._get(`/blocks/${hashOrHeight}`, params);
	}

	getAddressBalance(addr: string | number, params: object) {
		// FIXUP
		return this._get(`/addrs/${addr}/balance`, params);
	}

	getAddress(addr: string, params: AddressOptions) {
		return this._get<Address>(`/addrs/${addr}`, params);
	}

	getTX(hash: string, params: object) {
		return this._get(`/txs/${hash}`, params);
	}

	createHook(data: object) {
		return this._post('/hooks', {}, data);
	}

	listHooks() {
		return this._get('/hooks', {});
	}

	getHook(id: string) {
		return this._get(`/hooks/${id}`, {});
	}

	delHook(id: string) {
		return this._del(`/hooks/${id}`, {});
	}
}
