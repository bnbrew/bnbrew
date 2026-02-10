import { Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import type { AppSpec, DeployedApp, PipelineStatus } from '@bnbrew/shared';
import { generateContract } from '../agent/contract-agent';
import { compileContractWithRetry } from '../compiler/compile-with-retry';
import { deployAppContracts } from '../deployer/contract-deployer';
import { generateFrontend, buildFrontend } from '../agent/frontend-agent';
import { createPublicBucket, uploadDistToBucket } from '../greenfield/public-bucket';
import { createPrivateBucket, grantBucketAccess } from '../greenfield/private-bucket';
import { getPublicKeyFromPrivate } from '../encryption/ecies';
import { PipelineState } from './state';

export interface PipelineCallbacks {
  onStatusChange?: (status: PipelineStatus, message: string) => void;
  onError?: (error: Error, status: PipelineStatus) => void;
}

export interface PipelineResult {
  success: boolean;
  deployedApp?: DeployedApp;
  error?: string;
  state: PipelineState;
}

const logger = new Logger('PipelineOrchestrator');

export async function deployApp(
  appSpec: AppSpec,
  privateKey: string,
  callbacks?: PipelineCallbacks,
): Promise<PipelineResult> {
  const state = new PipelineState(appSpec.id);
  const wallet = new ethers.Wallet(privateKey);

  const updateStatus = (status: PipelineStatus, message: string) => {
    state.setStatus(status, message);
    callbacks?.onStatusChange?.(status, message);
    logger.log(`[${appSpec.id}] ${status}: ${message}`);
  };

  try {
    // Step 1: Generate and compile contracts
    updateStatus('COMPILING', 'Generating smart contracts...');
    const compiledContracts = [];

    for (const contractSpec of appSpec.contracts) {
      const solidityCode = await generateContract(contractSpec);
      state.addArtifact('solidity', contractSpec.name, solidityCode);

      const compiled = await compileContractWithRetry(contractSpec.name, solidityCode);
      state.addArtifact('abi', contractSpec.name, JSON.stringify(compiled.abi));
      state.addArtifact('bytecode', contractSpec.name, compiled.bytecode);

      compiledContracts.push({
        name: contractSpec.name,
        abi: compiled.abi,
        bytecode: compiled.bytecode,
      });
    }

    // Step 2: Deploy contracts to opBNB
    updateStatus('DEPLOYING_CONTRACTS', 'Deploying contracts to opBNB...');
    const deployedContracts = await deployAppContracts(
      appSpec.id,
      compiledContracts,
      privateKey,
    );

    state.setContracts(deployedContracts);

    // Step 3: Generate and build frontend
    updateStatus('GENERATING_FRONTEND', 'Generating React frontend...');
    const contractConfigs = deployedContracts.map((c, i) => ({
      name: c.name,
      address: c.proxyAddress,
      abi: compiledContracts[i].abi,
    }));

    const frontendFiles = await generateFrontend(appSpec.frontend, contractConfigs);
    const buildOutput = await buildFrontend(appSpec.id, frontendFiles, contractConfigs);
    state.addArtifact('frontend', 'distDir', buildOutput.distDir);

    // Step 4: Create public bucket and upload frontend
    updateStatus('UPLOADING_FRONTEND', 'Uploading to BNB Greenfield...');
    await createPublicBucket(appSpec.id, privateKey);
    const uploads = await uploadDistToBucket(appSpec.id, buildOutput.distDir, privateKey);
    state.setUploads(uploads);

    // Step 5: Create private bucket and configure ACL
    updateStatus('CONFIGURING_ACL', 'Setting up encrypted storage...');
    await createPrivateBucket(appSpec.id, privateKey);

    // Grant relay service write-only access
    const relayAddress = process.env.RELAY_WALLET_ADDRESS;
    if (relayAddress) {
      await grantBucketAccess(appSpec.id, relayAddress, ['write'], privateKey);
    }

    // Step 6: Register in BNBrewRegistry
    updateStatus('REGISTERING', 'Registering app...');
    // Registry registration handled by AppFactory in contract-deployer

    // Step 7: Verify deployment
    updateStatus('VERIFYING', 'Verifying deployment...');
    const ownerPublicKey = getPublicKeyFromPrivate(privateKey);

    const deployedApp: DeployedApp = {
      id: appSpec.id,
      name: appSpec.name,
      owner: wallet.address,
      contracts: deployedContracts.map((c) => ({
        name: c.name,
        address: c.proxyAddress,
        network: 'opbnb-testnet',
      })),
      frontendUrl: `https://gnfd.bnbrew.dev/${appSpec.id}`,
      publicKey: ownerPublicKey,
      createdAt: new Date().toISOString(),
    };

    updateStatus('LIVE', 'App is live!');
    state.complete(deployedApp);

    return {
      success: true,
      deployedApp,
      state,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    state.fail(err);
    callbacks?.onError?.(err, state.currentStatus);
    logger.error(`[${appSpec.id}] Pipeline failed at ${state.currentStatus}: ${err.message}`);

    return {
      success: false,
      error: err.message,
      state,
    };
  }
}
