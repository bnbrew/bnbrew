import type { ContractInfo } from '../frontend-agent';

export function generateContractHook(contract: ContractInfo): string {
  return `import { ethers } from 'ethers';
import ABI from '../abi/${contract.name}.json';

const CONTRACT_ADDRESS = '${contract.address}';

const RPC_URL = 'https://opbnb-testnet-rpc.bnbchain.org';

function getReadProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

function getReadContract() {
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, getReadProvider());
}

export function use${contract.name}() {
  const read = getReadContract();

  return {
    address: CONTRACT_ADDRESS,
    abi: ABI,

    // Read functions — use public RPC, no wallet needed
    async call(functionName: string, ...args: unknown[]) {
      return read[functionName](...args);
    },

    // Get contract instance with signer (admin only)
    async getSignedContract(signer: ethers.Signer) {
      return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    },
  };
}
`;
}

export function generateHooksIndex(contracts: ContractInfo[]): string {
  const imports = contracts
    .map((c) => `export { use${c.name} } from './use${c.name}';`)
    .join('\n');
  return imports + '\n';
}

export function generateAllHooks(
  contracts: ContractInfo[],
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const contract of contracts) {
    files[`src/hooks/use${contract.name}.ts`] = generateContractHook(contract);
  }

  files['src/hooks/index.ts'] = generateHooksIndex(contracts);

  return files;
}
