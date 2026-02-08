import { ethers } from 'ethers';
import { getWallet } from './networks';
import { GAS_CONFIG, type NetworkName, DEFAULT_NETWORK } from './config';
import type { CompiledContract } from '../compiler';

export interface DeploymentResult {
  contractName: string;
  implementationAddress: string;
  proxyAddress: string;
  abi: unknown[];
  txHash: string;
}

const ERC1967_PROXY_ABI = [
  'constructor(address implementation, bytes _data)',
];

const ERC1967_PROXY_BYTECODE =
  '0x60806040526040516104ec3803806104ec833981016040819052610022916102de565b61002e82826000610035565b5050610406565b61003e83610061565b60008251118061004b5750805b1561005c5761005a83836100a1565b505b505050565b61006a816100cd565b6040516001600160a01b038216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b60606100c6838360405180606001604052806027815260200161049c602791396100f0565b9392505050565b6100d681610168565b6100f35760405163b490513360e01b815260040160405180910390fd5b50565b6060600080856001600160a01b0316856040516101139190610384565b600060405180830381855af49150503d806000811461014e576040519150601f19603f3d011682016040523d82523d6000602084013e610153565b606091505b509150915061016286838387610177565b93505050505b92915050565b6001600160a01b03163b151590565b606083156101e65782516000036101df576001600160a01b0385163b6101df5760405162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e747261637400000060448201526064015b60405180910390fd5b50816101f0565b6101f083836101f8565b949350505050565b8151156102085781518083602001fd5b8060405162461bcd60e51b81526004016101d691906103a0565b634e487b7160e01b600052604160045260246000fd5b60005b8381101561025357818101518382015260200161023b565b50506000910152565b600080516020610a3c8339815191527f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

export async function deployContractWithProxy(
  compiled: CompiledContract,
  initArgs: unknown[],
  privateKey: string,
  network: NetworkName = DEFAULT_NETWORK,
): Promise<DeploymentResult> {
  const wallet = getWallet(privateKey, network);

  console.log(`Deploying ${compiled.name} to ${network}...`);

  // 1. Deploy implementation
  const implFactory = new ethers.ContractFactory(
    compiled.abi,
    compiled.bytecode,
    wallet,
  );
  const implementation = await implFactory.deploy({
    gasLimit: GAS_CONFIG.gasLimit,
  });
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log(`  Implementation: ${implAddress}`);

  // 2. Encode initialize call
  const iface = new ethers.Interface(compiled.abi as ethers.InterfaceAbi);
  const initData = iface.encodeFunctionData('initialize', initArgs);

  // 3. Deploy ERC1967Proxy
  const proxyFactory = new ethers.ContractFactory(
    ERC1967_PROXY_ABI,
    ERC1967_PROXY_BYTECODE,
    wallet,
  );
  const proxy = await proxyFactory.deploy(implAddress, initData, {
    gasLimit: GAS_CONFIG.gasLimit,
  });
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log(`  Proxy: ${proxyAddress}`);

  const receipt = await proxy.deploymentTransaction()?.wait();

  return {
    contractName: compiled.name,
    implementationAddress: implAddress,
    proxyAddress,
    abi: compiled.abi,
    txHash: receipt?.hash || '',
  };
}

export async function deployContractDirect(
  compiled: CompiledContract,
  constructorArgs: unknown[],
  privateKey: string,
  network: NetworkName = DEFAULT_NETWORK,
): Promise<DeploymentResult> {
  const wallet = getWallet(privateKey, network);

  console.log(`Deploying ${compiled.name} (direct) to ${network}...`);

  const factory = new ethers.ContractFactory(
    compiled.abi,
    compiled.bytecode,
    wallet,
  );
  const contract = await factory.deploy(...constructorArgs, {
    gasLimit: GAS_CONFIG.gasLimit,
  });
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const receipt = await contract.deploymentTransaction()?.wait();

  console.log(`  Deployed: ${address}`);

  return {
    contractName: compiled.name,
    implementationAddress: address,
    proxyAddress: address,
    abi: compiled.abi,
    txHash: receipt?.hash || '',
  };
}

export async function deployAppContracts(
  compiledContracts: CompiledContract[],
  ownerAddress: string,
  privateKey: string,
  network: NetworkName = DEFAULT_NETWORK,
): Promise<DeploymentResult[]> {
  const results: DeploymentResult[] = [];

  for (const compiled of compiledContracts) {
    // Skip base contract — it's abstract
    if (compiled.name === 'BNBrewBase') continue;

    const result = await deployContractWithProxy(
      compiled,
      [ownerAddress],
      privateKey,
      network,
    );
    results.push(result);
  }

  return results;
}
