import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface CompilationResult {
  success: boolean;
  contracts: CompiledContract[];
  errors: string[];
  warnings: string[];
}

export interface CompiledContract {
  name: string;
  abi: unknown[];
  bytecode: string;
  deployedBytecode: string;
}

const OZ_REMAPPINGS = [
  '@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/',
  '@openzeppelin/contracts-upgradeable/=node_modules/@openzeppelin/contracts-upgradeable/',
];

export async function compileSolidity(
  sources: Record<string, string>,
  basePath?: string,
): Promise<CompilationResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bnbrew-compile-'));

  try {
    // Write source files to temp directory
    for (const [filename, content] of Object.entries(sources)) {
      const filePath = path.join(tmpDir, filename);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }

    // Build solc input JSON
    const input = {
      language: 'Solidity',
      sources: Object.fromEntries(
        Object.entries(sources).map(([name, content]) => [
          name,
          { content },
        ]),
      ),
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
          },
        },
        remappings: OZ_REMAPPINGS,
      },
    };

    const inputPath = path.join(tmpDir, 'input.json');
    await fs.writeFile(inputPath, JSON.stringify(input));

    // Run solc
    const projectRoot = basePath || process.cwd();
    const { stdout } = await execAsync(
      `npx solcjs --standard-json < "${inputPath}"`,
      {
        cwd: projectRoot,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const output = JSON.parse(stdout);
    return parseCompilerOutput(output);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function parseCompilerOutput(output: Record<string, unknown>): CompilationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const contracts: CompiledContract[] = [];

  if (output.errors && Array.isArray(output.errors)) {
    for (const err of output.errors as Array<{ severity: string; formattedMessage: string }>) {
      if (err.severity === 'error') {
        errors.push(err.formattedMessage);
      } else {
        warnings.push(err.formattedMessage);
      }
    }
  }

  if (output.contracts && typeof output.contracts === 'object') {
    const contractsOutput = output.contracts as Record<string, Record<string, {
      abi: unknown[];
      evm: { bytecode: { object: string }; deployedBytecode: { object: string } };
    }>>;

    for (const [, fileContracts] of Object.entries(contractsOutput)) {
      for (const [name, contract] of Object.entries(fileContracts)) {
        contracts.push({
          name,
          abi: contract.abi,
          bytecode: '0x' + contract.evm.bytecode.object,
          deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
        });
      }
    }
  }

  return {
    success: errors.length === 0,
    contracts,
    errors,
    warnings,
  };
}

export function formatCompilerErrors(errors: string[]): string {
  return errors
    .map((e, i) => `Error ${i + 1}:\n${e}`)
    .join('\n\n');
}
