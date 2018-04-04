import path from 'path';
import fs from 'fs';
import * as readline from 'readline';

import commander from 'commander';

import logger from './logger';

import pkg from '../package.json';

logger.init(commander.verbose, commander.debug);

// Parse command line

// function runModule(moduleName: string) {
// 	return (options: any) => {
// 		import(`./modules/${moduleName}`).then((module) => {
// 			module.default(options);
// 		}).catch((error) => {
// 			logger.error('Loading module failed', error);
// 		});
// 	};
// }

commander
	.version(pkg.version)
	.option('-v, --verbose', 'Increase verbosity', (v, total) => total + 1, 0)
	.option('-d, --debug', 'Increase verbosity of debug messages', (v, total) => total + 1, 0);

let modulesDir = path.join(__dirname, 'modules');

fs.readdirSync(modulesDir).map((file) => {
	let match = file.match(/(.*)\.js$/);
	if (match) {
		let moduleName = match[1];
		const module = require(path.join(modulesDir, moduleName));
			if (module.default) {
				let command = commander.command(moduleName);
				if (module.description) {
					command.description(module.description);
				}
				if (Array.isArray(module.options)) {
					module.options.forEach((option: {option: string, description: string}) => {
						command.option(option.option, option.description);
					});
				}
				command.action(module.default);
			}
	}
});

commander.parse(process.argv);

// Error handling

process.on('unhandledRejection', handleUnhandledRejection);
process.on('rejectionHandled', handleRejectionHandled);
process.on('uncaughtException', handleUncaughtException);
process.on('SIGINT', handleInt);
process.on('exit', handleExit);

const unhandledRejections = new Map();

function handleUnhandledRejection() {
	return (reason: any, promise: Promise<any>) => {
		// logger.error(`unhandledRejection`, {error})
		unhandledRejections.set(promise, reason);
	};
}

function handleRejectionHandled() {
	return (promise: Promise<any>) => {
		unhandledRejections.delete(promise);
	};
}

function handleInt() {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0, null);
	// if (stop) {
		process.exit(0);
	// } else {
		// stop = true;
	// }
}

function handleUncaughtException() {
	return (error: Error) => {
		if (commander.debug >= 1) {
			logger.error(`uncaughtException`, {error});
		} else {
			logger.error(null, {error});
		}
		process.exit(1);
	};
}

function handleExit(code: number) {
	if (unhandledRejections.size > 0) {
		unhandledRejections.forEach((error) => {
			if (commander.debug >= 1) {
				logger.error(`unhandledRejection`, {error});
			} else {
				logger.error(null, {error});
			}
		});
		if (code === 0) {
			process.exit(1);
		}
	}
}
