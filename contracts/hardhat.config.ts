import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    opbnbTestnet: {
      url: process.env.OPBNB_TESTNET_RPC || 'https://opbnb-testnet-rpc.bnbchain.org',
      chainId: 5611,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    opbnb: {
      url: process.env.OPBNB_RPC || 'https://opbnb-mainnet-rpc.bnbchain.org',
      chainId: 204,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
