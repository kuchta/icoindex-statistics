import fs from 'fs';
import readline from 'readline';

import moment from 'moment';
import { v4 } from 'uuid';
// import { Observable } from 'rxjs';
// import { takeWhile } from 'rxjs/operators';
import { pipe, forEach } from 'callbag-basics';
import puppeteer from 'puppeteer';

import { Option } from '../interfaces';
import { MyError } from '../errors';
import { Ticker } from '../tickers';

import logger from '../logger';
import { sendMessage } from '../sns';

const DEFAULT_URL = `https://coinmarketcap.com/currencies/bitcoin/historical-data/?start=20130428&end=${moment().format('YYYYMMDD')}`;

export const description = 'CoinMarketCap Historical Data Importer';
export const options: Option[] = [
	{ option: '-u, --url <url>', description: 'Load from CoinMarketCap URL', defaultValue: DEFAULT_URL },
	{ option: '-f, --store-to-file <file>', description: 'Store tickers to file' },
	{ option: '-l, --load-from-file <file>', description: 'Load tickers from file' },
];

const EXCHANGE_ID = 'coinmarketcap';

type START = 0;
type DATA = 1;
type END = 2;

type Callbag = (type: START | DATA | END, payload?: any) => void;
type CoinDateRate = { coin?: string, date: string, rate: number };

export default async function main(options: { [key: string]: string }) {

	let loadCallbag = loadFromWeb(options.url);
	if (options.loadFromFile) {
		loadCallbag = loadFromFile(options.loadFromFile);
	}

	let storeCallbag = storeToQueue;
	if (options.storeToFile) {
		storeCallbag = storeToFile(options.storeToFile);
	}

	let counter = 0;
	pipe(loadCallbag, storeCallbag, forEach((x: any) => logger.info(`${counter++}. written:`, x)));
}

function loadFromFile(file: string) {
	return async (type: number, callbag: (type: number, payload?: any) => void) => {
		if (type !== START) {
			logger.error(`loadFromFile: This source callbag only supports type #0 but was called with #${type}`);
			return;
		}

		const input = fs.createReadStream(file);
		const lineReader = readline.createInterface({ input });

		callbag(0, (type: number) => {
			if (type !== 2) {
				logger.error(`loadFromFile: This source callbag only supports type #2 but was called with #${type}`);
				return;
			}
			lineReader.close();
		});

		lineReader.on('close', () => {
			callbag(2);
		});

		lineReader.on('line', (line: string) => {
			const data = line.split(' ');
			callbag(1, { coin: data[0], date: data[1], rate: Number(data[2]) });
		});
	};
}

function loadFromWeb(url: string) {
	return async (type: number, callbag: (type: number, payload?: any) => void) => {
		let stop = false;

		if (type !== 0) {
			logger.error(`loadFromWeb: This source callbag only supports type #0 but was called with #${type}`);
			return;
		}

		callbag(0, (type: number) => {
			if (type !== 2) {
				logger.error(`loadFromWeb: This source callbag only supports type #2 but was called with #${type}`);
				return;
			}
			stop = true;
		});

		let browser: puppeteer.Browser | undefined = undefined;
		try {
			browser = await puppeteer.launch();
			const page = await browser.newPage();

			await loadPage(page, url);

			const coin = await page.evaluate(getCoin);

			if (!coin) {
				callbag(2, new MyError('Coin symbol was not found on page'));
				return;
			}

			const tickers: CoinDateRate[] = await page.evaluate(getTickers);

			for (const ticker of tickers) {
				if (stop) {
					break;
				}

				callbag(1, { coin, date: moment(new Date(ticker.date)).format('YYYYMMDD'), rate: ticker.rate });
			}

			callbag(2);
		} catch (error) {
			callbag(2, error);
		} finally {
			if (browser) {
				browser.close();
			}
		}
	};
}

async function loadPage(page: puppeteer.Page, url: string) {
	logger.debug(`Loading page ${url}`);

	try {
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		logger.debug(`Loaded page ${url}`);
	} catch (error) {
		logger.error(`Can\'t load the page ${url}. Retrying...`);
		await loadPage(page, url);
	}
}

function getCoin() {
	const header = document.querySelector('body div.details-panel div.details-panel-item--header h1.details-panel-item--name > span');
	if (header && header.textContent) {
		const match = header.textContent.match(/\((.*)\)/);
		if (match && match[1]) {
			return match[1];
		}
	}
}

function getTickers() {
	const rows = document.querySelectorAll('#historical-data table tbody tr');
	const coinDateRate: CoinDateRate[] = [];
	let coinRateValue;

	rows.forEach((row) => {
		const coinDate = row.querySelector(':nth-child(1)');
		const coinRate = row.querySelector(':nth-child(4)');

		if (coinDate && coinRate) {
			coinRateValue = coinRate.getAttribute('data-format-value');
			if (coinDate.textContent && coinRateValue) {
				coinDateRate.push({ date: coinDate.textContent, rate: Number(coinRateValue) });
			}
		}
	});

	return coinDateRate;
}

function storeToQueue(source: Callbag) {
	let callbag: Callbag;
	source(0, async (type: number, payload?: any) => {
		if (type === 0) {
			callbag = payload;
		} else if (type === 1) {
			try {
				const ticker: Ticker = {
					uuid: v4(),
					exchange: EXCHANGE_ID,
					datetime: moment.utc(`${payload.date} 23:59:59`, 'YYYYMMDD hh:mm:ss').toISOString(),
					pair: `${payload.coin}/USD`,
					rate: payload.rate
				};
				await sendMessage(ticker);
				logger.info1('storeToQueue: Sucessfully sent to SNS', ticker);
			} catch (error) {
				logger.error('storeToQueue: Error', error);
				callbag(2);
			}
		} else if (type === 2) {
			if (payload) {
				logger.error('storeToQueue: Error acknowledged', payload);
			}
		}
	});
}

function storeToFile(file: string) {
	let stream: fs.WriteStream;
	return (source: Callbag) => {
		let callbag: Callbag;
		source(0, (type: number, payload?: any) => {
			if (type === 0) {
				callbag = payload;
			} else if (type === 1) {
				if (payload) {
					if (!stream) {
						logger.debug('storeToFile: Opening write stream');
						stream = fs.createWriteStream(file);
						stream.on('error', (error) => {
							logger.error('storeToFile: Stream error', error);
						});
						stream.on('open', () => {
							logger.debug('storeToFile: Stream opened');
						});
						stream.on('close', () => {
							logger.debug('storeToFile: Stream closed');
						});
						stream.on('finish', () => {
							logger.debug('storeToFile: Stream finished');
						});
					}
					stream.write(`${payload.coin} ${payload.date} ${payload.rate}\n`);
				} else {
					logger.warning('storeToFile: No payload');
				}
			} else if (type === 2) {
				if (payload) {
					logger.error('storeToFile: Error acknowledged', payload);
				}
				if (stream) {
					logger.debug('storeToFile: Closing write stream');
					stream.end();
				}
			}
		});
	};
}
