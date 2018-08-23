import path from 'path';

// import { networkInterfaces } from 'os';
import { AddressInfo } from 'net';
import { Server } from 'http';

import R from 'ramda';
import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { JsonRPCResponse, JsonRPCRequest } from 'web3/types';

import logger from '../logger';
import config from '../config';

import { Option } from '../interfaces';
import { TestData } from '../transactions';
import { Block, Transaction } from '../ethereumTypes';
import { Response as ESResponse, Transaction as ESTransaction } from '../etherscan';

import { getItem } from '../dynamo';
import { getBlockTransactionHash } from './txTest';

export const description = 'Transaction Mock Service';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'Bind service to this host', defaultValue: config.MOCKSERVICE_HOST },
	{ option: '-p, --port <port>', description: 'Bind service to this port', defaultValue: String(config.MOCKSERVICE_PORT) },
	{ option: '-f, --filename <file>', description: 'Load mock fixtures from file <file>', defaultValue: './testData/transactions.json' },
	{ option: '-n, --start-block-number <number>', description: 'Start with this number as the current block' },
];

let _blocks: Block[];
let _currentBlockNumber: number;
let _lastBlockNumber: number;

export default async function main(options: { [key: string]: string }) {
	const testData: TestData = require(path.resolve(__dirname, '..', '..', options.filename));

	const startBlockNumber = options.startBlockNumber ? Number(options.startBlockNumber) : Math.floor(testData.fixtures.length / 2);

	const server = await txMockService(startBlockNumber, testData.fixtures, options.host, parseInt(options.port), () => {
		const address = server.address() as AddressInfo;
		logger.info(`Mock service is listening on ${address.address}:${address.port}`);
	});
}

export function txMockService(startBlockNumber: number, blocks: Block[], host: string, port: number, listening?: (address: string, port: number) => void) {
	const app = express();

	app.use(bodyParser.json());

	app.use(logRequest);
	app.use(logResponse);

	// Convert timestamp from RFC-3339 to Unix time
	_blocks = R.map((block) => R.assoc('timestamp', String(Date.parse(block.timestamp) / 1000), block), blocks);
	_currentBlockNumber = startBlockNumber;
	_lastBlockNumber = Number(R.reduce(R.max, 0, R.pluck('number', _blocks)));

	// let blocks = R.map(R.over(R.lensProp('timestamp'), R.compose(String, Date.parse)), testData.fixtures);

	// let lastBlock = await getItem('address', 'lastBlock');
	// if (lastBlock && lastBlock.value) {
	// 	currentBlockNumber = lastBlock.value < lastBlockNumber ? lastBlock.value + 1 : lastBlock;
	// }

	app.all('/ethereum', mockEthereum);
	app.all('/etherscan', mockEtherscan);

	const server = app.listen(port, host, () => {
		process.on('beforeExit', () => {
			server.close();
		});

		if (listening) {
			const address = server.address() as AddressInfo;
			listening(address.address, address.port);
		}
	});

	return server;
}

function mockEthereum(req: Request, res: Response) {
	const request: JsonRPCRequest = req.body;
	let result;

	if (request.method === 'eth_blockNumber') {
		result = `0x${_currentBlockNumber.toString(16)}`;
		if (_currentBlockNumber < _lastBlockNumber) {
			_currentBlockNumber++;
		}
	} else if (request.method === 'eth_getBlockByNumber') {
		const block = R.find(R.propEq('number', request.params[0]), _blocks) || null;
		if (block) {
			block.hash = getBlockHash(block);
			block.transactions = block.transactions.map((transaction, index) => ({
				hash: getBlockTransactionHash(block, index),
				blockNumber: `0x${Number(block.number).toString(16)}`,
				transactionIndex: `0x${Number(index).toString(16)}`,
				...transaction
			}));
		}
		result = block;
	} else {
		res.sendStatus(400);
		return;
	}

	res.json({
		id: request.id,
		jsonrpc: request.jsonrpc,
		result
	} as JsonRPCResponse);
}

function mockEtherscan(req: Request, res: Response) {
	let result;

	if (req.query.module === 'account' && req.query.action === 'txlist' && req.query.address) {
		const data = R.filter((block) => {
			if (req.query.startBlock && req.query.endBlock) {
				return parseInt(block.number) >= parseInt(req.query.startBlock) && parseInt(block.number) <= parseInt(req.query.endBlock);
			} else if (req.query.startBlock) {
				return parseInt(block.number) >= parseInt(req.query.startBlock);
			} else if (req.query.endBlock) {
				return parseInt(block.number) <= parseInt(req.query.endBlock);
			} else {
				return true;
			}
		}, _blocks);

		let transactions = getTransactions(data);

		if (req.query.sort === 'asc') {
			transactions = R.sortBy(R.prop('timeStamp'), transactions);
			// R.sortWith([
			// 	R.ascend(R.prop('blockNumber')),
			// 	R.ascend(R.prop('transactionIndex'))
			// ], transactions);
		} else if (req.query.sort === 'dsc') {
			transactions = R.sort(R.descend(R.prop('timeStamp')), transactions);
			// R.sortWith([
			// 	R.descend(R.prop('blockNumber')),
			// 	R.descend(R.prop('name'))
			// ], transactions);
		}
		result = {
			status: R.isEmpty(transactions) ? '0' : '1',
			message: R.isEmpty(transactions) ? 'No transactions found' : 'OK',
			result: R.isEmpty(transactions) ? [] : transactions
		} as ESResponse<ESTransaction>;
	} else {
		res.sendStatus(400);
		return;
	}

	res.json(result);
}

function getTransactions(blocks: Block[]): ESTransaction[] {
	return R.reduce((transactions, block) => {
		block.transactions.forEach((transaction, index) => {
			transactions.push({
				hash: getBlockTransactionHash(block, index),
				blockNumber: block.number,
				timeStamp: block.timestamp,
				transactionIndex: String(index),
				from: transaction.from,
				to: transaction.to,
				value: transaction.value,
				...transaction
			});
		});
		return transactions;
	}, [] as ESTransaction[], blocks);
}

function getBlockHash(block: Block) {
	return `0x00000000000000000000000000000000000000${block.number.padStart(2, '0')}`;
}

function logRequest(req: Request, res: Response, next: NextFunction) {
	const obj = {};
	if (req.query && !R.isEmpty(req.query)) {
		obj['query'] = req.query;
	}
	if (req.body && !R.isEmpty(req.body)) {
		obj['body'] = req.body;
	}
	logger.debug(`Request: ${req.method} ${req.path}`, obj);

	next();
}

function logResponse(req: Request, res: Response, next: NextFunction) {
	const oldWrite = res.write;
	const oldEnd = res.end;

	const chunks: Buffer[] = [];

	res.write = (...restArgs: any[]) => {
		chunks.push(new Buffer(restArgs[0]));
		oldWrite.apply(res, restArgs);
		return true;
	};

	res.end = (...restArgs: any[]) => {
		if (restArgs[0]) {
			chunks.push(new Buffer(restArgs[0]));
		}
		let body = String(Buffer.concat(chunks));
		try {
			body = JSON.parse(body);
		} catch (error) {
			logger.error('logResponse error', error);
		}
		logger.debug(`Response: ${res.statusCode}`, body);
		oldEnd.apply(res, restArgs);
	};
	next();
}
