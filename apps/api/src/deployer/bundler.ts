import { ethers } from 'ethers';
import { PLATFORM_ADDRESSES } from './networks';
import { type NetworkName } from './config';

export interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export interface BundlerConfig {
  url: string;
  entryPoint: string;
  chainId: number;
}

const BUNDLER_URLS: Record<NetworkName, string> = {
  'opbnb-testnet': process.env.BUNDLER_URL || 'https://api.pimlico.io/v2/5611/rpc',
  opbnb: process.env.BUNDLER_URL || 'https://api.pimlico.io/v2/204/rpc',
};

export function getBundlerConfig(network: NetworkName): BundlerConfig {
  const addresses = PLATFORM_ADDRESSES[network];
  return {
    url: BUNDLER_URLS[network],
    entryPoint: addresses.entryPoint || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    chainId: network === 'opbnb-testnet' ? 5611 : 204,
  };
}

export async function sendUserOperation(
  userOp: UserOperation,
  network: NetworkName,
): Promise<string> {
  const config = getBundlerConfig(network);

  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendUserOperation',
      params: [userOp, config.entryPoint],
    }),
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(`Bundler error: ${result.error.message}`);
  }

  return result.result as string; // userOpHash
}

export async function getUserOperationReceipt(
  userOpHash: string,
  network: NetworkName,
): Promise<unknown> {
  const config = getBundlerConfig(network);

  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getUserOperationReceipt',
      params: [userOpHash],
    }),
  });

  const result = await response.json();
  return result.result;
}

export function buildPaymasterData(
  paymasterAddress: string,
  appId: string,
  userAddress: string,
): string {
  const appIdBytes = ethers.zeroPadValue(ethers.toUtf8Bytes(appId), 32);
  const userBytes = ethers.zeroPadValue(userAddress, 20);
  return ethers.concat([paymasterAddress, appIdBytes, userBytes]);
}

export async function estimateUserOperationGas(
  userOp: Partial<UserOperation>,
  network: NetworkName,
): Promise<{
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
}> {
  const config = getBundlerConfig(network);

  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_estimateUserOperationGas',
      params: [userOp, config.entryPoint],
    }),
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(`Gas estimation error: ${result.error.message}`);
  }

  return result.result;
}
