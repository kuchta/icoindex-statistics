import path from 'path';
import fs from 'fs';
import * as readline from 'readline';

import commander from 'commander';

import logger from './logger';
import pkg from '../package.json';

// Error handling

const unhandledRejections = new Map();

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
	unhandledRejections.set(promise, reason);
});

process.on('rejectionHandled', (promise: Promise<any>) => {
	unhandledRejections.delete(promise);
});

let stop = false;
process.on('SIGINT', (/* signal: Signals */) => {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	if (stop) {
		process.exit(0);
	} else {
		stop = true;
	}
});

process.on('uncaughtException', (error: Error) => {
	logger.error('Fatal Error', error);
	process.exit(1);
});

process.on('exit', (code: number) => {
	if (code !== 0) {
		logger.warning(`Exiting with error code: ${code}`);
	}
	if (unhandledRejections.size > 0) {
		unhandledRejections.forEach((error) => {
			logger.warning('unhandledRejection', error);
		});
		// if (code === 0) {
		// 	process.exit(1);
		// }
	}
});

// Parse command line

commander
	.version(pkg.version)
	.usage('[options] <command> [options]')
	// .option('-h, --help', 'output usage information', () => {
	// 	logger.init(commander.verbose, commander.debug);
	// 	commander.help();
	// })
	// @ts-ignore: 'v' is declared but its value is never read.
	.option('-v, --verbose', 'increase verbosity', (v, total) => total + 1, 0)
	.option('-d, --debug', 'enable debug messages')
	.on('--help', () => {
		console.log('');
		console.log('  Info:');
		console.log('');
		console.log('    If you want to terminate the program, hit Ctrl+C twice');
	  });
	// .addImplicitHelpCommand();

// Find all program submodules and load them

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
				command.action((options) => {
					logger.init(commander.verbose, commander.debug);
					logger.info(`Starting ${moduleName}...`);
					module.default(options);
				});
			}
	}
});

commander.parse(process.argv);

if (!process.argv.slice(2).length) {
	commander.help();
}
