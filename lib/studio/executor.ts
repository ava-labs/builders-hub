import {
  concat,
  decodeEventLog,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeDeployData,
  encodeFunctionData,
  getAddress,
  isAddress,
  isHex,
  type Abi,
  type AbiFunction,
  type AbiParameter,
  type Address,
  type Hex,
} from 'viem';
import {
  boundNetwork,
  resolveDeep,
  resolveRef,
  UnresolvedRefError,
  type BlueprintCheck,
  type BlueprintManifest,
  type BlueprintStep,
  type Bindings,
  type Registry,
} from '@/lib/blueprints';
import { linkLibraries, type HardhatLinkReferences } from '@/lib/eerc/linkLibraries';
import type { StepStatus } from './status';

/*
 * Walks a blueprint's steps without touching a chain. The server calls
 * prepareStep() to get the exact transaction for the builder's wallet,
 * then records what the chain says happened with outputsFromReceipt().
 * Everything here is deterministic, so the transaction the server later
 * finds on-chain can be compared byte for byte with the one it prepared.
 */

export interface Artifact {
  abi: Abi;
  bytecode?: Hex;
  linkReferences?: HardhatLinkReferences;
}

export type ArtifactMap = Record<string, Artifact>;

export interface StepState {
  status: StepStatus;
  chainId?: number;
  txHash?: Hex;
  address?: Address;
  blockNumber?: string;
  outputs?: Record<string, unknown>;
  error?: string;
  reason?: string;
  /** Transactions a platform service signed for this step, e.g. a Quick L1 launch. */
  evidence?: { label: string; chain: string; hash: string; url: string | null }[];
  /** A done step that left something for the builder to fix, e.g. a relayer that never came up. */
  warning?: string;
  /** Sub-steps of a job a platform service ran, e.g. Quick L1's pipeline, as they stood when the step settled. */
  progress?: {
    label: string;
    status: 'done' | 'current' | 'pending' | 'failed';
    txs?: { label: string | null; chain: string; hash: string; url: string | null }[];
  }[];
  at: string;
}

export type StepStates = Record<string, StepState>;

export interface DeploymentContext {
  manifest: BlueprintManifest;
  registry: Registry;
  /** Role to network key. */
  networks: Record<string, string>;
  /** Builder-supplied parameter values; defaults fill the rest. */
  params: Record<string, unknown>;
  runtime?: Bindings['runtime'];
  /** The wallet signing this deployment. */
  signer?: Address;
  states: StepStates;
}

export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanError';
  }
}

/* ------------------------------ bindings ------------------------------ */

export function resolveParams(
  manifest: BlueprintManifest,
  overrides: Record<string, unknown>,
  ctx: Bindings['ctx'],
): { params: Record<string, unknown>; missing: string[] } {
  const params: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const spec of manifest.params) {
    const raw = overrides[spec.name] ?? spec.default;
    if (raw === undefined) {
      missing.push(spec.name);
      continue;
    }
    // Defaults may point at the signer, e.g. "$ctx.builder".
    params[spec.name] =
      typeof raw === 'string' && raw.startsWith('$ctx.') ? (ctx?.[raw.slice(5) as 'deployer' | 'builder'] ?? raw) : raw;
  }
  return { params, missing };
}

export function bindingsOf(dc: DeploymentContext): Bindings {
  const ctx = dc.signer ? { deployer: dc.signer, builder: dc.signer } : undefined;
  const { params } = resolveParams(dc.manifest, dc.params, ctx);
  const outputs: Record<string, Record<string, unknown>> = {};
  for (const [stepId, state] of Object.entries(dc.states)) {
    if (state.status !== 'done') continue;
    outputs[stepId] = {
      ...(state.address ? { address: state.address } : {}),
      ...(state.txHash ? { txHash: state.txHash } : {}),
      ...state.outputs,
    };
  }
  return { networks: dc.networks, params, outputs, ctx, runtime: dc.runtime };
}

export function chainIdOf(dc: DeploymentContext, role: string): number {
  const key = dc.networks[role];
  const entry = key ? boundNetwork(dc.registry, key, bindingsOf(dc)) : undefined;
  if (!entry || typeof entry.evmChainId !== 'number') {
    throw new PlanError(`Network role "${role}" is not bound to a chain with a known EVM chain ID.`);
  }
  return entry.evmChainId;
}

const settled = (state: StepState | undefined) => state?.status === 'done' || state?.status === 'skipped';

/** The first step that still has to run, or undefined when the plan is finished. */
export function pendingStep(dc: DeploymentContext): BlueprintStep | undefined {
  return dc.manifest.steps.find((step) => !settled(dc.states[step.id]));
}

export function isComplete(dc: DeploymentContext): boolean {
  return pendingStep(dc) === undefined;
}

/* ------------------------------ encoding ------------------------------ */

export function coerceArg(value: unknown, param: AbiParameter, where: string): unknown {
  const type = param.type;
  const array = /^(.*)\[(\d*)\]$/.exec(type);
  if (array) {
    if (!Array.isArray(value)) throw new PlanError(`${where}: expected an array for ${type}`);
    if (array[2] && value.length !== Number(array[2])) throw new PlanError(`${where}: expected ${array[2]} items`);
    return value.map((item, i) => coerceArg(item, { ...param, type: array[1] }, `${where}[${i}]`));
  }
  if (type === 'tuple') {
    const components = (param as { components?: readonly AbiParameter[] }).components ?? [];
    if (Array.isArray(value)) return components.map((c, i) => coerceArg(value[i], c, `${where}.${c.name ?? i}`));
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return Object.fromEntries(
        components.map((c) => [c.name ?? '', coerceArg(record[c.name ?? ''], c, `${where}.${c.name}`)]),
      );
    }
    throw new PlanError(`${where}: expected an object for a struct`);
  }
  if (/^u?int\d*$/.test(type)) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
    throw new PlanError(`${where}: expected an integer, got ${JSON.stringify(value)}`);
  }
  if (type === 'address') {
    if (typeof value === 'string' && isAddress(value, { strict: false })) return getAddress(value);
    throw new PlanError(`${where}: expected an address, got ${JSON.stringify(value)}`);
  }
  if (type === 'bool') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 'false') return value === 'true';
    throw new PlanError(`${where}: expected true or false`);
  }
  const fixed = /^bytes(\d+)$/.exec(type);
  if (fixed) {
    if (typeof value === 'string' && isHex(value) && value.length === 2 + Number(fixed[1]) * 2) return value;
    throw new PlanError(`${where}: expected ${fixed[1]} bytes of hex`);
  }
  if (type === 'bytes') {
    if (typeof value === 'string' && isHex(value)) return value;
    throw new PlanError(`${where}: expected hex bytes`);
  }
  if (type === 'string') {
    if (typeof value === 'string') return value;
    throw new PlanError(`${where}: expected a string`);
  }
  return value;
}

function coerceArgs(values: unknown[], inputs: readonly AbiParameter[], where: string): unknown[] {
  if (values.length !== inputs.length)
    throw new PlanError(`${where}: expected ${inputs.length} arguments, got ${values.length}`);
  return inputs.map((input, i) => coerceArg(values[i], input, `${where} ${input.name || `#${i}`}`));
}

export function findFunction(abi: Abi, name: string, arity: number): AbiFunction {
  const candidates = abi.filter(
    (item): item is AbiFunction => item.type === 'function' && item.name === name && item.inputs.length === arity,
  );
  if (candidates.length === 0) throw new PlanError(`No function ${name} with ${arity} arguments in the ABI`);
  return candidates[0];
}

function resolve(value: unknown, dc: DeploymentContext, bindings: Bindings): unknown {
  try {
    return resolveDeep(value, dc.registry, bindings);
  } catch (error) {
    if (error instanceof UnresolvedRefError)
      throw new PlanError(`${error.ref} cannot be resolved yet: ${error.reason}`);
    throw error;
  }
}

function toWei(value: unknown): bigint {
  if (value === undefined || value === null) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new PlanError(`value must be an integer amount of wei, got ${JSON.stringify(value)}`);
}

const sameValue = (a: unknown, b: unknown): boolean => {
  const norm = (v: unknown) =>
    typeof v === 'string' ? v.toLowerCase() : typeof v === 'bigint' ? v.toString() : JSON.stringify(v);
  return norm(a) === norm(b);
};

export type PreparedStep =
  | {
      kind: 'tx';
      step: BlueprintStep;
      chainId: number;
      request: { to?: Address; data: Hex; value: bigint };
      display: { contract: string; function?: string; args: unknown[] };
    }
  | { kind: 'read'; step: BlueprintStep; chainId: number; call: { to: Address; data: Hex }; fn: AbiFunction; abi: Abi }
  | { kind: 'offchain'; step: BlueprintStep; chainId: number; inputs: Record<string, unknown> }
  | { kind: 'wait'; step: BlueprintStep; chainId: number; id: unknown }
  | { kind: 'skip'; step: BlueprintStep; reason: string };

export function prepareStep(dc: DeploymentContext, step: BlueprintStep, artifacts: ArtifactMap): PreparedStep {
  const bindings = bindingsOf(dc);
  const chainId = chainIdOf(dc, step.network);

  if (step.skipIf) {
    const actual = resolve(step.skipIf.value, dc, bindings);
    if (sameValue(actual, resolve(step.skipIf.equals, dc, bindings))) {
      return { kind: 'skip', step, reason: `${step.skipIf.value} is ${JSON.stringify(step.skipIf.equals)}` };
    }
  }

  if (step.kind === 'offchain') {
    return {
      kind: 'offchain',
      step,
      chainId,
      inputs: (resolve(step.inputs ?? {}, dc, bindings) as Record<string, unknown>) ?? {},
    };
  }
  if (step.kind === 'wait') {
    return { kind: 'wait', step, chainId, id: resolve(step.wait!.id, dc, bindings) };
  }

  const artifact = artifacts[step.contract!];
  if (!artifact) throw new PlanError(`No compiled artifact for ${step.contract}`);
  const rawArgs = (resolve(step.args ?? [], dc, bindings) as unknown[]) ?? [];

  if (step.kind === 'deploy') {
    if (!artifact.bytecode || artifact.bytecode === '0x')
      throw new PlanError(`${step.contract} has no bytecode to deploy`);
    const ctor = artifact.abi.find((item) => item.type === 'constructor') as
      | { inputs: readonly AbiParameter[] }
      | undefined;
    const args = coerceArgs(rawArgs, ctor?.inputs ?? [], `${step.contract} constructor`);
    let bytecode = artifact.bytecode;
    if (artifact.linkReferences && Object.keys(artifact.linkReferences).length > 0) {
      const libraries = resolve(step.libraries ?? {}, dc, bindings) as Record<string, Hex>;
      bytecode = linkLibraries(bytecode, artifact.linkReferences, libraries);
    }
    const data = encodeDeployData({ abi: artifact.abi, bytecode, args });
    return {
      kind: 'tx',
      step,
      chainId,
      request: { data, value: toWei(resolve(step.value, dc, bindings)) },
      display: { contract: step.contract!, args },
    };
  }

  const target = resolve(step.target, dc, bindings);
  if (typeof target !== 'string' || !isAddress(target, { strict: false }))
    throw new PlanError(`${step.id}: target is not an address`);
  const fn = findFunction(artifact.abi, step.function!, rawArgs.length);
  const args = coerceArgs(rawArgs, fn.inputs, `${step.contract}.${fn.name}`);
  const data = encodeFunctionData({ abi: artifact.abi, functionName: fn.name, args });

  if (step.kind === 'read') {
    return { kind: 'read', step, chainId, call: { to: getAddress(target), data }, fn, abi: artifact.abi };
  }

  // Handing a contract to its current signer is a no-op; skip the transaction.
  if (fn.name === 'transferOwnership' && dc.signer && sameValue(args[0], dc.signer)) {
    return { kind: 'skip', step, reason: 'the signer already owns it' };
  }

  return {
    kind: 'tx',
    step,
    chainId,
    request: { to: getAddress(target), data, value: toWei(resolve(step.value, dc, bindings)) },
    display: { contract: step.contract!, function: fn.name, args },
  };
}

/* ------------------------------- results ------------------------------- */

/** JSON-safe copy: bigints become decimal strings. */
export function toJsonValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJsonValue(v)]));
  return value;
}

export interface ReceiptLike {
  contractAddress?: string | null;
  logs: readonly { address: string; topics: readonly Hex[]; data: Hex }[];
}

/** Declared `event:` outputs, decoded from the receipt the server fetched itself. */
export function outputsFromReceipt(
  step: BlueprintStep,
  receipt: ReceiptLike,
  artifacts: ArtifactMap,
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};
  for (const [name, source] of Object.entries(step.outputs ?? {})) {
    const match = /^event:([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)$/.exec(source);
    if (!match) continue;
    const [, contract, eventName, arg] = match;
    const abi = artifacts[contract]?.abi;
    if (!abi) throw new PlanError(`No ABI for ${contract} to decode ${eventName}`);
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi,
          eventName,
          topics: log.topics as [Hex, ...Hex[]],
          data: log.data,
          strict: false,
        });
        const value = (decoded.args as Record<string, unknown> | undefined)?.[arg];
        if (value !== undefined) {
          outputs[name] = toJsonValue(value);
          break;
        }
      } catch {
        /* a different event */
      }
    }
    if (!(name in outputs)) throw new PlanError(`The receipt has no ${contract}.${eventName} event with ${arg}`);
  }
  return outputs;
}

/** `return` and `return.<name>` outputs of a read step. */
export function outputsFromRead(step: BlueprintStep, fn: AbiFunction, abi: Abi, result: Hex): Record<string, unknown> {
  const decoded = decodeFunctionResult({ abi, functionName: fn.name, args: undefined, data: result } as Parameters<
    typeof decodeFunctionResult
  >[0]);
  const values = fn.outputs.length > 1 ? (decoded as unknown[]) : [decoded];
  const outputs: Record<string, unknown> = {};
  for (const [name, source] of Object.entries(step.outputs ?? {})) {
    if (source === 'return') outputs[name] = toJsonValue(values[0]);
    else if (source.startsWith('return.')) {
      const index = fn.outputs.findIndex((o) => o.name === source.slice(7));
      if (index === -1) throw new PlanError(`${fn.name} has no output named ${source.slice(7)}`);
      outputs[name] = toJsonValue(values[index]);
    }
  }
  return outputs;
}

/**
 * `result.<path>` outputs of an off-chain or wait step. A field the result
 * lacks (such as interop addresses when interop was off) is stored as null,
 * so a later step that needs it stops with "only known at run time".
 */
export function outputsFromResult(step: BlueprintStep, result: Record<string, unknown>): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};
  for (const [name, source] of Object.entries(step.outputs ?? {})) {
    if (!source.startsWith('result.')) continue;
    let value: unknown = result;
    for (const key of source.slice(7).split('.')) value = (value as Record<string, unknown> | undefined)?.[key];
    outputs[name] = value === undefined ? null : toJsonValue(value);
  }
  return outputs;
}

/* -------------------------------- checks -------------------------------- */

export const checksAfter = (manifest: BlueprintManifest, stepId: string): BlueprintCheck[] =>
  manifest.checks.filter((check) => check.after === stepId);

export function prepareCheck(dc: DeploymentContext, check: BlueprintCheck, artifacts: ArtifactMap) {
  const bindings = bindingsOf(dc);
  const abi = artifacts[check.contract]?.abi;
  if (!abi) throw new PlanError(`No ABI for ${check.contract}`);
  const target = resolve(check.target, dc, bindings);
  if (typeof target !== 'string' || !isAddress(target, { strict: false }))
    throw new PlanError(`${check.description}: target is not an address`);
  const rawArgs = (resolve(check.args ?? [], dc, bindings) as unknown[]) ?? [];
  const fn = findFunction(abi, check.function, rawArgs.length);
  const data = encodeFunctionData({
    abi,
    functionName: fn.name,
    args: coerceArgs(rawArgs, fn.inputs, `${check.contract}.${fn.name}`),
  });
  return { chainId: chainIdOf(dc, check.network), call: { to: getAddress(target), data }, fn, abi };
}

/** The first return value, or the first field when it is a struct. */
export function firstReturn(fn: AbiFunction, abi: Abi, result: Hex): unknown {
  const decoded = decodeFunctionResult({ abi, functionName: fn.name, args: undefined, data: result } as Parameters<
    typeof decodeFunctionResult
  >[0]);
  let value: unknown = fn.outputs.length > 1 ? (decoded as unknown[])[0] : decoded;
  if (value && typeof value === 'object' && !Array.isArray(value)) value = Object.values(value)[0];
  else if (Array.isArray(value) && fn.outputs[0]?.type === 'tuple') value = value[0];
  return value;
}

export function evaluateExpectation(actual: unknown, expect: BlueprintCheck['expect'], dc: DeploymentContext): boolean {
  const bindings = bindingsOf(dc);
  const big = (v: unknown) =>
    typeof v === 'bigint'
      ? v
      : typeof v === 'number'
        ? BigInt(v)
        : typeof v === 'string' && /^-?\d+$/.test(v)
          ? BigInt(v)
          : undefined;
  if ('nonZero' in expect) {
    if (typeof actual === 'bigint') return actual !== 0n;
    if (typeof actual === 'string') return !/^0x0*$/i.test(actual) && actual !== '';
    return Boolean(actual);
  }
  if ('equals' in expect) {
    const expected = resolve(expect.equals, dc, bindings);
    const a = big(actual);
    const b = big(expected);
    if (a !== undefined && b !== undefined) return a === b;
    return sameValue(actual, expected);
  }
  const bound = big(resolve('gt' in expect ? expect.gt : expect.gte, dc, bindings));
  const value = big(actual);
  if (bound === undefined || value === undefined) return false;
  return 'gt' in expect ? value > bound : value >= bound;
}

/* ---------------------------- off-chain work ---------------------------- */

/** CCIP GenericExtraArgsV2: tag 0x181dcf10, then abi.encode(gasLimit, allowOutOfOrderExecution). */
export function encodeCcipExtraArgs(gasLimit: bigint, allowOutOfOrderExecution = true): Hex {
  return concat([
    '0x181dcf10',
    encodeAbiParameters([{ type: 'uint256' }, { type: 'bool' }], [gasLimit, allowOutOfOrderExecution]),
  ]);
}
