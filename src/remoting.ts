import request from 'request-promise-native';
import logger from './logger';
import { MyError } from './errors';

export default class Remoting {
	constructor(private apiKey: string, private url: string) {}

	async _request<T>(method: string, params: object) {
		try {
			logger.debug(`Calling ${this.constructor.name} API: ${method.toUpperCase()} ${this.url} with params:`, params);
			let startTime = Date.now();
			let ret = await request[method]({ ...params, strictSSL: true, json: true, apikey: this.apiKey, url: this.url }) as T;
			logger.debug(`API Request took ${Date.now() - startTime} ms`);
			return ret;
		} catch (error) {
			throw new MyError(`${this.constructor.name} request failed`, { error });
		}
	}

	_get<T>(params: object) {
		return this._request<T>('get', {
			qs: params
		});
	}
}
