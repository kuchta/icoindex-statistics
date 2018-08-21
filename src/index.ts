import path from 'path';
import fs from 'fs';
import * as readline from 'readline';

import commander from 'commander';

import logger from './logger';
import config from './config';
import { Option } from './interfaces';
import pkg from '../package.json';

/* Allow to import schema as text */
require.extensions['.gql'] = (module, filename) => {
	module.exports = fs.readFileSync(filename, 'utf8');
};

/* Error handling */

const unhandledRejections = new Map();

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
	unhandledRejections.set(promise, reason);
});

process.on('rejectionHandled', (promise: Promise<any>) => {
	unhandledRejections.delete(promise);
});

process.on('SIGINT', (/* signal: Signals */) => {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	if (process.exitCode !== undefined) {
		logger.warning('Force shutting down...');
		process.exit();
	} else {
		logger.warning('Shutting down...');
		process.exitCode = 0;
		process.emit('beforeExit', process.exitCode);
	}
});

process.on('uncaughtException', (error: Error) => {
	logger.error('Fatal Error', error);
	process.exit(1);
});

process.on('exit', (code: number) => {
	if (unhandledRejections.size > 0) {
		unhandledRejections.forEach((error) => {
			logger.warning('unhandledRejection', error);
		});
		if (code === 0) {
			process.exit(1);
		}
	}
	if (code !== 0) {
		logger.warning(`Exiting with error code: ${code}`);
	}
});

/* Parse command line */
commander
	.version(pkg.version)
	.usage('[options] <command> [options]')
	// @ts-ignore: 'v' is declared but its value is never read.
	.option('-v, --verbose', 'increase verbosity', (v, total) => total + 1, 0)
	.option('-d, --debug', 'enable debug messages')
	.on('--help', () => {
		console.log('');
		console.log('  Info:');
		console.log('');
		console.log('    If you want to terminate the program, hit Ctrl+C and wait for it to shutdown gracefully, hit it twice to shutdown forcefully');
	  });

/* Make options from configuration variables */
Object.keys(config).forEach((key) => {
	commander.option(`--${key.toLowerCase().replace(/\_/g, '-')} <${typeof config[key]}>`, `set config ${key}`, (value) => {
		config[key] = value;
	}, config[key]);
});

/* Find all program submodules and load them */
let modulesDir = path.join(__dirname, 'modules');
fs.readdirSync(modulesDir).map((file) => {
	let match = file.match(/(.*)\.(js|(?<!d\.)ts)$/);
	if (match) {
		let moduleName = match[1];
		const module = require(path.join(modulesDir, moduleName));
		if (module.default) {
			let command = commander.command(moduleName);
			if (module.description) {
				command.description(module.description);
			}
			if (module.args) {
				command.arguments(module.args.map((arg: string) => `<${arg}>`).join(' '));
			}
			if (module.options) {
				module.options.forEach((option: Option) => {
					command.option(option.option, option.description, option.defaultValue);
				});
			}
			command.action((...options) => {
				logger.init(commander.verbose, commander.debug);
				logger.info(`Running ${moduleName}...`);
				module.default(...options);
			});
		}
	}
});

commander.parse(process.argv);

if (commander.args.length < 1) {
	commander.help();
}
