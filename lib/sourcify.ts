import "server-only";

/* ------------------------------------------------------------------ */
/* Sourcify — contract verification lookups for the EVM explorer.      */
/*                                                                     */
/* sourcify.dev is the open verification archive: a verified contract  */
/* gives us its name, ABI, and compiler provenance, which the explorer */
/* turns into labelled addresses, decoded calldata, and decoded logs.  */
/* Coverage is chain-gated: the hosted instance knows the C-Chain      */
/* (43114) and Fuji (43113) but almost none of the custom L1s, so      */
/* every lookup first checks the supported-chain list and returns      */
/* null fast for chains Sourcify has never heard of.                   */
/* ------------------------------------------------------------------ */

const SOURCIFY_BASE = "https://sourcify.dev/server";

/** Fallback when the /chains list can't be fetched — the two chains we
 *  know the hosted instance supports. */
const KNOWN_SUPPORTED = new Set([43114, 43113]);

export interface VerifiedContract {
  /** "exact_match" = bytecode + metadata hash both match; "match" = runtime bytecode matches. */
  match: "match" | "exact_match";
  name: string | null;
  compilerVersion: string | null;
  language: string | null;
  verifiedAt: string | null;
  abi: unknown[] | null;
}

async function sourcifyFetch(path: string, timeoutMs = 8_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${SOURCIFY_BASE}${path}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

/* Supported-chain gate, refreshed daily. On fetch failure the last-good
   set stands; with no last-good set the known pair keeps C-Chain working. */
let supportedChains: Set<number> | null = null;
let supportedFetchedAt = 0;
const SUPPORTED_TTL_MS = 24 * 60 * 60 * 1000;

async function isChainSupported(chainId: number): Promise<boolean> {
  const now = Date.now();
  if (!supportedChains || now - supportedFetchedAt > SUPPORTED_TTL_MS) {
    try {
      const res = await sourcifyFetch("/chains");
      if (res.ok) {
        const chains = (await res.json()) as { chainId: number; supported?: boolean }[];
        supportedChains = new Set(chains.filter((c) => c.supported !== false).map((c) => c.chainId));
        supportedFetchedAt = now;
      }
    } catch {
      /* keep the stale set (or fall through to the known pair) */
    }
  }
  return (supportedChains ?? KNOWN_SUPPORTED).has(chainId);
}

/* Per-contract cache. Verification is effectively immutable once it
   exists, so hits live a day; misses live short — an unverified contract
   can be verified at any moment and should show up soon after. */
const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;
const contractCache = new Map<string, { at: number; value: VerifiedContract | null }>();

/**
 * Look up a contract's verification on Sourcify.
 * Returns the verified contract, or null when the contract is unverified,
 * the chain is unsupported, or Sourcify is unreachable (stale cache stands
 * where one exists — a flaky upstream should never blank a label).
 */
export async function getVerifiedContract(
  chainId: number,
  address: string,
): Promise<VerifiedContract | null> {
  if (!Number.isInteger(chainId) || chainId <= 0) return null;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;

  const key = `${chainId}:${address.toLowerCase()}`;
  const cached = contractCache.get(key);
  if (cached) {
    const ttl = cached.value ? HIT_TTL_MS : MISS_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.value;
  }

  if (!(await isChainSupported(chainId))) return null;

  try {
    const res = await sourcifyFetch(`/v2/contract/${chainId}/${address}?fields=abi,compilation`);
    if (res.status === 404) {
      contractCache.set(key, { at: Date.now(), value: null });
      return null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      match: "match" | "exact_match";
      verifiedAt?: string;
      abi?: unknown[];
      compilation?: { name?: string; compilerVersion?: string; language?: string };
    };
    const value: VerifiedContract = {
      match: body.match,
      name: body.compilation?.name ?? null,
      compilerVersion: body.compilation?.compilerVersion ?? null,
      language: body.compilation?.language ?? null,
      verifiedAt: body.verifiedAt ?? null,
      abi: body.abi ?? null,
    };
    contractCache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    // upstream down: last-good beats nothing, even if expired
    return cached?.value ?? null;
  }
}

/** The human-facing Sourcify page for a verified contract. */
export function sourcifyRepoUrl(chainId: number, address: string): string {
  return `https://repo.sourcify.dev/${chainId}/${address}`;
}
