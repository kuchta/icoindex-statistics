import path from 'path';
import fs from 'fs';
import * as readline from 'readline';

import commander from 'commander';

import logger from './logger';

import pkg from '../package.json';

// Parse command line

commander
	.version(pkg.version)
	.option('-v, --verbose', 'Increase verbosity', (v, total) => total + 1, 0)
	.option('-d, --debug', 'Increase verbosity of debug messages', (v, total) => total + 1, 0);

commander.parse(process.argv);

logger.init(commander.verbose, commander.debug);

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

if (!process.argv.slice(2).length) {
	commander.outputHelp();
}

// Error handling

const unhandledRejections = new Map();

process.on('unhandledRejection', handleUnhandledRejection);

function handleUnhandledRejection() {
	return (reason: any, promise: Promise<any>) => {
		unhandledRejections.set(promise, reason);
	};
}

process.on('rejectionHandled', handleRejectionHandled);

function handleRejectionHandled() {
	return (promise: Promise<any>) => {
		unhandledRejections.delete(promise);
	};
}

process.on('SIGINT', handleInt);
let stop = false;

function handleInt() {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	if (stop) {
		process.exit(0);
	} else {
		stop = true;
	}
}

process.on('uncaughtException', handleUncaughtException);

function handleUncaughtException() {
	return (error: Error) => {
		logger.error('uncaughtException', error);
		process.exit(1);
	};
}

process.on('exit', handleExit);

function handleExit(/* code: number */) {
	if (unhandledRejections.size > 0) {
		unhandledRejections.forEach((error) => {
			logger.error('unhandledRejection', error);
		});
		// if (code === 0) {
		// 	process.exit(1);
		// }
	}
}
