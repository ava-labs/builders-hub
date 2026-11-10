import { REF_PATTERN, type NetworkEntry, type Registry } from './schema';

export type RefScope = 'param' | 'net' | 'reg' | 'out' | 'ctx';

export interface ParsedRef {
  scope: RefScope;
  path: string[];
}

export function parseRef(value: string): ParsedRef | null {
  const match = REF_PATTERN.exec(value);
  if (!match) return null;
  return { scope: match[1] as RefScope, path: match[2].split('.') };
}

export function isRefLike(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('$');
}

/** Every string in a JSON value that starts with `$`, including malformed ones. */
export function collectRefs(value: unknown, out: string[] = []): string[] {
  if (isRefLike(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectRefs(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectRefs(item, out));
  return out;
}

export function lookupPath(root: unknown, path: string[]): { found: boolean; value: unknown } {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || typeof current !== 'object' || !(segment in current)) return { found: false, value: undefined };
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

export interface Bindings {
  /** Role to network key, e.g. { main: "fuji-c-chain" }. */
  networks: Record<string, string>;
  params?: Record<string, unknown>;
  /** Step id to its outputs: address, txHash, and declared outputs. */
  outputs?: Record<string, Record<string, unknown>>;
  ctx?: Partial<Record<'deployer' | 'builder', string>>;
  /** Run-time values for networks the registry cannot know, keyed by network key (usually "l1"). */
  runtime?: Record<string, Partial<NetworkEntry>>;
}

export class UnresolvedRefError extends Error {
  constructor(
    readonly ref: string,
    readonly reason: string,
  ) {
    super(`${ref}: ${reason}`);
    this.name = 'UnresolvedRefError';
  }
}

/** The registry entry for a network, with run-time values layered on top. */
export function boundNetwork(registry: Registry, networkKey: string, bindings?: Bindings): NetworkEntry | undefined {
  const entry = registry.networks[networkKey];
  if (!entry) return undefined;
  const runtime = bindings?.runtime?.[networkKey];
  return runtime ? deepMerge(entry, runtime) : entry;
}

/** Resolve one reference. Throws UnresolvedRefError when the value is missing or only known later. */
export function resolveRef(ref: string, registry: Registry, bindings: Bindings): unknown {
  const parsed = parseRef(ref);
  if (!parsed) throw new UnresolvedRefError(ref, 'not a valid reference');
  const [head, ...rest] = parsed.path;

  const mustExist = (result: { found: boolean; value: unknown }, where: string) => {
    if (!result.found) throw new UnresolvedRefError(ref, `no such value in ${where}`);
    if (result.value === null || result.value === undefined) throw new UnresolvedRefError(ref, `${where} only knows this at run time`);
    return result.value;
  };

  switch (parsed.scope) {
    case 'param': {
      if (!bindings.params || !(head in bindings.params)) throw new UnresolvedRefError(ref, 'parameter not supplied');
      return bindings.params[head];
    }
    case 'net': {
      const networkKey = bindings.networks[head];
      if (!networkKey) throw new UnresolvedRefError(ref, `role "${head}" is not bound to a network`);
      const entry = boundNetwork(registry, networkKey, bindings);
      if (!entry) throw new UnresolvedRefError(ref, `unknown network "${networkKey}"`);
      return mustExist(lookupPath(entry, rest), networkKey);
    }
    case 'reg':
      return mustExist(lookupPath(registry, parsed.path), 'the registry');
    case 'out': {
      const step = bindings.outputs?.[head];
      if (!step) throw new UnresolvedRefError(ref, `step "${head}" has not produced outputs yet`);
      return mustExist(lookupPath(step, rest), `step "${head}"`);
    }
    case 'ctx': {
      const value = bindings.ctx?.[head as 'deployer' | 'builder'];
      if (!value) throw new UnresolvedRefError(ref, 'not known in this context');
      return value;
    }
  }
}

/** Resolve every reference inside a JSON value, leaving literals untouched. */
export function resolveDeep(value: unknown, registry: Registry, bindings: Bindings): unknown {
  if (isRefLike(value)) return resolveRef(value, registry, bindings);
  if (Array.isArray(value)) return value.map((item) => resolveDeep(item, registry, bindings));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveDeep(item, registry, bindings)]));
  }
  return value;
}

function deepMerge<T>(base: T, override: Partial<T>): T {
  if (!override || typeof override !== 'object') return base;
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value) && existing && typeof existing === 'object'
        ? deepMerge(existing, value as Partial<typeof existing>)
        : value;
  }
  return result as T;
}
