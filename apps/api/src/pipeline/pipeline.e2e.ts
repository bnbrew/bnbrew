/**
 * End-to-end pipeline integration test
 *
 * Tests the full flow: AppSpec → compiled contracts → deployed → frontend → live
 * Uses opBNB testnet and Greenfield testnet.
 */

import { deployApp, type PipelineResult } from './orchestrator';
import type { AppSpec, PipelineStatus } from '@bnbrew/shared';

const TEST_APP_SPEC: AppSpec = {
  id: 'test-contact-form',
  name: 'Test Contact Form',
  description: 'A simple contact form app for e2e testing',
  owner: '',
  contracts: [
    {
      name: 'ContactForm',
      description: 'A contact form contract that stores encrypted submissions',
      inherits: 'BNBrewBase',
      functions: [
        {
          name: 'submitForm',
          description: 'Submit a form entry with encrypted data hash',
          params: [
            { name: 'dataHash', type: 'bytes32' },
            { name: 'metadata', type: 'string' },
          ],
          returns: 'uint256',
          visibility: 'external',
          modifiers: [],
          payable: false,
        },
      ],
      events: [
        {
          name: 'FormSubmitted',
          params: [
            { name: 'submitter', type: 'address' },
            { name: 'dataHash', type: 'bytes32' },
            { name: 'timestamp', type: 'uint256' },
          ],
        },
      ],
      stateVars: [],
    },
  ],
  frontend: {
    pages: [
      {
        route: '/',
        title: 'Contact Us',
        components: [
          { type: 'form', props: { fields: ['name', 'email', 'message'] } },
        ],
        layout: 'single',
        requiresAuth: false,
      },
    ],
    theme: {
      primaryColor: '#F0B90B',
      darkMode: true,
    },
    features: ['encryption', 'relay'],
  },
  storage: {
    publicBucket: true,
    privateBucket: true,
    encryption: true,
  },
  deployment: {
    network: 'opbnb-testnet',
    proxyPattern: 'uups',
  },
};

async function runE2ETest(): Promise<void> {
  console.log('=== BNBrew E2E Pipeline Test ===\n');

  const ownerAddress = process.env.TEST_OWNER_ADDRESS || '0x0000000000000000000000000000000000000000';

  const statusLog: Array<{ status: PipelineStatus; message: string; time: number }> = [];
  const startTime = Date.now();

  const result: PipelineResult = await deployApp(
    {
      appSpec: TEST_APP_SPEC,
      ownerAddress,
      contractSources: [],
      previewFiles: {},
    },
    {
      onStatusChange: (status, message) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [${elapsed}s] ${status}: ${message}`);
        statusLog.push({ status, message, time: Date.now() });
      },
      onError: (error, status) => {
        console.error(`  FAILED at ${status}: ${error.message}`);
      },
    },
  );

  console.log('\n=== Results ===');
  console.log(`Success: ${result.success}`);
  console.log(`Final status: ${result.state.currentStatus}`);
  console.log(`Total time: ${(result.state.elapsed() / 1000).toFixed(1)}s`);

  if (result.deployedApp) {
    console.log(`\nDeployed App:`);
    console.log(`  Name: ${result.deployedApp.name}`);
    console.log(`  Owner: ${result.deployedApp.owner}`);
    console.log(`  Frontend: ${result.deployedApp.frontendUrl}`);
    console.log(`  Contracts:`);
    for (const contract of result.deployedApp.contracts) {
      console.log(`    ${contract.name}: ${contract.address}`);
    }
  }

  if (result.error) {
    console.error(`\nError: ${result.error}`);
    process.exit(1);
  }

  // Verify pipeline went through all expected states
  const expectedStates: PipelineStatus[] = [
    'COMPILING',
    'DEPLOYING_CONTRACTS',
    'GENERATING_FRONTEND',
    'UPLOADING_FRONTEND',
    'CONFIGURING_ACL',
    'REGISTERING',
    'VERIFYING',
    'LIVE',
  ];

  const actualStates = statusLog.map((s) => s.status);
  const missingStates = expectedStates.filter((s) => !actualStates.includes(s));

  if (missingStates.length > 0) {
    console.error(`\nMissing pipeline states: ${missingStates.join(', ')}`);
    process.exit(1);
  }

  console.log('\nAll pipeline states verified.');
  console.log('E2E test passed!');
}

// Run if executed directly
runE2ETest().catch((err) => {
  console.error('E2E test crashed:', err);
  process.exit(1);
});
