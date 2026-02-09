import Anthropic from '@anthropic-ai/sdk';
import { AppSpec, FrontendSpec } from '@bnbrew/shared';
import {
  FRONTEND_GENERATOR_SYSTEM_PROMPT,
  FRONTEND_GENERATOR_USER_TEMPLATE,
} from './prompts';

export interface GeneratedFrontend {
  files: Record<string, string>;
}

export interface ContractInfo {
  name: string;
  address: string;
  abi: unknown[];
}

export async function generateFrontend(
  appSpec: AppSpec,
  contracts: ContractInfo[],
  relayEndpoint: string,
  apiKey: string,
): Promise<GeneratedFrontend> {
  const client = new Anthropic({ apiKey });

  const userPrompt = FRONTEND_GENERATOR_USER_TEMPLATE
    .replace('{{frontendSpec}}', JSON.stringify(appSpec.frontend, null, 2))
    .replace('{{contractInfo}}', JSON.stringify(contracts, null, 2))
    .replace('{{appId}}', appSpec.id)
    .replace('{{ownerAddress}}', appSpec.owner)
    .replace('{{relayEndpoint}}', relayEndpoint);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 16384,
    system: FRONTEND_GENERATOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from LLM');
  }

  let text = content.text.trim();

  // Strip markdown fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```\w*\n/, '').replace(/\n```$/, '');
  }

  const files = JSON.parse(text) as Record<string, string>;

  // Ensure critical files exist
  validateFrontendFiles(files);

  return { files };
}

function validateFrontendFiles(files: Record<string, string>): void {
  const required = ['package.json', 'index.html', 'vite.config.ts'];
  const missing = required.filter((f) => !files[f]);
  if (missing.length > 0) {
    throw new Error(`Generated frontend missing required files: ${missing.join(', ')}`);
  }
}

export async function buildFrontend(
  files: Record<string, string>,
  workDir: string,
): Promise<string> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const fs = await import('fs/promises');
  const path = await import('path');
  const execAsync = promisify(exec);

  // Write all files to workDir
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(workDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Handle package.json as object or string
    const fileContent =
      typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
    await fs.writeFile(fullPath, fileContent);
  }

  // Install dependencies and build
  console.log('Installing dependencies...');
  await execAsync('pnpm install --no-frozen-lockfile', { cwd: workDir });

  console.log('Building frontend...');
  await execAsync('npx vite build', { cwd: workDir });

  const distDir = path.join(workDir, 'dist');
  console.log(`Build output: ${distDir}`);

  return distDir;
}

export function injectContractConfig(
  files: Record<string, string>,
  contracts: ContractInfo[],
  appId: string,
  relayEndpoint: string,
): Record<string, string> {
  const config = {
    appId,
    relayEndpoint,
    contracts: contracts.map((c) => ({
      name: c.name,
      address: c.address,
    })),
  };

  files['src/config.json'] = JSON.stringify(config, null, 2);

  // Generate ABI files
  for (const contract of contracts) {
    files[`src/abi/${contract.name}.json`] = JSON.stringify(contract.abi, null, 2);
  }

  return files;
}
