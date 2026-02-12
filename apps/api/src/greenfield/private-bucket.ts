import * as crypto from 'crypto';
import { ethers } from 'ethers';
import { VisibilityType, RedundancyType } from '@bnb-chain/greenfield-cosmos-types/greenfield/storage/common';
import { Effect, ActionType, PrincipalType } from '@bnb-chain/greenfield-cosmos-types/greenfield/permission/common';
import { ReedSolomon } from '@bnb-chain/reed-solomon';
import Long from 'long';
import {
  getGreenfieldClient,
  getPrimarySp,
  getBucketName,
} from './client';
import type { UploadResult } from './client';

function bytesFromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

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
  const sp = await getPrimarySp();

  console.log(`Creating private bucket: ${bucketName}`);

  try {
    const createBucketTx = await client.bucket.createBucket({
      bucketName,
      creator: wallet.address,
      visibility: VisibilityType.VISIBILITY_TYPE_PRIVATE,
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

    console.log(`  Private bucket created: ${bucketName} (tx: ${txResponse.transactionHash})`);
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log(`  Private bucket already exists: ${bucketName}`);
    } else {
      throw err;
    }
  }

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
    const actions: ActionType[] = [];
    if (entry.permissions.includes('read')) {
      actions.push(ActionType.ACTION_GET_OBJECT);
    }
    if (entry.permissions.includes('write')) {
      actions.push(ActionType.ACTION_CREATE_OBJECT);
    }
    return {
      effect: Effect.EFFECT_ALLOW,
      actions,
      resources: [`grn:o::${bucketName}/${objectName}`],
    };
  });

  const putPolicyTx = await client.object.putObjectPolicy(bucketName, objectName, {
    operator: wallet.address,
    statements,
    principal: {
      type: PrincipalType.PRINCIPAL_TYPE_GNFD_ACCOUNT,
      value: acl[0].address,
    },
  });

  const aclSimInfo = await putPolicyTx.simulate({ denom: 'BNB' });

  const txResponse = await putPolicyTx.broadcast({
    denom: 'BNB',
    gasLimit: Number(aclSimInfo?.gasLimit),
    gasPrice: aclSimInfo?.gasPrice || '5000000000',
    payer: wallet.address,
    granter: '',
    privateKey: `0x${privateKey.replace(/^0x/, '')}`,
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

  const hexKey = `0x${privateKey.replace(/^0x/, '')}`;
  const rs = new ReedSolomon();
  console.log(`  Uploading encrypted: ${objectName} (${encryptedData.length} bytes)`);

  const expectCheckSums = rs.encode(new Uint8Array(encryptedData));

  const createObjectTx = await client.object.createObject({
    bucketName,
    objectName,
    creator: wallet.address,
    visibility: VisibilityType.VISIBILITY_TYPE_PRIVATE,
    contentType: 'application/octet-stream',
    redundancyType: RedundancyType.REDUNDANCY_EC_TYPE,
    payloadSize: Long.fromNumber(encryptedData.length),
    expectChecksums: expectCheckSums.map((hash: string) => bytesFromBase64(hash)),
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

  const file = new File([new Uint8Array(encryptedData)], objectName, { type: 'application/octet-stream' });

  await client.object.uploadObject(
    {
      bucketName,
      objectName,
      body: file,
      txnHash: txResponse.transactionHash,
    },
    { type: 'ECDSA', privateKey: hexKey },
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
  const reader = (response.body as unknown as ReadableStream).getReader();

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

  const actions: ActionType[] = [];
  if (permissions.includes('read')) {
    actions.push(ActionType.ACTION_GET_OBJECT);
    actions.push(ActionType.ACTION_LIST_OBJECT);
  }
  if (permissions.includes('write')) {
    actions.push(ActionType.ACTION_CREATE_OBJECT);
  }

  const putPolicyTx = await client.bucket.putBucketPolicy(bucketName, {
    operator: wallet.address,
    statements: [
      {
        effect: Effect.EFFECT_ALLOW,
        actions,
        resources: [`grn:o::${bucketName}/*`],
      },
    ],
    principal: {
      type: PrincipalType.PRINCIPAL_TYPE_GNFD_ACCOUNT,
      value: granteeAddress,
    },
  });

  const policySimInfo = await putPolicyTx.simulate({ denom: 'BNB' });

  const txResponse = await putPolicyTx.broadcast({
    denom: 'BNB',
    gasLimit: Number(policySimInfo?.gasLimit),
    gasPrice: policySimInfo?.gasPrice || '5000000000',
    payer: wallet.address,
    granter: '',
    privateKey: `0x${privateKey.replace(/^0x/, '')}`,
  });

  console.log(`  Bucket access granted to ${granteeAddress} (tx: ${txResponse.transactionHash})`);
  return txResponse.transactionHash;
}
