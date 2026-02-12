import Anthropic from '@anthropic-ai/sdk';
import { ContractSpec } from '@bnbrew/shared';
import { CONTRACT_GENERATOR_SYSTEM_PROMPT } from './prompts';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEMPLATES_DIR = path.resolve(process.cwd(), '../../contracts/templates');

export interface GeneratedContract {
  name: string;
  source: string;
}

export async function generateContract(
  spec: ContractSpec,
  apiKey: string,
): Promise<GeneratedContract> {
  const client = new Anthropic({ apiKey });

  const baseSource = await fs.readFile(
    path.join(TEMPLATES_DIR, 'BNBrewBase.sol'),
    'utf-8',
  );

  const userPrompt = `Generate a Solidity contract from this ContractSpec:

${JSON.stringify(spec, null, 2)}

The BNBrewBase contract source for reference:
${baseSource}

Output ONLY the Solidity source code for ${spec.name}.sol`;

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    system: CONTRACT_GENERATOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const response = await stream.finalMessage();

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from LLM');
  }

  let source = content.text.trim();

  // Strip markdown fences if present
  if (source.startsWith('```')) {
    source = source.replace(/^```\w*\n/, '').replace(/\n```$/, '');
  }

  return {
    name: spec.name,
    source,
  };
}

export async function generateContractsFromSpecs(
  specs: ContractSpec[],
  apiKey: string,
): Promise<GeneratedContract[]> {
  const results: GeneratedContract[] = [];

  for (const spec of specs) {
    const contract = await generateContract(spec, apiKey);
    results.push(contract);
  }

  return results;
}

export function buildSourceMap(
  contracts: GeneratedContract[],
): Record<string, string> {
  const sources: Record<string, string> = {};

  for (const contract of contracts) {
    sources[`${contract.name}.sol`] = contract.source;
  }

  return sources;
}
