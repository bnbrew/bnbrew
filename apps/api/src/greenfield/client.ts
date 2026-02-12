import { Client } from '@bnb-chain/greenfield-js-sdk';
import { GREENFIELD_CONFIG } from '../deployer/config';

let clientInstance: Client | null = null;

export function getGreenfieldClient(): Client {
  if (!clientInstance) {
    clientInstance = Client.create(
      GREENFIELD_CONFIG.rpc,
      String(GREENFIELD_CONFIG.chainId),
    );
  }
  return clientInstance;
}

export interface BucketConfig {
  name: string;
  visibility: 'public' | 'private';
  paymentAddress: string;
  primarySpAddress: string;
}

export interface UploadResult {
  objectName: string;
  txHash: string;
  contentHash: string;
}

export interface SpInfo {
  operatorAddress: string;
  endpoint: string;
}

let cachedSp: SpInfo | null = null;

export async function getPrimarySp(): Promise<SpInfo> {
  if (cachedSp) return cachedSp;

  const client = getGreenfieldClient();
  const spList = await client.sp.getStorageProviders();
  const activeSps = spList.filter(
    (sp: any) => sp.endpoint && sp.operatorAddress,
  );

  if (activeSps.length === 0) {
    throw new Error('No active storage providers found on Greenfield');
  }

  // Use configured endpoint if it matches an SP, otherwise pick first
  const configured = GREENFIELD_CONFIG.spEndpoint;
  const match = configured
    ? activeSps.find((sp: any) => sp.endpoint.includes(configured) || configured.includes(sp.endpoint))
    : null;

  const sp = match || activeSps[0];
  cachedSp = {
    operatorAddress: sp.operatorAddress,
    endpoint: sp.endpoint.replace(/\/$/, ''),
  };

  console.log(`Using SP: ${cachedSp.endpoint} (${cachedSp.operatorAddress})`);
  return cachedSp;
}

export function getBucketName(appId: string, type: 'public' | 'data'): string {
  const sanitized = appId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${sanitized}-${type}`;
}
