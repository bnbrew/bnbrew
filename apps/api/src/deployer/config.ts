export const NETWORKS = {
  'opbnb-testnet': {
    rpc: process.env.OPBNB_TESTNET_RPC || 'https://opbnb-testnet-rpc.bnbchain.org',
    chainId: 5611,
    name: 'opBNB Testnet',
    explorer: 'https://testnet.opbnbscan.com',
  },
  opbnb: {
    rpc: process.env.OPBNB_RPC || 'https://opbnb-mainnet-rpc.bnbchain.org',
    chainId: 204,
    name: 'opBNB Mainnet',
    explorer: 'https://opbnbscan.com',
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

export const DEFAULT_NETWORK: NetworkName = 'opbnb-testnet';

export const GAS_CONFIG = {
  gasLimit: 5_000_000,
  maxFeePerGas: undefined,
  maxPriorityFeePerGas: undefined,
};

export const GREENFIELD_CONFIG = {
  rpc: process.env.GREENFIELD_RPC || 'https://gnfd-testnet-fullnode-tendermint-us.bnbchain.org',
  chainId: process.env.GREENFIELD_CHAIN_ID || '5600',
  spEndpoint: process.env.GREENFIELD_SP_ENDPOINT || '',
};
