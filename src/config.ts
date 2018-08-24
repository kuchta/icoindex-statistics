import logger from './logger';
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
	let rep = 3; // This is actually just 3 times, because cli parser takes every config item 2 times
	return () => {
		if (--rep <= 0) {
			logger.debug(`Getting config: ${key}: ${format(value)}...`);
			Object.defineProperty(config, key, {
				value: value,
				writable: true
			});
		} else {
			logger.debug(`Getting config: ${key}: ${format(value)}`);
		}
		return value;
	};
}

function format(value: any) {
	return typeof value === 'string' ? `"${value}"` : value;
}

/* Load config from environment */
Object.keys(config).forEach((key) => {
	const env = process.env[`IS_${key}`];
	if (env) {
		config[key] = env;
	}
});

export default config;
