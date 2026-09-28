import "server-only";
import l1ChainsData from "@/constants/l1-chains.json";

/* ------------------------------------------------------------------ */
/* Chain resolution for verification and Sourcify lookups.             */
/*                                                                     */
/* Verification only ever talks to RPCs we chose: the caller names a    */
/* chain id and we look the endpoint up here. A submitted RPC URL is    */
/* never honoured — that would turn the verifier into an SSRF probe     */
/* and into an amplifier pointed at other people's RPC providers.       */
/* ------------------------------------------------------------------ */

/** The Primary Network pair is pinned so chain resolution never depends
 *  on catalog contents. */
const PINNED_RPCS: [number, string][] = [
  [43114, "https://api.avax.network/ext/bc/C/rpc"],
  [43113, "https://api.avax-test.network/ext/bc/C/rpc"],
];

interface CatalogChain {
  chainId: string;
  chainName?: string;
  slug?: string;
  rpcUrl?: string;
  isTestnet?: boolean;
  isEvm?: boolean;
}

export interface KnownChain {
  chainId: number;
  name: string;
  slug: string | null;
  rpcUrl: string;
  isTestnet: boolean;
}

let byChainId: Map<number, KnownChain> | null = null;

function catalog(): Map<number, KnownChain> {
  if (byChainId) return byChainId;

  const map = new Map<number, KnownChain>();
  for (const [chainId, rpcUrl] of PINNED_RPCS) {
    map.set(chainId, {
      chainId,
      name: chainId === 43114 ? "Avalanche C-Chain" : "Avalanche Fuji C-Chain",
      slug: "c-chain",
      rpcUrl,
      isTestnet: chainId === 43113,
    });
  }

  for (const chain of l1ChainsData as CatalogChain[]) {
    const id = Number(chain.chainId);
    // Non-EVM entries carry a base58 blockchain id in `chainId`, which
    // Number() turns into NaN — those can never be verified against.
    if (!Number.isInteger(id) || id <= 0) continue;
    if (!chain.rpcUrl) continue;
    if (map.has(id)) continue;
    map.set(id, {
      chainId: id,
      name: chain.chainName ?? `Chain ${id}`,
      slug: chain.slug ?? null,
      rpcUrl: chain.rpcUrl,
      isTestnet: chain.isTestnet ?? false,
    });
  }

  byChainId = map;
  return map;
}

/** The chain we know under this id, or null when it isn't in the catalog
 *  or has no RPC to read deployed bytecode from. */
export function knownChain(chainId: number): KnownChain | null {
  return catalog().get(chainId) ?? null;
}

/** Every chain that can accept a verification, for docs and pickers. */
export function verifiableChains(): KnownChain[] {
  return [...catalog().values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function rpcFor(chainId: number): string | null {
  return catalog().get(chainId)?.rpcUrl ?? null;
}

export async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
  timeoutMs = 5_000,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown };
    return typeof body.result === "string" ? body.result : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* Deployed code is immutable for a given address (barring SELFDESTRUCT +
   CREATE2 redeployment, which we accept being briefly stale about), so a
   short cache keeps a flood of submissions from turning into a flood of
   eth_getCode at somebody else's RPC. */
const CODE_HIT_TTL_MS = 60 * 60 * 1000;
const CODE_MISS_TTL_MS = 60 * 1000;
const MAX_CODE_CACHE = 5_000;
const codeCache = new Map<string, { at: number; code: string | null }>();

/**
 * Runtime bytecode at `address`, or null for an EOA, an unknown chain, or
 * an unreachable RPC. The returned hex is lowercased and 0x-prefixed.
 */
export async function getDeployedCode(chainId: number, address: string): Promise<string | null> {
  const key = `${chainId}:${address.toLowerCase()}`;
  const cached = codeCache.get(key);
  if (cached) {
    const ttl = cached.code ? CODE_HIT_TTL_MS : CODE_MISS_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.code;
  }

  const rpc = rpcFor(chainId);
  if (!rpc) return null;

  const raw = await rpcCall(rpc, "eth_getCode", [address, "latest"]);
  const code = raw && raw !== "0x" && /^0x[0-9a-fA-F]*$/.test(raw) ? raw.toLowerCase() : null;

  if (codeCache.size >= MAX_CODE_CACHE) {
    const oldest = codeCache.keys().next().value;
    if (oldest) codeCache.delete(oldest);
  }
  codeCache.set(key, { at: Date.now(), code });
  return code;
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
