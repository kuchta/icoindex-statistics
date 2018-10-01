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
	{ option: '-H, --host <host>', description: 'IPFS node hostname', defaultValue: 'ipfs.infura.io' },
	{ option: '-P, --port <port>', description: 'IPFS node port', defaultValue: '5001' },
];

const FORMAT = 'dag-cbor';
const HASH = 'sha2-256';
const CRYPTO_HASH = 'sha256';

export default async function main(options: { [key: string]: string }) {
	const ipfs = IPFS({ protocol: 'https', host: options.host, port: Number(options.port) });

	const author = {
		image: 'https://s.gravatar.com/avatar/81a6c3e435fb2ecd53f4946366232ea3?s=80',
		name: 'Mila Kuchta'
	};

	const authorCID = await calculateCID(author);
	// logger.info(`authorCID: ${authorCID}`);

	const reviewSection = {
		title: 'Title',
		description: 'Description',
		score: 6
	};

	const reviewSectionCID = await calculateCID(reviewSection);
	// logger.info(`reviewSectionCID: ${reviewSectionCID}`);

	const review1 = {
		id: 'review1',
		description: 'Review 1',
		score: 7,
		createdAt: new Date(),
		updatedAt: new Date(),
		author: { '/': authorCID.toBaseEncodedString() },
		general: { '/': reviewSectionCID.toBaseEncodedString() }
	};

	const review1CID = await calculateCID(review1);
	// logger.info(`review1CID: ${review1CID}`);

	const review2 = {
		_id: 'review2',
		description: 'Review 2',
		score: 7,
		createdAt: new Date(),
		updatedAt: new Date(),
		author: { '/': authorCID.toBaseEncodedString() },
		general: { '/': reviewSectionCID.toBaseEncodedString() }
	};

	const review2CID = await calculateCID(review2);
	// logger.info(`review2CID: ${review2CID}`);

	const reviews = {
		date: new Date().toDateString(),
		reviews: [
			{ '/': review1CID.toBaseEncodedString() },
			{ '/': review2CID.toBaseEncodedString() }
		]
	};

	// Take this CID and save it to blockchain

	const reviewsCID = await calculateCID(reviews);
	logger.info(`reviewsCID: ${reviewsCID}`);

	// Later when you are ready to store reviews into IPFS

	const authorCID2 = await ipfs.dag.put(author, { format: FORMAT, hashAlg: HASH });
	// logger.info(`author saved as ${authorCID2}`);

	const reviewSectionCID2 = await ipfs.dag.put(reviewSection, { format: FORMAT, hashAlg: HASH });
	// logger.info(`reviewSection saved as ${reviewSectionCID2}`);

	const review1CID2 = await ipfs.dag.put(review1, { format: FORMAT, hashAlg: HASH });
	// logger.info(`review1 saved as ${review1CID2}`);

	const review2CID2 = await ipfs.dag.put(review2, { format: FORMAT, hashAlg: HASH });
	// logger.info(`review2 saved as ${review2CID2}`);

	const reviewsCID2 = await ipfs.dag.put(reviews, { format: FORMAT, hashAlg: HASH });
	logger.info(`reviews saved as ${reviewsCID2}`);

	logger.info(`reviewsCIDs ${reviewsCID.equals(reviewsCID2) ? 'are' : 'are NOT'} equal`);

	// Objects will be garbage collected if nobody is using them after cca 14 days
	// Pin them to make sure they won't disapear

	// const pinned = await ipfs.pin.add(reviewsCID2);
	// logger.info('Reviews CID pinned', pinned);
}

async function calculateCID(object: any, format = FORMAT, hashAlg = HASH, cryptoHash = CRYPTO_HASH): Promise<any> {
	return new Promise((resolve, reject) => {
		dagCBOR.util.serialize(object, (error: Error, buffer: Buffer) => {
			if (error) {
				reject(error);
			}

			const hash = crypto.createHash(cryptoHash).update(buffer).digest();
			const encoded = multihashes.encode(hash, hashAlg);
			const cid = new CID(1, format, encoded);
			resolve(cid);
		});
	});
}
