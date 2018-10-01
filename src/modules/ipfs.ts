/* IPFS APIs:
 * https://github.com/ipfs/interface-ipfs-core
 *
 * There are two JavaScript IPFS implementations:
 *
 * Full IPFS:
 * This implementation runs full IPFS node inside Node/Browser
 * https://github.com/ipfs/js-ipfs
 *
 * Remote IPFS-API:
 * This implementation which we use here and is the recommended way to use IPFS
 * https://github.com/ipfs/js-ipfs-api
 *
 * IPFS Pinning Services:
 *	https://infura.io
 *	https://pinbits.io
 *	https://www.eternum.io
 *
 * IPFS Web Gateways:
 * https://ipfs.io
 * https://cloudflare-ipfs.com
 *
 * IPLD object explorer:
 * http://explore.ipld.io
 */

import crypto from 'crypto';

import IPFS from 'ipfs-api';
import multihashes from 'multihashes';
import CID from 'cids';
import dagCBOR from 'ipld-dag-cbor';
import dagPB from 'ipld-dag-pb';

import { Option } from '../interfaces';
import { MyError } from '../errors';

import logger from '../logger';

export const description = 'IPFS test client';
export const options: Option[] = [
	{ option: '-H, --host <host>', description: 'IPFS node hostname', defaultValue: 'localhost' },
	{ option: '-P, --port <port>', description: 'IPFS node port', defaultValue: '5001' },
];

export default async function main(options: { [key: string]: string }) {
	const ipfs = IPFS({ protocol: 'http', host: options.host, port: Number(options.port) });

	const author = {
		image: 'https://s.gravatar.com/avatar/81a6c3e435fb2ecd53f4946366232ea3?s=80',
		name: 'Mila Kuchta'
	};

	const authorCID = await ipfs.dag.put(author, { format: 'dag-cbor', hashAlg: 'sha2-256' });

	logger.info(`authorCID: ${authorCID}`);

	const reviewSection = {
		title: 'Title',
		description: 'Description',
		score: 6
	};

	const reviewSectionCID = await ipfs.dag.put(reviewSection, { format: 'dag-cbor', hashAlg: 'sha2-256' });

	logger.info(`reviewSectionCID: ${reviewSectionCID}`);

	const review1 = {
		id: 'review1',
		description: 'Review 1',
		score: 7,
		createdAt: new Date(),
		updatedAt: new Date(),
		author: authorCID,
		general: reviewSectionCID
	};

	const review1CID = await ipfs.dag.put(review1, { format: 'dag-cbor', hashAlg: 'sha2-256' });

	logger.info(`review1CID: ${review1CID}`);

	const review2 = {
		_id: 'review2',
		description: 'Review 2',
		score: 7,
		createdAt: new Date(),
		updatedAt: new Date(),
		author: authorCID,
		general: reviewSectionCID
	};

	const review2CID = await ipfs.dag.put(review2, { format: 'dag-cbor', hashAlg: 'sha2-256' });

	logger.info(`review2CID: ${review2CID}`);

	const reviews = {
		date: new Date().toDateString(),
		reviews: [
			review1CID,
			review2CID
		]
	};

	// Calculate object CID without storing in IPFS
	const reviewsCID1 = await calculateCID(reviews);

	logger.info(`reviewsCID1: ${reviewsCID1}`);

	const reviewsCID2 = await ipfs.dag.put(reviews, { format: 'dag-cbor', hashAlg: 'sha2-256' });

	logger.info(`reviewsCID2: ${reviewsCID2}`);

	logger.info(`Reviews CIDs ${reviewsCID1.equals(reviewsCID2) ? 'are' : 'are NOT'} same`);

	// Pin object in IPFS

	const pinned = await ipfs.pin.add(reviewsCID2);
	logger.info('Reviews CID pinned', pinned);

	// const buffer = await dagPB.DAGNode.create(Buffer.from('I am inside a Protobuf'));

	// DAGNode.create('some data', (err, node2) => {
	// 	// node2 will have the same data as node1.
	// });

	// const cid0 = dagPB.util.cid(buffer);
	// logger.info(`cid0: ${cid0}`);
}

async function calculateCID(object: any): Promise<any> {
	return new Promise((resolve, reject) => {
		dagCBOR.util.serialize(object, (error: Error, buffer: Buffer) => {
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
