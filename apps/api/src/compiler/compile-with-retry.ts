import Anthropic from '@anthropic-ai/sdk';
import { ContractSpec } from '@bnbrew/shared';
import { compileSolidity, formatCompilerErrors } from './solc';
import type { CompilationResult, CompiledContract } from './solc';
import { generateContract, type GeneratedContract } from '../agent/contract-agent';
import { CONTRACT_GENERATOR_SYSTEM_PROMPT } from '../agent/prompts';
import * as fs from 'fs/promises';
import * as path from 'path';

const MAX_RETRIES = 3;
const TEMPLATES_DIR = path.resolve(__dirname, '../../../../contracts/templates');

export interface CompileResult {
  success: boolean;
  contracts: CompiledContract[];
  source: string;
  attempts: number;
  errors?: string[];
}

export async function compileContractWithRetry(
  spec: ContractSpec,
  apiKey: string,
  basePath?: string,
): Promise<CompileResult> {
  let lastSource = '';
  let lastErrors: string[] = [];

  // Load BNBrewBase source for compilation
  const baseSource = await fs.readFile(
    path.join(TEMPLATES_DIR, 'BNBrewBase.sol'),
    'utf-8',
  );

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`Compilation attempt ${attempt}/${MAX_RETRIES} for ${spec.name}...`);

    // Generate or fix contract
    let generated: GeneratedContract;
    if (attempt === 1) {
      generated = await generateContract(spec, apiKey);
    } else {
      generated = await fixContractErrors(
        spec,
        lastSource,
        lastErrors,
        apiKey,
      );
    }

    lastSource = generated.source;

    // Build source map with dependencies
    const sources: Record<string, string> = {
      'BNBrewBase.sol': baseSource,
      [`${spec.name}.sol`]: generated.source,
    };

    // Compile
    const result: CompilationResult = await compileSolidity(sources, basePath);

    if (result.success) {
      const appContract = result.contracts.find((c) => c.name === spec.name);
      if (!appContract) {
        lastErrors = [`Contract ${spec.name} not found in compilation output`];
        continue;
      }

      console.log(`${spec.name} compiled successfully on attempt ${attempt}`);
      return {
        success: true,
        contracts: result.contracts,
        source: generated.source,
        attempts: attempt,
      };
    }

    lastErrors = result.errors;
    console.log(
      `Attempt ${attempt} failed with ${result.errors.length} error(s)`,
    );
  }

  console.error(`Failed to compile ${spec.name} after ${MAX_RETRIES} attempts`);
  return {
    success: false,
    contracts: [],
    source: lastSource,
    attempts: MAX_RETRIES,
    errors: lastErrors,
  };
}

async function fixContractErrors(
  spec: ContractSpec,
  failedSource: string,
  errors: string[],
  apiKey: string,
): Promise<GeneratedContract> {
  const client = new Anthropic({ apiKey });

  const userPrompt = `The following Solidity contract failed to compile. Fix the errors and output the corrected source code.

## ContractSpec
${JSON.stringify(spec, null, 2)}

## Failed Source Code
${failedSource}

## Compiler Errors
${formatCompilerErrors(errors)}

Output ONLY the corrected Solidity source code. No explanations.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    system: CONTRACT_GENERATOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from LLM');
  }

  let source = content.text.trim();
  if (source.startsWith('```')) {
    source = source.replace(/^```\w*\n/, '').replace(/\n```$/, '');
  }

  return { name: spec.name, source };
}

export async function compileAllContracts(
  specs: ContractSpec[],
  apiKey: string,
  basePath?: string,
): Promise<CompileResult[]> {
  const results: CompileResult[] = [];

  for (const spec of specs) {
    const result = await compileContractWithRetry(spec, apiKey, basePath);
    results.push(result);

    if (!result.success) {
      console.error(`Aborting: ${spec.name} failed to compile`);
      break;
    }
  }

  return results;
}
