import 'server-only';
import { loadCompilerDefaults } from '@/lib/blueprints';
import { compileStandardJson, type SolcOutput } from '@/lib/verification/solc';
import type { AstNode } from './audit/ast';
import { dependencyReader, sharedContractsReader } from './deps';
import { chainReaders, collectSources, lineColumn, type SourceReader } from './sources';

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  formatted?: string;
}

export interface BuiltContract {
  file: string;
  name: string;
  abi: unknown[];
  bytecode: `0x${string}`;
  deployedBytecode: `0x${string}`;
  methodIdentifiers: Record<string, string>;
  /** Present when the contract links external libraries; the deploy pipeline rejects those. */
  linkReferences: Record<string, unknown>;
  metadata?: string;
}

export interface StandardJsonInput {
  language: 'Solidity';
  sources: Record<string, { content: string }>;
  settings: Record<string, unknown>;
}

export interface ProjectBuild {
  ok: boolean;
  compiler: string;
  diagnostics: Diagnostic[];
  /** Contracts defined in the entry files only, not in dependencies. */
  contracts: BuiltContract[];
  sources: Record<string, string>;
  asts: Record<string, AstNode>;
  /** Exactly what solc compiled, for source verification. */
  input: StandardJsonInput;
}

interface SolcDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  formattedMessage?: string;
  sourceLocation?: { file: string; start: number; end: number };
}

interface SolcArtifact {
  abi?: unknown[];
  metadata?: string;
  evm?: {
    bytecode?: { object?: string; linkReferences?: Record<string, unknown> };
    deployedBytecode?: { object?: string };
    methodIdentifiers?: Record<string, string>;
  };
}

export const VIA_IR_NOTE =
  'Compiled with viaIR: the legacy pipeline ran out of stack slots (Stack too deep), so Studio built this project through the IR optimizer instead. The contract metadata records it, so verification uses the same setting.';

/** Whether a build had to fall back to viaIR, from its saved diagnostics. */
export const builtViaIR = (diagnostics: { message?: string }[]) => diagnostics.some((d) => d.message === VIA_IR_NOTE);

/**
 * Compiles `entries` (unit name to source) plus everything they import, with
 * the shared blueprint settings. Compiler errors come back as diagnostics;
 * only problems that prevented compiling at all throw. A "Stack too deep"
 * failure is retried once through viaIR, which solc itself recommends and
 * which leaves projects that compile fine on the defaults untouched.
 */
export async function compileSources(
  entries: Record<string, string>,
  { readers = [] }: { readers?: SourceReader[] } = {},
): Promise<ProjectBuild> {
  const settings = loadCompilerDefaults();
  const sources = await collectSources(entries, chainReaders(...readers, sharedContractsReader(), dependencyReader()), {
    remappings: settings.remappings,
  });
  const first = await compileWith(entries, sources, settings.viaIR);
  if (
    first.ok ||
    settings.viaIR ||
    !first.diagnostics.some((d) => d.severity === 'error' && /stack too deep/i.test(d.message))
  ) {
    return first;
  }
  const retry = await compileWith(entries, sources, true);
  if (retry.diagnostics.some((d) => d.severity === 'error' && /stack too deep/i.test(d.message))) return first;
  return { ...retry, diagnostics: [{ severity: 'info', message: VIA_IR_NOTE }, ...retry.diagnostics] };
}

async function compileWith(
  entries: Record<string, string>,
  sources: Record<string, string>,
  viaIR: boolean,
): Promise<ProjectBuild> {
  const settings = loadCompilerDefaults();
  const artifacts = [
    'abi',
    'metadata',
    'evm.bytecode.object',
    'evm.bytecode.linkReferences',
    'evm.deployedBytecode.object',
    'evm.methodIdentifiers',
  ];
  const input: StandardJsonInput = {
    language: 'Solidity',
    sources: Object.fromEntries(Object.entries(sources).map(([unit, content]) => [unit, { content }])),
    settings: {
      optimizer: settings.optimizer,
      evmVersion: settings.evmVersion,
      viaIR,
      remappings: settings.remappings,
      outputSelection: {
        '*': { '': ['ast'] },
        ...Object.fromEntries(Object.keys(entries).map((unit) => [unit, { '*': artifacts, '': ['ast'] }])),
      },
    },
  };

  const { output, longVersion } = await compileStandardJson({
    stdJsonInput: input,
    compilerVersion: settings.solcLongVersion,
  });
  const diagnostics = toDiagnostics(output, sources);
  const contracts: BuiltContract[] = [];
  const compiled = (output.contracts ?? {}) as Record<string, Record<string, SolcArtifact>>;
  for (const file of Object.keys(entries)) {
    for (const [name, artifact] of Object.entries(compiled[file] ?? {})) {
      contracts.push({
        file,
        name,
        abi: artifact.abi ?? [],
        bytecode: `0x${artifact.evm?.bytecode?.object ?? ''}`,
        deployedBytecode: `0x${artifact.evm?.deployedBytecode?.object ?? ''}`,
        methodIdentifiers: artifact.evm?.methodIdentifiers ?? {},
        linkReferences: artifact.evm?.bytecode?.linkReferences ?? {},
        metadata: artifact.metadata,
      });
    }
  }

  const asts: Record<string, AstNode> = {};
  for (const [unit, info] of Object.entries((output.sources ?? {}) as Record<string, { ast?: AstNode }>)) {
    if (info.ast) asts[unit] = info.ast;
  }

  return {
    ok: !diagnostics.some((d) => d.severity === 'error'),
    compiler: longVersion,
    diagnostics,
    contracts,
    sources,
    asts,
    input,
  };
}

function toDiagnostics(output: SolcOutput, sources: Record<string, string>): Diagnostic[] {
  return ((output.errors ?? []) as SolcDiagnostic[]).map((e) => {
    const location = e.sourceLocation;
    const source = location ? sources[location.file] : undefined;
    const position = source && location ? lineColumn(source, location.start) : undefined;
    return {
      severity: e.severity,
      message: e.message,
      file: location?.file,
      line: position?.line,
      column: position?.column,
      formatted: e.formattedMessage,
    };
  });
}
