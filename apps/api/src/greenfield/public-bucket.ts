import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ethers } from 'ethers';
import {
  getGreenfieldClient,
  getSpEndpoint,
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
  const spEndpoint = getSpEndpoint();

  console.log(`Creating public bucket: ${bucketName}`);

  const createBucketTx = await client.bucket.createBucket({
    bucketName,
    creator: wallet.address,
    visibility: 'VISIBILITY_TYPE_PUBLIC_READ',
    chargedReadQuota: '0',
    primarySpAddress: spEndpoint,
    paymentAddress: wallet.address,
  });

  const txResponse = await createBucketTx.broadcast({
    denom: 'BNB',
    gasLimit: 2000000,
    gasPrice: '5000000000',
    payer: wallet.address,
    granter: '',
  });

  console.log(`  Bucket created: ${bucketName} (tx: ${txResponse.transactionHash})`);
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

  for (const filePath of files) {
    const relativePath = path.relative(distDir, filePath);
    const objectName = relativePath.replace(/\\/g, '/');
    const content = await fs.readFile(filePath);
    const contentType = getContentType(filePath);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    console.log(`  Uploading: ${objectName} (${contentType}, ${content.length} bytes)`);

    const createObjectTx = await client.object.createObject({
      bucketName,
      objectName,
      creator: wallet.address,
      visibility: 'VISIBILITY_TYPE_INHERIT',
      contentType,
      redundancyType: 'REDUNDANCY_EC_TYPE',
      payloadSize: BigInt(content.length),
    });

    const txResponse = await createObjectTx.broadcast({
      denom: 'BNB',
      gasLimit: 2000000,
      gasPrice: '5000000000',
      payer: wallet.address,
      granter: '',
    });

    // Upload content to SP
    await client.object.uploadObject(
      {
        bucketName,
        objectName,
        body: content,
        txnHash: txResponse.transactionHash,
      },
      { type: 'ECDSA', privateKey },
    );

    results.push({
      objectName,
      txHash: txResponse.transactionHash,
      contentHash,
    });
  }

  console.log(`Upload complete: ${results.length} files`);
  return results;
}

export function getPublicUrl(appId: string, objectName?: string): string {
  const bucketName = getBucketName(appId, 'public');
  const spEndpoint = getSpEndpoint();
  if (objectName) {
    return `${spEndpoint}/view/${bucketName}/${objectName}`;
  }
  return `${spEndpoint}/view/${bucketName}/index.html`;
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
