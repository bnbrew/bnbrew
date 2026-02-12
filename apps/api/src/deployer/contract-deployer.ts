import { ethers } from 'ethers';
import { getWallet } from './networks';
import { GAS_CONFIG, type NetworkName, DEFAULT_NETWORK } from './config';
import type { CompiledContract } from '../compiler';
import { compileSolidity } from '../compiler/solc';

export interface DeploymentResult {
  contractName: string;
  implementationAddress: string;
  proxyAddress: string;
  abi: unknown[];
  txHash: string;
}

// Cached compiled proxy artifact
let proxyArtifact: { abi: unknown[]; bytecode: string } | null = null;

async function getProxyArtifact(): Promise<{ abi: unknown[]; bytecode: string }> {
  if (proxyArtifact) return proxyArtifact;

  // Minimal ERC1967Proxy that works with solc 0.8.x
  const proxySource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MinimalProxy {
    // ERC-1967 implementation slot
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address implementation, bytes memory _data) payable {
        assembly {
            sstore(IMPLEMENTATION_SLOT, implementation)
        }
        if (_data.length > 0) {
            (bool success, ) = implementation.delegatecall(_data);
            require(success, "init failed");
        }
    }

    fallback() external payable {
        assembly {
            let impl := sload(IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}`;

  console.log('Compiling ERC1967 proxy...');
  const result = await compileSolidity({ 'MinimalProxy.sol': proxySource });

  if (!result.success) {
    throw new Error(`Failed to compile proxy: ${result.errors.join(', ')}`);
  }

  const proxy = result.contracts.find((c) => c.name === 'MinimalProxy');
  if (!proxy) throw new Error('MinimalProxy not found in compilation output');

  proxyArtifact = { abi: proxy.abi, bytecode: proxy.bytecode };
  console.log('Proxy compiled successfully');
  return proxyArtifact;
}

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

  // 3. Deploy proxy (compiled from source, not hardcoded bytecode)
  const artifact = await getProxyArtifact();
  const proxyFactory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
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

// Known testnet stablecoin addresses for default paymentToken args
const TESTNET_USDT = '0x55d398326f99059fF775485246999027B3197955';

/**
 * Build initialize args by reading the ABI signature.
 * First address param gets ownerAddress, subsequent params get sensible defaults.
 */
function buildInitArgs(abi: unknown[], ownerAddress: string): unknown[] {
  const iface = new ethers.Interface(abi as ethers.InterfaceAbi);
  const initFragment = iface.getFunction('initialize');
  if (!initFragment) return [ownerAddress];

  let ownerAssigned = false;
  return initFragment.inputs.map((param) => {
    if (param.type === 'address' && !ownerAssigned) {
      ownerAssigned = true;
      return ownerAddress;
    }
    if (param.type === 'address') return TESTNET_USDT;
    if (param.type.startsWith('uint')) return 0;
    if (param.type.startsWith('int')) return 0;
    if (param.type === 'bool') return false;
    if (param.type === 'string') return '';
    if (param.type === 'bytes') return '0x';
    return ethers.ZeroAddress;
  });
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

    const initArgs = buildInitArgs(compiled.abi, ownerAddress);
    console.log(`  initialize(${initArgs.map(String).join(', ')})`);

    const result = await deployContractWithProxy(
      compiled,
      initArgs,
      privateKey,
      network,
    );
    results.push(result);
  }

  return results;
}
