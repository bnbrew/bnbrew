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

  // Use streaming to avoid timeout on long generations
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 32768,
    system: FRONTEND_GENERATOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const response = await stream.finalMessage();

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from LLM');
  }

  let text = content.text.trim();

  // Strip markdown fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```\w*\n/, '').replace(/\n```$/, '');
  }

  // If response was truncated (stop_reason=max_tokens), try to repair JSON
  let files: Record<string, string>;
  try {
    files = JSON.parse(text) as Record<string, string>;
  } catch {
    console.warn('JSON parse failed, attempting repair...');
    files = repairTruncatedJson(text);
  }

  // Ensure critical files exist
  validateFrontendFiles(files);

  return { files };
}

/**
 * Attempt to repair truncated JSON from LLM output.
 * The JSON is a Record<string, string> so we find the last complete key-value pair.
 */
function repairTruncatedJson(text: string): Record<string, string> {
  // Find the last complete "key": "value" entry by looking for the last complete string value
  // Pattern: the text ends mid-value, so find the last `",\n  "` or `"\n}` boundary
  const lastCompleteEntry = text.lastIndexOf('",\n');
  if (lastCompleteEntry === -1) {
    throw new Error('Cannot repair truncated JSON: no complete entries found');
  }

  const repaired = text.substring(0, lastCompleteEntry + 1) + '\n}';
  try {
    return JSON.parse(repaired) as Record<string, string>;
  } catch {
    throw new Error('Cannot repair truncated JSON');
  }
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
  await execAsync('npx vite build', { cwd: workDir, timeout: 60_000 });

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
