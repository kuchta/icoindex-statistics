import moment from 'moment';
import winston, { LoggerInstance, LeveledLogMethod, TransportInstance } from 'winston';
export { LeveledLogMethod } from 'winston';

import { MyError } from './errors';

export interface MyLogger extends LoggerInstance {
	init: (verbose: number, debug: boolean) => void;
	// [index: string]: LeveledLogMethod;
	error: LeveledLogMethod;
	warning: LeveledLogMethod;
	info: LeveledLogMethod;
	info1: LeveledLogMethod;
	info2: LeveledLogMethod;
	debug: LeveledLogMethod;
}

const config = {
	levels: {
		error: 0,
		warning: 1,
		info: 2,
		info1: 3,
		info2: 4,
		debug: 5,
	},
	colors: {
		error: 'red',
		warning: 'yellow',
		info: 'blue',
		info1: 'blue',
		info2: 'blue',
		debug: 'green',
	},
	// padLevels: true,
	transports: [
		new winston.transports.Console({
			level: 'debug',
			timestamp: () => moment().format('HH:mm:ss'),
			colorize: true,
			prettyPrint: true,
			depth: 5,
			stderrLevels: ['error', 'warning'],
			// formatter: null
		// align: true
		})
	]
};

// type Levels =
// 	'error' |
// 	'warning' |
// 	'info' |
// 	'info1' |
// 	'info2' |
// 	'debug'

const logger = winston as MyLogger;

for (let level in config.levels) {
	logger[level] = logMessage(level, false);
}

logger.init = (verbose: number, debug: boolean) => {
	logger.configure(config);

	for (let level in config.levels) {
		let match = level.match(/(info)(\d)/);
		if (match && match[1] === 'info' && verbose < parseInt(match[2])) {
			// console.log('level: %s, no match, verbose: %i, debug: %i', level, verbose, debug);
			// @ts-ignore: message, meta is declared but its value is never read
			logger[level] = function (message: string, ...meta: any[]) { return this; };
		} else if (level === 'debug' && !debug) {
			// console.log('level: %s, no match, verbose: %i, debug: %i', level, verbose, debug);
			// @ts-ignore: message, meta is declared but its value is never read
			logger[level] = function (message: string, ...meta: any[]) { return this; };
		} else {
			logger[level] = logMessage(level, debug);
		}
	}
};

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

		// console.log(`message="${message}", object="${JSON.stringify(object)}"`);

		if (object !== undefined) {
			logger.log(level, message, object);
		} else {
			logger.log(level, message);
		}
	};
}

function removeFirstLine(string: string) {
	let lines = string.split('\n');
	lines.splice(0, 1);
	return lines.join('\n');
}

export default logger;
