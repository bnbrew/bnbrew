import { ethers } from 'ethers';
import { NETWORKS, DEFAULT_NETWORK, GAS_CONFIG, type NetworkName } from './config';

interface DeployedContracts {
  registry: string;
  dataRouter: string;
  appFactory: string;
}

export async function deployPlatformContracts(
  privateKey: string,
  network: NetworkName = DEFAULT_NETWORK,
): Promise<DeployedContracts> {
  const config = NETWORKS[network];
  const provider = new ethers.JsonRpcProvider(config.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deploying platform contracts to ${config.name}...`);
  console.log(`Deployer: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} BNB`);

  // Deploy BNBrewRegistry
  console.log('\n1/3 Deploying BNBrewRegistry...');
  const registryFactory = new ethers.ContractFactory(
    REGISTRY_ABI,
    REGISTRY_BYTECODE,
    wallet,
  );
  const registry = await registryFactory.deploy({ gasLimit: GAS_CONFIG.gasLimit });
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`   BNBrewRegistry: ${registryAddr}`);

  // Deploy BNBrewDataRouter
  console.log('2/3 Deploying BNBrewDataRouter...');
  const routerFactory = new ethers.ContractFactory(
    DATA_ROUTER_ABI,
    DATA_ROUTER_BYTECODE,
    wallet,
  );
  const dataRouter = await routerFactory.deploy({ gasLimit: GAS_CONFIG.gasLimit });
  await dataRouter.waitForDeployment();
  const routerAddr = await dataRouter.getAddress();
  console.log(`   BNBrewDataRouter: ${routerAddr}`);

  // Deploy BNBrewAppFactory
  console.log('3/3 Deploying BNBrewAppFactory...');
  const factoryFactory = new ethers.ContractFactory(
    APP_FACTORY_ABI,
    APP_FACTORY_BYTECODE,
    wallet,
  );
  const appFactory = await factoryFactory.deploy({ gasLimit: GAS_CONFIG.gasLimit });
  await appFactory.waitForDeployment();
  const factoryAddr = await appFactory.getAddress();
  console.log(`   BNBrewAppFactory: ${factoryAddr}`);

  console.log('\nPlatform contracts deployed successfully!');
  console.log(`Explorer: ${config.explorer}`);

  return {
    registry: registryAddr,
    dataRouter: routerAddr,
    appFactory: factoryAddr,
  };
}

// ABIs and bytecodes will be populated after hardhat compile
const REGISTRY_ABI: string[] = [];
const REGISTRY_BYTECODE = '';
const DATA_ROUTER_ABI: string[] = [];
const DATA_ROUTER_BYTECODE = '';
const APP_FACTORY_ABI: string[] = [];
const APP_FACTORY_BYTECODE = '';
