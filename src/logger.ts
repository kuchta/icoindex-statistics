import * as winston from 'winston';
import moment from 'moment';

import { MyError } from './errors';
import { isNull } from 'util';

const config = {
	levels: {
		error: 0,
		warning: 1,
		info: 2,
		info1: 3,
		info2: 4,
		debug1: 8,
		debug2: 9
	},
	colors: {
		error: 'red',
		warning: 'yellow',
		info: 'blue',
		info1: 'blue',
		info2: 'blue',
		debug1: 'green',
		debug2: 'green'
	},
	// padLevels: true,
	transports: [
		new winston.transports.Console({
			level: 'debug2',
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

export interface MyLogger extends winston.Winston {
	init: (verbose: number, debug: number) => void;
	error: winston.LeveledLogMethod;
	warning: winston.LeveledLogMethod;
	info: winston.LeveledLogMethod;
	info1: winston.LeveledLogMethod;
	info2: winston.LeveledLogMethod;
	info3: winston.LeveledLogMethod;
	info4: winston.LeveledLogMethod;
	info5: winston.LeveledLogMethod;
	debug1: winston.LeveledLogMethod;
	debug2: winston.LeveledLogMethod;
}

(<MyLogger>winston).init = (verbose: number, debug: number) => {
	winston.configure(config);

	for (let level in config.levels) {
		let match = level.match(/(info|debug)(\d)/);
		if (match) {



			if ((match[1] === 'info' && verbose >= parseInt(match[2])) || (match[1] === 'debug' && debug >= parseInt(match[2]))) {
				// console.log('level: %s, match, verbose: %i, debug: %i', level, verbose, debug);
				winston[level] = logMessage(verbose, debug, winston, level);
			} else {
				// console.log('level: %s, no match, verbose: %i, debug: %i', level, verbose, debug);
				winston[level] = () => { /* Don't log */ };
			}
		} else {
			winston[level] = logMessage(verbose, debug, winston, level);
		}
	}
};

function logMessage(verbose: number, debug: number, logger: winston.Winston, level: string) {
	return (message: string, obj?: Object) => {
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
						error = obj['error'];
					}
					if (obj.hasOwnProperty('object')) {
						object = obj['object'];
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

			if (debug >= 2 && stack) {
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

export default <MyLogger>winston;
