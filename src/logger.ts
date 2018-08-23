import util from 'util';

import R from 'ramda';
import winston from 'winston';
import { format } from 'logform';

import { MyError } from './errors';

export { LeveledLogMethod } from 'winston';

const LEVELS = {
	error: 'red',
	warning: 'yellow',
	info: 'gray',
	info1: 'cyan',
	info2: 'blue',
	debug: 'green',
};

export interface MyLogger extends winston.Logger {
	init: (verbose: number, debug: boolean) => void;
	error: winston.LeveledLogMethod;
	warning: winston.LeveledLogMethod;
	info: winston.LeveledLogMethod;
	info1: winston.LeveledLogMethod;
	info2: winston.LeveledLogMethod;
	debug: winston.LeveledLogMethod;
}

const logger: MyLogger = winston as any;

const config = makeConfig('info');
logger.configure(config);
for (const level in config.levels!) {
	logger[level] = logMessage(level, false);
}
winston.addColors(LEVELS);

logger.init = (verbose = 0, debug: boolean) => {
	if (debug) {
		let config = makeConfig('debug');
		logger.configure(config);
	} else if (verbose > 0) {
		logger.configure(makeConfig('info' + verbose));
	}

	for (const level in config.levels!) {
		const match = level.match(/(info)(\d)/);
		if (match && verbose < parseInt(match[2])) {
			// @ts-ignore: message, meta is declared but its value is never read
			logger[level] = function (message: string, ...meta: any[]) { return this; };
		} else {
			logger[level] = logMessage(level, debug);
		}
	}
};

function makeConfig(level: string): winston.LoggerOptions {
	return {
		// padLevels: true,
		level: level,
		levels: R.zipObj(Object.keys(LEVELS), [...Object.keys(LEVELS).keys()]),
		format: winston.format.combine(
			winston.format.colorize({ all: true }),
			format((info, opts) => {
				if (info[Symbol.for('splat') as any]) {
					info.metadata = info[Symbol.for('splat') as any][0];
				}
				return info;
			})(),
			winston.format.timestamp({ format: 'hh:mm:ss' }),
			winston.format.padLevels({ levels: R.zipObj(Object.keys(LEVELS), [...Object.keys(LEVELS).keys()]) }),
			winston.format.printf(info => {
				if (info.metadata) {
					return `${info.timestamp} ${info.level}: ${info.message}\n${util.inspect(info.metadata, { colors: true, depth: 10 })}`;
				} else {
					return `${info.timestamp} ${info.level}: ${info.message}`;
				}
			}),
		),
		transports: [
			new winston.transports.Console({
				level: level,
				stderrLevels: ['error', 'warning']
			})
		]
	};
}

function logMessage(level: string, debug: boolean) {
	return (message: string, obj?: any) => {
		let stack;
		let error;
		let object;

		if (obj != null) {
			if (obj instanceof Error) {
				error = obj;
			} else {
				if (obj.error || obj.object) {
					if (obj.error) {
						error = obj.error;
					}
					if (obj.object) {
						object = obj.object;
					}
				} else {
					object = obj;
				}
			}
		}

		if (error instanceof Error) {
			message = getErrorMessage(error, message);
			stack = getLastError(error).stack;
			if (!object) {
				object = getLastErrorObject(error);
			}

			if (debug && stack) {
				message = `${message}\n${removeFirstLine(stack)}`;
			}
		}

		if (object !== undefined) {
			logger.log(level, message, object);
		} else {
			logger.log(level, message);
		}

		return logger;
	};
}

function getErrorMessage(error: Error, message?: string): string {
	let msg;
	if (message) {
		msg = `${message}: ${String(error)}`;
	} else {
		msg = String(error);
	}
	if (error instanceof MyError && error.error) {
		msg = getErrorMessage(error.error, msg);
	}

	return msg;
}

function getLastError(error: Error): Error {
	if (error instanceof MyError && error.error) {
		return getLastError(error.error);
	}
	return error;
}

function getLastErrorObject(error: Error): Error {
	let object;
	if (error instanceof MyError && error.error) {
		object = getLastErrorObject(error.error);
	}
	if (object) {
		return object;
	} else {
		return error['object'];
	}
}

function removeFirstLine(str: string) {
	const lines = str.split('\n');
	lines.splice(0, 1);
	return lines.join('\n');
}

export default logger as MyLogger;
