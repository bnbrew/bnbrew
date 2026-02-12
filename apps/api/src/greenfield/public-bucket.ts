import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ethers } from 'ethers';
import { VisibilityType, RedundancyType } from '@bnb-chain/greenfield-cosmos-types/greenfield/storage/common';
import { ReedSolomon } from '@bnb-chain/reed-solomon';
import Long from 'long';
import {
  getGreenfieldClient,
  getPrimarySp,
  getBucketName,
  type UploadResult,
} from './client';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function bytesFromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

export async function createPublicBucket(
  appId: string,
  privateKey: string,
): Promise<string> {
  const client = getGreenfieldClient();
  const wallet = new ethers.Wallet(privateKey);
  const bucketName = getBucketName(appId, 'public');
  const sp = await getPrimarySp();

  console.log(`Creating public bucket: ${bucketName}`);

  try {
    const createBucketTx = await client.bucket.createBucket({
      bucketName,
      creator: wallet.address,
      visibility: VisibilityType.VISIBILITY_TYPE_PUBLIC_READ,
      chargedReadQuota: Long.fromNumber(0),
      primarySpAddress: sp.operatorAddress,
      paymentAddress: wallet.address,
    });

    const simulateInfo = await createBucketTx.simulate({ denom: 'BNB' });

    const txResponse = await createBucketTx.broadcast({
      denom: 'BNB',
      gasLimit: Number(simulateInfo?.gasLimit),
      gasPrice: simulateInfo?.gasPrice || '5000000000',
      payer: wallet.address,
      granter: '',
      privateKey: `0x${privateKey.replace(/^0x/, '')}`,
    });

    console.log(`  Bucket created: ${bucketName} (tx: ${txResponse.transactionHash})`);
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log(`  Bucket already exists: ${bucketName}`);
    } else {
      throw err;
    }
  }

  return bucketName;
}

export async function uploadDistToBucket(
  appId: string,
  distDir: string,
  privateKey: string,
): Promise<UploadResult[]> {
  const client = getGreenfieldClient();
  const wallet = new ethers.Wallet(privateKey);
  const bucketName = getBucketName(appId, 'public');
  const results: UploadResult[] = [];

  // Recursively list all files in dist
  const files = await listFilesRecursive(distDir);

  console.log(`Uploading ${files.length} files to ${bucketName}...`);

  const hexKey = `0x${privateKey.replace(/^0x/, '')}`;
  const rs = new ReedSolomon();

  for (const filePath of files) {
    const relativePath = path.relative(distDir, filePath);
    const objectName = relativePath.replace(/\\/g, '/');
    const content = await fs.readFile(filePath);
    const contentType = getContentType(filePath);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    console.log(`  Uploading: ${objectName} (${contentType}, ${content.length} bytes)`);

    // Compute 7 EC checksums via Reed-Solomon (required by Greenfield)
    const expectCheckSums = rs.encode(new Uint8Array(content));

    const createObjectTx = await client.object.createObject({
      bucketName,
      objectName,
      creator: wallet.address,
      visibility: VisibilityType.VISIBILITY_TYPE_INHERIT,
      contentType,
      redundancyType: RedundancyType.REDUNDANCY_EC_TYPE,
      payloadSize: Long.fromNumber(content.length),
      expectChecksums: expectCheckSums.map((hash: string) =>
        bytesFromBase64(hash),
      ),
    });

    const simInfo = await createObjectTx.simulate({ denom: 'BNB' });

    const txResponse = await createObjectTx.broadcast({
      denom: 'BNB',
      gasLimit: Number(simInfo?.gasLimit),
      gasPrice: simInfo?.gasPrice || '5000000000',
      payer: wallet.address,
      granter: '',
      privateKey: hexKey,
    });

    console.log(`    Object created on-chain (tx: ${txResponse.transactionHash})`);

    // Upload content to SP
    await client.object.uploadObject(
      {
        bucketName,
        objectName,
        body: {
          name: objectName,
          type: contentType,
          size: content.length,
          content,
        } as any,
        txnHash: txResponse.transactionHash,
      },
      { type: 'ECDSA', privateKey: hexKey },
    );

    console.log(`    Uploaded to SP`);

    results.push({
      objectName,
      txHash: txResponse.transactionHash,
      contentHash,
    });
  }

  console.log(`Upload complete: ${results.length} files`);
  return results;
}

export async function getPublicUrl(appId: string, objectName?: string): Promise<string> {
  const bucketName = getBucketName(appId, 'public');
  const sp = await getPrimarySp();
  if (objectName) {
    return `${sp.endpoint}/view/${bucketName}/${objectName}`;
  }
  return `${sp.endpoint}/view/${bucketName}/index.html`;
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

export async function verifyUpload(
  appId: string,
  uploads: UploadResult[],
  distDir: string,
): Promise<boolean> {
  let allValid = true;

  for (const upload of uploads) {
    const localPath = path.join(distDir, upload.objectName);
    const localContent = await fs.readFile(localPath);
    const localHash = crypto.createHash('sha256').update(localContent).digest('hex');

    if (localHash !== upload.contentHash) {
      console.error(`Hash mismatch for ${upload.objectName}`);
      allValid = false;
    }
  }

  return allValid;
}
