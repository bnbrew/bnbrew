import { Logger } from '@nestjs/common';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type { AppSpec, DeployedApp, PipelineStatus } from '@bnbrew/shared';
import { compileSolidity } from '../compiler/solc';
import { deployAppContracts } from '../deployer/contract-deployer';
import type { CompiledContract } from '../compiler/solc';
import { buildFrontend } from '../agent/frontend-agent';
import {
  createPublicBucket,
  uploadDistToBucket,
  createPrivateBucket,
  grantBucketAccess,
} from '../greenfield/greenfield-service';
import { getBucketName, getPrimarySp } from '../greenfield/client';
import { getPublicKeyFromPrivate } from '../encryption/ecies';
import { PipelineState } from './state';
import { scaffoldViteProject } from './scaffold';

export interface DeployPayload {
  appSpec: AppSpec;
  ownerAddress: string;
  contractSources: Array<{ name: string; source: string }>;
  previewFiles: Record<string, string>;
}

export interface DeployedContractInfo {
  name: string;
  proxyAddress: string;
  implAddress: string;
}

export interface PipelineCallbacks {
  onStatusChange?: (status: PipelineStatus, message: string) => void;
  onContractsDeployed?: (contracts: DeployedContractInfo[]) => void;
  onError?: (error: Error, status: PipelineStatus) => void;
}

export interface PipelineResult {
  success: boolean;
  deployedApp?: DeployedApp;
  error?: string;
  state: PipelineState;
}

const logger = new Logger('PipelineOrchestrator');

const TEMPLATES_DIR = path.resolve(process.cwd(), '../../contracts/templates');

export async function deployApp(
  payload: DeployPayload,
  callbacks?: PipelineCallbacks,
): Promise<PipelineResult> {
  const { appSpec, ownerAddress, contractSources, previewFiles } = payload;
  const state = new PipelineState(appSpec.id);
  const privateKey = process.env.DEPLOY_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOY_PRIVATE_KEY environment variable not set');
  }
  const greenfieldKey = process.env.GREENFIELD_PRIVATE_KEY || privateKey;

  const updateStatus = (status: PipelineStatus, message: string) => {
    state.setStatus(status, message);
    callbacks?.onStatusChange?.(status, message);
    logger.log(`[${appSpec.id}] ${status}: ${message}`);
  };

  try {
    // Step 1: Compile existing contract sources (no LLM — sources already generated during chat)
    updateStatus('COMPILING', 'Compiling smart contracts...');

    const baseSource = await fs.readFile(
      path.join(TEMPLATES_DIR, 'BNBrewBase.sol'),
      'utf-8',
    );

    const compiledContracts: CompiledContract[] = [];

    for (const contract of contractSources) {
      const sources: Record<string, string> = {
        'BNBrewBase.sol': baseSource,
        [`${contract.name}.sol`]: contract.source,
      };

      const result = await compileSolidity(sources);

      if (!result.success) {
        throw new Error(`Failed to compile ${contract.name}: ${result.errors.join(', ')}`);
      }

      const appContract = result.contracts.find((c) => c.name === contract.name);
      if (!appContract) {
        throw new Error(`Contract ${contract.name} not found in compilation output`);
      }

      state.addArtifact('solidity', contract.name, contract.source);
      state.addArtifact('abi', contract.name, JSON.stringify(appContract.abi));
      state.addArtifact('bytecode', contract.name, appContract.bytecode);
      compiledContracts.push(appContract);
    }

    // Step 2: Deploy contracts to opBNB
    updateStatus('DEPLOYING_CONTRACTS', 'Deploying contracts to opBNB...');
    const deployedContracts = await deployAppContracts(
      compiledContracts,
      ownerAddress,
      privateKey,
    );

    const contractInfos = deployedContracts.map((c) => ({
      name: c.contractName,
      proxyAddress: c.proxyAddress,
      implAddress: c.implementationAddress,
      txHash: c.txHash,
    }));
    state.setContracts(contractInfos);
    callbacks?.onContractsDeployed?.(contractInfos.map((c) => ({
      name: c.name,
      proxyAddress: c.proxyAddress,
      implAddress: c.implAddress,
    })));

    // Step 3: Scaffold frontend from preview files (no LLM — deterministic)
    updateStatus('GENERATING_FRONTEND', 'Building frontend...');
    const contractConfigs = deployedContracts.map((c) => ({
      name: c.contractName,
      address: c.proxyAddress,
      abi: c.abi,
    }));

    const files = scaffoldViteProject(previewFiles, contractConfigs, appSpec, ownerAddress);

    // Build frontend in clean temp directory
    const workDir = path.join(os.tmpdir(), `bnbrew-build-${appSpec.id}`);
    await fs.rm(workDir, { recursive: true, force: true });
    await fs.mkdir(workDir, { recursive: true });
    const distDir = await buildFrontend(files, workDir);
    state.addArtifact('frontend', 'distDir', distDir);

    // Step 4: Create public bucket and upload frontend
    updateStatus('UPLOADING_FRONTEND', 'Uploading to BNB Greenfield...');
    // Unique deploy ID per deploy so each gets a fresh bucket
    const deploySuffix = crypto.randomBytes(4).toString('hex');
    const deployId = `${appSpec.id}-${deploySuffix}`;

    await createPublicBucket(deployId, greenfieldKey);
    const uploads = await uploadDistToBucket(deployId, distDir, greenfieldKey);
    state.setUploads(uploads);

    // Step 5: Create private bucket and configure ACL
    updateStatus('CONFIGURING_ACL', 'Setting up encrypted storage...');
    await createPrivateBucket(deployId, greenfieldKey);

    const relayAddress = process.env.RELAY_WALLET_ADDRESS;
    if (relayAddress) {
      await grantBucketAccess(deployId, relayAddress, ['write'], greenfieldKey);
    }

    // Step 6: Register
    updateStatus('REGISTERING', 'Registering app...');

    // Step 7: Verify
    updateStatus('VERIFYING', 'Verifying deployment...');
    const ownerPublicKey = getPublicKeyFromPrivate(greenfieldKey);

    // Greenfield public URL
    const publicBucket = getBucketName(deployId, 'public');
    const sp = await getPrimarySp();
    const frontendUrl = `${sp.endpoint}/view/${publicBucket}/index.html`;

    const deployedApp: DeployedApp = {
      id: appSpec.id,
      name: appSpec.name,
      owner: ownerAddress,
      contracts: deployedContracts.map((c) => ({
        name: c.contractName,
        address: c.proxyAddress,
        network: 'opbnb-testnet',
      })),
      frontendUrl,
      publicKey: ownerPublicKey,
      createdAt: new Date().toISOString(),
    };

    updateStatus('LIVE', 'App is live!');
    state.complete(deployedApp);

    return { success: true, deployedApp, state };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    state.fail(err);
    callbacks?.onError?.(err, state.currentStatus);
    logger.error(`[${appSpec.id}] Pipeline failed at ${state.currentStatus}: ${err.message}`);

    return { success: false, error: err.message, state };
  }
}
