import crypto from 'crypto';

import IPFS from 'ipfs-api';
import multihashes from 'multihashes';
import CID from 'cids';
import ipldDagCbor from 'ipld-dag-cbor';

import { Option } from '../interfaces';
import { MyError } from '../errors';

import logger from '../logger';

export const description = 'IPFS test client';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'IPFS node hostname', defaultValue: 'ipfs.infura.io' },
	{ option: '-P, --port <port>', description: 'IPFS node port', defaultValue: '5001' },
];

export default async function main(options: { [key: string]: string }) {
	const reviews = {
		_id: 'review1',
		score: 7,
		createdAt: new Date(),
		updatedAt: new Date(),
		publishedAt: new Date(),
		author: {
			image: 'https://s.gravatar.com/avatar/81a6c3e435fb2ecd53f4946366232ea3?s=80',
			name: 'Mila Kuchta'
		}
	};

	const cid1 = await calculateCID(reviews);
	logger.info(`cid1: ${cid1}`);

	const ipfs = IPFS({ protocol: 'https', host: options.host, port: Number(options.port) });
	const cid2 = await ipfs.dag.put(reviews, { format: 'dag-cbor', hashAlg: 'sha2-256' });
	logger.info(`cid2: ${cid2}`);

	const pinned = await ipfs.pin.add(`/ipfs/${cid2}`);
	logger.info('object pinned', pinned);
}

async function calculateCID(object: any) {
	return new Promise((resolve, reject) => {
		ipldDagCbor.util.serialize(object, (error: Error, buffer: Buffer) => {
			if (error) {
				reject(error);
			}

			const hash = crypto.createHash('sha256').update(buffer).digest();
			const encoded = multihashes.encode(hash, 'sha2-256');
			const cid = new CID(1, 'dag-cbor', encoded);
			resolve(cid);
		});
	});
}
