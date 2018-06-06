import request from 'request-promise-native';
import TokenBucket from 'tokenbucket';

import { MyError } from './errors';

const URL_ROOT = 'https://api.blockcypher.com/v1';

export default class BlockCypher {
	private tokenInfo: object;
	private tokenBucket: any;

	/**
	 * <b>BlockCypher API Client</b>.
	 * @constructor
	 * @param {string}	coin	The coin for which you're using the BlockCypher API. Can be 'btc', 'ltc', 'doge', or 'bcy'.
	 * @param {string}	chain	The chain for which you're using the BlockCypher API. Can be 'main', 'test', or 'test3'.
	 * @param {string}	token	Your BlockCypher API Token.
	 * @param {string}	[url]	BlockCypher API URL_ROOT.
	 */
	constructor(private coin: string, private chain: string, private token: string, private url = URL_ROOT) { }

	async init() {
		this.tokenInfo = await this._getToken(this.token);

		const dayTokenBucket = new TokenBucket({
			size: this.tokenInfo['limits']['api/day'],
			tokensToAddPerInterval: this.tokenInfo['limits']['api/day'],
			interval: 'day'
		});

		const hourTokenBucket = new TokenBucket({
			size: this.tokenInfo['limits']['api/hour'],
			tokensToAddPerInterval: this.tokenInfo['limits']['api/hour'],
			interval: 'hour',
			parentBucket: dayTokenBucket
		});

		this.tokenBucket = new TokenBucket({
			size: this.tokenInfo['limits']['api/hour'],
			tokensToAddPerInterval: this.tokenInfo['limits']['api/hour'],
			interval: 'second',
			parentBucket: hourTokenBucket
		});
	}

	_getToken(token: string) {
		return request.get(`${this.url}/tokens/${token}`);
	}

	async _request(method: string, path: string, params: object) {
		try {
			await this.tokenBucket.removeTokens(1);
			return request[method]({ ...params, strictSSL: true, json: true, url: `${this.url}/${this.coin}/${this.chain}/${this.chain}/${path}` });
		} catch (error) {
			throw new MyError('BlockCypher request failed', { error });
		}
	}

	/**
	 * <b>Helper for GET calls</b>
	 *
	 * @private
	 * @param {string}	path	Endpoint after URL_ROOT.
	 * @param {Object}	params	Additional URL parameters.
	 */
	_get(path: string, params: object) {
		params = { ...params, token: this.token };
		return this._request('get', path, {
			qs: params
		});
	}

	/**
	 * <b>Helper for POST calls</b>
	 *
	 * @private
	 * @param {string}	path	Endpoint after URL_ROOT.
	 * @param {Object}	params	Optional additional URL parameters.
	 * @param {Object}	data	Optional data to post.
	 */
	_post(path: string, params: object, data: object) {
		const urlr = `${this.url}/${this.coin}/${this.chain}/${path}`;
		params = { ...params, token: this.token };
		return this._request('post', path, {
			qs: params,
			body: data
		});
	}

	/**
	 * <b>Helper for DELETE calls</b>
	 *
	 * @private
	 * @param {string}	path	Endpoint after URL_ROOT.
	 * @param {Object}	params	Additional URL parameters.
	 * @method			get
	 */
	_del(path: string, params: object) {
		params = { ...params, token: this.token };
		return this._request('del', path, {
			qs: params
		});
	}

	/**
	 * <b>Get Chain</b>
	 * Get info about the blockchain you're querying.
	 */
	getChain() {
		return this._get('/', {});
	}

	/**
	 * <b>Get Block</b>
	 * Get info about a block you're querying under your object's coin/chain, with additional parameters. Can use either block height or hash.
	 * @param {(string|number)}	hashOrHeight	Hash or height of the block you're querying.
	 * @param {Object}			[params]		Optional URL parameters.
	 */
	getBlock(hashOrHeight: string | number, params: object) {
		return this._get('/blocks/' + hashOrHeight, params);
	}

	/**
	 * <b>Get Addr Bal</b>
	 * Get balance information about an address.
	 * @param {(string|number)}	addr		Address you're querying.
	 * @param {Object}			[params]	Optional URL parameters.
	 */
	getAddressBalance(addr: string | number, params: object) {
		// FIXUP
		return this._get('/addrs/' + addr + '/balance', params);
	}

	/**
	 * <b>Get Addr</b>
	 * Get information about an address, including concise transaction references.
	 * @param {(string|number)}	addr		Address you're querying.
	 * @param {Object}			[params]	Optional URL parameters.
	 */
	getAddress(addr: string, params: object) {
		return this._get('/addrs/' + addr, params);
	}

	/**
	 * <b>Get Addr Full</b>
	 * Get information about an address, including full transactions.
	 * @param {(string|number)}	addr		Address you're querying.
	 * @param {Object}			[params]	ptional URL parameters.
	 */
	getAddressFull(addr: string, params: object) {
		return this._get('/addrs/' + addr + '/full', params);
	}

	/**
	 * <b>Get Transaction</b>
	 * Get transaction by hash.
	 * @param {string}	hash	Hash of the transaction.
	 * @param {Object}	params	Optional URL parameters.
	 */
	getTX(hash: string, params: object) {
		return this._get('/txs/' + hash, params);
	}

	/**
	 * <b>Create WebHook</b>
	 * Creates a new webhook.
	 * @param {Object}	data	JSON Data used to create webhook.
	 */
	createHook(data: object) {
		return this._post('/hooks', {}, data);
	}

	/**
	 * <b>List WebHooks</b>
	 * Lists current webhooks associated with this blockchain and token.
	 */
	listHooks() {
		return this._get('/hooks', {});
	}

	/**
	 * <b>Get WebHook</b>
	 * Get information about a WebHook based on its ID.
	 * @param {string}	id	ID of the WebHook you're querying.
	 */
	getHook(id: string) {
		return this._get('/hooks/' + id, {});
	}

	/**
	 * <b>Delete WebHook</b>
	 * Deletes WebHook by its id.
	 * @param {string}	id	ID of the WebHook you're deleting.
	 */
	delHook(id: string) {
		return this._del('/hooks/' + id, {});
	}
}
