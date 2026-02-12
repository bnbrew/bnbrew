import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';

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

const CONTRACTS_DIR = path.resolve(process.cwd(), '../../contracts');

export async function compileSolidity(
  sources: Record<string, string>,
): Promise<CompilationResult> {
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
    },
  };

  // Import callback resolves @openzeppelin imports from contracts/node_modules
  function findImports(importPath: string): { contents: string } | { error: string } {
    const searchPaths = [
      path.join(CONTRACTS_DIR, 'node_modules', importPath),
      path.join(CONTRACTS_DIR, importPath),
    ];

    for (const fullPath of searchPaths) {
      try {
        const contents = fs.readFileSync(fullPath, 'utf-8');
        return { contents };
      } catch {
        // try next path
      }
    }

    return { error: `File not found: ${importPath}` };
  }

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  );

  return parseCompilerOutput(output);
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
