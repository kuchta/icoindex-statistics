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
				address.lastBlock = 0;
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
				addressObj.enabledTime = new Date().toISOString();
			}
		} else {
			addressObj = {
				address,
				enabled: true,
				enabledTime: new Date().toISOString(),
				lastBlock: -1
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

	getCompletedEnabled() {
		return R.filter(address => address.enabled && address.lastBlock === undefined, this.addresses);
	}

	getUncompletedEnabled() {
		return R.filter(address => address.enabled && address.lastBlock !== undefined, this.addresses);
	}
}
