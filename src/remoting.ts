import request from 'request-promise-native';

import { MyError } from './errors';
import logger from './logger';

export default class Remoting {
	constructor(private url: string, private apiKey: string) {
		// logger.debug(`Creating ${this.constructor.name} client with params: url=${url}, apiKey=${apiKey}...`);
	}

	async _request<T>(method: string, path: string, params: object) {
		try {
			const url = `${this.url}${path}`;
			logger.debug(`Calling ${this.constructor.name} API: ${method.toUpperCase()} ${url} with params:`, params);
			const startTime = Date.now();
			const ret = await request[method]({ ...params, strictSSL: true, json: true, apikey: this.apiKey, url: url }) as T;
			logger.debug(`API Request took ${Date.now() - startTime} ms`);

			return ret;
		} catch (error) {
			throw new MyError(`${this.constructor.name} request failed`, { error });
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
}
