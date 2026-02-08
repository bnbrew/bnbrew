import { ethers } from 'ethers';
import { NETWORKS, type NetworkName } from './config';

export function getProvider(network: NetworkName): ethers.JsonRpcProvider {
  const config = NETWORKS[network];
  return new ethers.JsonRpcProvider(config.rpc, {
    name: config.name,
    chainId: config.chainId,
  });
}

export function getWallet(
  privateKey: string,
  network: NetworkName,
): ethers.Wallet {
  const provider = getProvider(network);
  return new ethers.Wallet(privateKey, provider);
}

export async function getNetworkInfo(network: NetworkName) {
  const provider = getProvider(network);
  const block = await provider.getBlockNumber();
  const feeData = await provider.getFeeData();

  return {
    ...NETWORKS[network],
    currentBlock: block,
    gasPrice: feeData.gasPrice?.toString(),
    maxFeePerGas: feeData.maxFeePerGas?.toString(),
  };
}

export async function checkBalance(
  address: string,
  network: NetworkName,
): Promise<string> {
  const provider = getProvider(network);
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

// Known contract addresses (populated after platform deployment)
export const PLATFORM_ADDRESSES: Record<
  NetworkName,
  {
    registry?: string;
    dataRouter?: string;
    appFactory?: string;
    paymaster?: string;
    entryPoint?: string;
  }
> = {
  'opbnb-testnet': {
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // ERC-4337 EntryPoint v0.6
  },
  opbnb: {
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  },
};
