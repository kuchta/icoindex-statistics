import logger from './logger';
import { MyError } from './errors';
import config from '../config.json';

Object.entries(config).forEach(([key, value]) => {
	Object.defineProperty(config, key, {
		get: getter(key, value),
		set: (val) => {
			if (typeof value === 'number') {
				val = parseInt(val);
			}
			logger.debug(`Setting config: ${key}: ${format(val)}`);
			Object.defineProperty(config, key, {
				get: getter(key, val)
			});
		}
	});
});

function getter(key: string, value: any) {
	let rep = 5; // This is actually just 3 times, because cli parser takes every config item 2 times
	return () => {
		logger.debug(`Getting config: ${key}: ${format(value)}...`);
		if (--rep <= 0) {
			Object.defineProperty(config, key, {
				value: value,
				writable: true
			});
		}
		return value;
	};
}

function format(value: any) {
	return typeof value === 'string' ? `"${value}"` : value;
}

/* Load config from environment */
Object.keys(config).forEach((key) => {
	let env = process.env[`IS_${key}`];
	if (env) {
		config[key] = env;
	}
});

export default config;
