import R from 'ramda';

import { MyError } from './errors';
import { Address, AddressMap } from '../interfaces';
import { putItem, scan } from './dynamo';
import { getLatestBlockNumber, isAddress } from './ethereum';

export class Addresses {
	private addresses: AddressMap;
	private _lastBlock: number;

	async init() {
		this.addresses = await scan('address') as AddressMap;
		if ('lastBlock' in this.addresses && this.addresses.lastBlock.value) {
			this._lastBlock = this.addresses.lastBlock.value;
			delete this.addresses.lastBlock;
		} else {
			let lastBlock = await getLatestBlockNumber();
			R.forEachObjIndexed<AddressMap>((address) => {
				address.firstBlock = lastBlock;
				address.complete = false;
				putItem(address);
			}, this.addresses);
			this._lastBlock = lastBlock;
		}
	}

	*[Symbol.iterator]() {
		for (let address of Object.keys(this.addresses)) {
			yield this.addresses[address];
		}
	}

	get(address: string) {
		return this.addresses[address];
	}

	set(address: Address) {
		this.addresses[address.address] = address;
		putItem(address);
	}

	enable(address: string) {
		if (!isAddress(address)) {
			throw new MyError(`Address ${address} is not valid Ethereum address. Skipping...`);
		}

		let addressObj: Address = this.addresses[address];
		if (addressObj) {
			if (addressObj.enabled) {
				throw new MyError('Requested to enable address already enabled. Skipping...');
			} else {
				addressObj.enabled = true;
			}
		} else {
			addressObj = {
				address,
				enabled: true,
				firstBlock: this._lastBlock,
				complete: false
			};
			this.addresses[address] = addressObj;
		}
		putItem(addressObj);
	}

	disable(address: string) {
		let addressObj = this.addresses[address];
		if (!(addressObj && addressObj.enabled)) {
			throw new MyError('Requested to disable address not enabled. Skipping...');
		}
		addressObj.enabled = false;
		addressObj.lastBlock = this._lastBlock;
		putItem(addressObj);
	}

	get lastBlock() {
		return this._lastBlock;
	}

	set lastBlock(blockNumber: number) {
		// logger.debug(`Updating last block #${blockNumber}`);
		this._lastBlock = blockNumber;
		putItem({ address: 'lastBlock', value: this._lastBlock });
	}

	getAll() {
		return this.addresses;
	}

	getUncompleted() {
		return Object.values(R.filter(address => !address.complete, this.addresses));
	}
}
