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

export function getSpEndpoint(): string {
  const endpoint = GREENFIELD_CONFIG.spEndpoint;
  if (!endpoint) {
    throw new Error('GREENFIELD_SP_ENDPOINT not configured');
  }
  return endpoint;
}

export function getBucketName(appId: string, type: 'public' | 'data'): string {
  // Greenfield bucket names: lowercase, 3-63 chars, no consecutive hyphens
  const sanitized = appId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${sanitized}-${type}`;
}
