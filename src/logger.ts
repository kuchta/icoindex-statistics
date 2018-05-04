import moment from 'moment';
import winston, { LoggerInstance, LeveledLogMethod, TransportInstance, LoggerOptions } from 'winston';
export { LeveledLogMethod } from 'winston';

import { MyError } from './errors';

export interface MyLogger extends LoggerInstance {
	init: (verbose: number, debug: boolean) => void;
	info1: LeveledLogMethod;
}

const logger = winston as MyLogger;

const config = makeConfig('info');
logger.configure(config);
for (let level in config.levels!) {
	logger[level] = logMessage(level, false);
}

logger.init = (verbose = 0, debug: boolean) => {
	// console.log(`logger.init(verbose=${verbose}, debug=${debug})`);
	// Debug level active just after calling this.
	if (debug) {
		logger.configure(makeConfig('debug'));
	}

	for (let level in config.levels!) {
		let match = level.match(/(info)(\d)/);
		if (match && verbose < parseInt(match[2])) {
			// @ts-ignore: message, meta is declared but its value is never read
			logger[level] = function (message: string, ...meta: any[]) { return this; };
		// } else if (level === 'debug' && !debug) {
		// 	// @ts-ignore: message, meta is declared but its value is never read
		// 	logger[level] = function (message: string, ...meta: any[]) { return this; };
		} else {
			logger[level] = logMessage(level, debug);
		}
	}
};

function makeConfig(level: string): LoggerOptions {
	return {
		// padLevels: true,
		level: level,
		levels: {
			error: 0,
			warning: 1,
			info: 2,
			info1: 3,
			debug: 4,
		},
		colors: {
			error: 'red',
			warning: 'yellow',
			info: 'blue',
			info1: 'blue',
			debug: 'green',
		},
		transports: [
			new winston.transports.Console({
				level: level,
				timestamp: () => moment().format('HH:mm:ss'),
				colorize: true,
				prettyPrint: true,
				depth: 10,
				stderrLevels: ['error', 'warning'],
				// formatter: null
				// align: true
			})
		]
	};
}

function logMessage(level: string, debug: boolean) {
	return (message: string, obj?: any) => {
		let stack;
		let error;
		let object;

		// console.log(`message="${message}", obj="${JSON.stringify(obj)}`);

		if (obj != null) {
			if (obj instanceof Error) {
				error = obj;
			} else {
				if (obj.hasOwnProperty('error') || obj.hasOwnProperty('object')) {
					if (obj.hasOwnProperty('error')) {
						error = obj.error;
					}
					if (obj.hasOwnProperty('object')) {
						object = obj.object;
					}
				} else {
					object = obj;
				}
			}
		}

		// console.log(`message="${message}", error="${error}", object="${JSON.stringify(object)}"`);

		if (error instanceof Error) {
			stack = error.stack;
			if (error instanceof MyError) {
				if (message) {
					message = `${message}: ${error.toString()}`;
				} else {
					message = error.toString();
				}
				if (error.error) {
					// stack = error.error.stack;
					message = `${message}: ${error.error.toString()}`;
				}
				if (!object && error.object) {
					object = error.object;
				}
			} else {
				if (message) {
					message = `${message}: ${error.toString()}`;
				} else {
					message = error.toString();
				}
			}

			if (debug && stack) {
				message = `${message}\n${removeFirstLine(stack)}`;
			}
		}

		// console.log(`level=${level}, message="${message}", object="${JSON.stringify(object)}"`);

		if (object !== undefined) {
			logger.log(level, message, object);
		} else {
			logger.log(level, message);
		}

		return logger;
	};
}

function removeFirstLine(str: string) {
	let lines = str.split('\n');
	lines.splice(0, 1);
	return lines.join('\n');
}

export default logger;
