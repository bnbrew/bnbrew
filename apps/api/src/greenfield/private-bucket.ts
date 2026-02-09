import * as crypto from 'crypto';
import { ethers } from 'ethers';
import {
  getGreenfieldClient,
  getSpEndpoint,
  getBucketName,
  type UploadResult,
} from './client';

export interface ACLEntry {
  address: string;
  permissions: ('read' | 'write')[];
}

export async function createPrivateBucket(
  appId: string,
  privateKey: string,
): Promise<string> {
  const client = getGreenfieldClient();
  const wallet = new ethers.Wallet(privateKey);
  const bucketName = getBucketName(appId, 'data');
  const spEndpoint = getSpEndpoint();

  console.log(`Creating private bucket: ${bucketName}`);

  const createBucketTx = await client.bucket.createBucket({
    bucketName,
    creator: wallet.address,
    visibility: 'VISIBILITY_TYPE_PRIVATE',
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

  console.log(`  Private bucket created: ${bucketName} (tx: ${txResponse.transactionHash})`);
  return bucketName;
}

export async function setObjectACL(
  appId: string,
  objectName: string,
  acl: ACLEntry[],
  privateKey: string,
): Promise<string> {
  const client = getGreenfieldClient();
  const wallet = new ethers.Wallet(privateKey);
  const bucketName = getBucketName(appId, 'data');

  const statements = acl.map((entry) => {
    const actions: string[] = [];
    if (entry.permissions.includes('read')) {
      actions.push('ACTION_GET_OBJECT');
    }
    if (entry.permissions.includes('write')) {
      actions.push('ACTION_CREATE_OBJECT');
    }
    return {
      effect: 'EFFECT_ALLOW' as const,
      actions,
      resources: [`grn:o::${bucketName}/${objectName}`],
    };
  });

  const putPolicyTx = await client.object.putObjectPolicy(bucketName, objectName, {
    operator: wallet.address,
    statements,
    principal: {
      type: 'PRINCIPAL_TYPE_GNFD_ACCOUNT',
      value: acl[0].address,
    },
  });

  const txResponse = await putPolicyTx.broadcast({
    denom: 'BNB',
    gasLimit: 2000000,
    gasPrice: '5000000000',
    payer: wallet.address,
    granter: '',
  });

  console.log(`  ACL updated for ${objectName} (tx: ${txResponse.transactionHash})`);
  return txResponse.transactionHash;
}

export async function uploadEncryptedData(
  appId: string,
  objectName: string,
  encryptedData: Buffer,
  privateKey: string,
): Promise<UploadResult> {
  const client = getGreenfieldClient();
  const wallet = new ethers.Wallet(privateKey);
  const bucketName = getBucketName(appId, 'data');
  const contentHash = crypto.createHash('sha256').update(encryptedData).digest('hex');

  console.log(`  Uploading encrypted: ${objectName} (${encryptedData.length} bytes)`);

  const createObjectTx = await client.object.createObject({
    bucketName,
    objectName,
    creator: wallet.address,
    visibility: 'VISIBILITY_TYPE_PRIVATE',
    contentType: 'application/octet-stream',
    redundancyType: 'REDUNDANCY_EC_TYPE',
    payloadSize: BigInt(encryptedData.length),
  });

  const txResponse = await createObjectTx.broadcast({
    denom: 'BNB',
    gasLimit: 2000000,
    gasPrice: '5000000000',
    payer: wallet.address,
    granter: '',
  });

  await client.object.uploadObject(
    {
      bucketName,
      objectName,
      body: encryptedData,
      txnHash: txResponse.transactionHash,
    },
    { type: 'ECDSA', privateKey },
  );

  return {
    objectName,
    txHash: txResponse.transactionHash,
    contentHash,
  };
}

export async function downloadEncryptedData(
  appId: string,
  objectName: string,
  privateKey: string,
): Promise<Buffer> {
  const client = getGreenfieldClient();
  const bucketName = getBucketName(appId, 'data');

  const response = await client.object.getObject(
    {
      bucketName,
      objectName,
    },
    { type: 'ECDSA', privateKey },
  );

  const chunks: Buffer[] = [];
  const reader = (response.body as ReadableStream).getReader();

  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      chunks.push(Buffer.from(result.value));
    }
  }

  return Buffer.concat(chunks);
}

export async function grantBucketAccess(
  appId: string,
  granteeAddress: string,
  permissions: ('read' | 'write')[],
  privateKey: string,
): Promise<string> {
  const client = getGreenfieldClient();
  const wallet = new ethers.Wallet(privateKey);
  const bucketName = getBucketName(appId, 'data');

  const actions: string[] = [];
  if (permissions.includes('read')) {
    actions.push('ACTION_GET_OBJECT');
    actions.push('ACTION_LIST_OBJECT');
  }
  if (permissions.includes('write')) {
    actions.push('ACTION_CREATE_OBJECT');
  }

  const putPolicyTx = await client.bucket.putBucketPolicy(bucketName, {
    operator: wallet.address,
    statements: [
      {
        effect: 'EFFECT_ALLOW' as const,
        actions,
        resources: [`grn:o::${bucketName}/*`],
      },
    ],
    principal: {
      type: 'PRINCIPAL_TYPE_GNFD_ACCOUNT',
      value: granteeAddress,
    },
  });

  const txResponse = await putPolicyTx.broadcast({
    denom: 'BNB',
    gasLimit: 2000000,
    gasPrice: '5000000000',
    payer: wallet.address,
    granter: '',
  });

  console.log(`  Bucket access granted to ${granteeAddress} (tx: ${txResponse.transactionHash})`);
  return txResponse.transactionHash;
}
