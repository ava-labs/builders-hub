import "server-only";
import { rpcCall, rpcFor } from "@/lib/verification/chains";
import { findVerified, readStandardJsonInput } from "@/lib/verification/store";

/* ------------------------------------------------------------------ */
/* Contract verification lookups for the EVM explorer.                 */
/*                                                                     */
/* A verified contract gives us its name, ABI, and compiler provenance,*/
/* which the explorer turns into labelled addresses, decoded calldata, */
/* and decoded logs. Two sources answer that question, in order:       */
/*                                                                     */
/*  1. Our own database, written by the verification service in        */
/*     lib/verification. This covers every L1 in the catalog.          */
/*  2. sourcify.dev, the open verification archive. Coverage there is  */
/*     chain-gated: the hosted instance knows the C-Chain (43114) and  */
/*     Fuji (43113) but almost none of the custom L1s, so lookups      */
/*     check the supported-chain list and return null fast for chains  */
/*     Sourcify has never heard of.                                    */
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

async function sourcifyFetch(path: string, timeoutMs = 8_000, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${SOURCIFY_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { accept: "application/json", ...init?.headers },
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
   exists, so hits live a day. A cached miss does NOT stand in for our own
   database — see getVerifiedContract — it only spares upstream Sourcify a
   repeated question about a contract it has already said it doesn't know. */
const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;
const contractCache = new Map<string, { at: number; value: VerifiedContract | null }>();

/** Forget a cached answer for one contract. Called when a verification
 *  lands here, so a contract someone just verified stops being reported
 *  as unverified for the rest of the miss window. */
export function invalidateContract(chainId: number, address: string): void {
  contractCache.delete(`${chainId}:${address.toLowerCase()}`);
  proxyCache.delete(`${chainId}:${address.toLowerCase()}`);
}

/**
 * Look up a contract's verification, ours first and Sourcify second.
 *
 * Contracts verified on Builder Hub live in our own database and cover
 * every L1 in the catalog; Sourcify covers the handful of chains it knows
 * about, which in practice means the Primary Network. Returns null when
 * the contract is unverified everywhere, or when Sourcify is unreachable
 * and we have nothing cached — a flaky upstream should never blank a
 * label that was there a moment ago.
 */
export async function getVerifiedContract(
  chainId: number,
  address: string,
): Promise<VerifiedContract | null> {
  if (!Number.isInteger(chainId) || chainId <= 0) return null;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;

  const key = `${chainId}:${address.toLowerCase()}`;
  const cached = contractCache.get(key);
  // A cached hit is authoritative — verification doesn't get undone.
  if (cached?.value && Date.now() - cached.at < HIT_TTL_MS) return cached.value;

  // Our own database is consulted even when a miss is cached. It is one
  // indexed lookup, and it is the answer that changes the instant someone
  // verifies — including on another instance, which no invalidation of
  // ours could ever reach. Trusting a cached miss here is what would make
  // a contract keep reporting as unverified right after it was verified.
  const own = await findVerified(chainId, address);
  if (own) {
    const value: VerifiedContract = {
      match: own.match,
      name: own.name,
      compilerVersion: own.compilerVersion,
      language: own.language,
      verifiedAt: own.verifiedAt.toISOString(),
      abi: own.abi,
    };
    contractCache.set(key, { at: Date.now(), value });
    return value;
  }

  // Past here we are about to ask Sourcify, which is the only part worth
  // rate-limiting with a remembered miss.
  if (cached && !cached.value && Date.now() - cached.at < MISS_TTL_MS) return null;

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

/**
 * Publish a verification we performed to the public Sourcify archive.
 *
 * Reads already merge both sources, so this changes nothing about what the
 * explorer shows. What it buys is reach: a contract verified here becomes
 * visible in every other tool that reads the archive, and outlives our
 * database. Only the Primary Network benefits — Sourcify will not accept a
 * chain it doesn't list, which is nearly every L1 in the catalog.
 *
 * Deliberately best-effort. It runs after the verification is already
 * recorded, and a rejection upstream (including "already verified", which
 * is a perfectly good outcome) must never turn a successful verification
 * into a failed one.
 */
export async function mirrorToSourcify(input: {
  chainId: number;
  address: string;
  stdJsonInput: unknown;
  compilerVersion: string;
  contractIdentifier: string;
}): Promise<void> {
  if (process.env.SOURCIFY_MIRROR !== "1") return;
  if (!(await isChainSupported(input.chainId))) return;

  try {
    const res = await sourcifyFetch(`/v2/verify/${input.chainId}/${input.address}`, 20_000, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stdJsonInput: input.stdJsonInput,
        compilerVersion: input.compilerVersion,
        contractIdentifier: input.contractIdentifier,
      }),
    });
    if (!res.ok && res.status !== 409) {
      console.warn(`[sourcify] mirror rejected for ${input.address}: HTTP ${res.status}`);
    }
  } catch (error) {
    console.warn(`[sourcify] mirror failed for ${input.address}`, error);
  }
}

export interface ContractSources {
  /** Solidity file path → file contents. */
  sources: Record<string, { content: string }>;
  optimizer: { enabled: boolean; runs: number | null } | null;
  evmVersion: string | null;
  /** Where the sources came from, for attribution in the UI. */
  origin: "builder-hub" | "sourcify";
}

/**
 * Source files behind a verified contract, ours first and Sourcify second
 * — the same precedence as the metadata lookup, so the Contract tab never
 * has to care which verifier produced them.
 *
 * Separate from getVerifiedContract because sources are large and only the
 * Contract tab wants them; the name-and-ABI path is called for every
 * address on a page and must stay small.
 */
export async function getContractSources(
  chainId: number,
  address: string,
): Promise<ContractSources | null> {
  const own = await findVerified(chainId, address);
  if (own?.stdJsonBlobUrl) {
    const input = (await readStandardJsonInput(own.stdJsonBlobUrl)) as {
      sources?: Record<string, { content?: string }>;
      settings?: { optimizer?: { enabled?: boolean; runs?: number }; evmVersion?: string };
    } | null;
    if (input?.sources) {
      const sources: Record<string, { content: string }> = {};
      for (const [file, entry] of Object.entries(input.sources)) {
        if (typeof entry?.content === "string") sources[file] = { content: entry.content };
      }
      return {
        sources,
        optimizer: input.settings?.optimizer
          ? {
              enabled: input.settings.optimizer.enabled === true,
              runs: input.settings.optimizer.runs ?? null,
            }
          : null,
        evmVersion: input.settings?.evmVersion ?? null,
        origin: "builder-hub",
      };
    }
  }

  if (!(await isChainSupported(chainId))) return null;

  try {
    const res = await sourcifyFetch(`/v2/contract/${chainId}/${address}?fields=sources,compilation`);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      sources?: Record<string, { content?: string }>;
      compilation?: {
        compilerSettings?: { optimizer?: { enabled?: boolean; runs?: number }; evmVersion?: string };
      };
    };
    if (!body.sources) return null;

    const sources: Record<string, { content: string }> = {};
    for (const [file, entry] of Object.entries(body.sources)) {
      if (typeof entry?.content === "string") sources[file] = { content: entry.content };
    }
    const optimizer = body.compilation?.compilerSettings?.optimizer;
    return {
      sources,
      optimizer: optimizer ? { enabled: optimizer.enabled === true, runs: optimizer.runs ?? null } : null,
      evmVersion: body.compilation?.compilerSettings?.evmVersion ?? null,
      origin: "sourcify",
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Proxy resolution — a verified proxy carries the proxy's ABI, so     */
/* calls that hit the implementation decode as raw selectors. For      */
/* proxy-suspect addresses we read the EIP-1967 slots (or the EIP-1167 */
/* clone bytecode) on the chain's RPC, look the implementation up on   */
/* Sourcify too, and hand back one merged record.                      */
/* ------------------------------------------------------------------ */

// keccak256("eip1967.proxy.implementation") - 1
const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
// keccak256("eip1967.proxy.beacon") - 1
const EIP1967_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
// keccak256("org.zeppelinos.proxy.implementation") — the pre-1967 slot
// (Circle's FiatTokenProxy/USDC and other early upgradeable contracts)
const ZOS_IMPL_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";
// IBeacon.implementation()
const IMPLEMENTATION_SELECTOR = "0x5c60da1b";
// EIP-1167 minimal proxy runtime bytecode, implementation address between
const EIP1167_RE = /^0x363d3d373d3d3d363d73([a-f0-9]{40})5af43d82803e903d91602b57fd5bf3$/;

/** Last 20 bytes of a 32-byte slot value, or null when the slot is empty. */
function slotToAddress(value: string | null): string | null {
  if (!value || !/^0x[a-f0-9]{1,64}$/i.test(value)) return null;
  const hex = value.slice(2).padStart(64, "0").slice(-40);
  if (/^0+$/.test(hex)) return null;
  return `0x${hex}`;
}

/* Implementation-address cache: upgrades are rare, so hits live an hour;
   "not a proxy" answers live short in case verification/deploys land. */
const PROXY_HIT_TTL_MS = 60 * 60 * 1000;
const PROXY_MISS_TTL_MS = 10 * 60 * 1000;
const proxyCache = new Map<string, { at: number; impl: string | null }>();

function abiLooksProxyish(contract: VerifiedContract): boolean {
  if (contract.name && /proxy/i.test(contract.name)) return true;
  // every delegatecall proxy forwards through a fallback
  return (contract.abi ?? []).some(
    (item) => typeof item === "object" && item !== null && (item as { type?: string }).type === "fallback",
  );
}

/**
 * Implementation address behind `address`, or null when it isn't a proxy
 * (or the chain has no usable RPC). Unverified addresses get an
 * eth_getCode first: EOAs stop there, EIP-1167 clones resolve from
 * bytecode, everything else falls through to the EIP-1967 slots.
 */
async function resolveProxyImplementation(
  chainId: number,
  address: string,
  direct: VerifiedContract | null,
): Promise<string | null> {
  const key = `${chainId}:${address.toLowerCase()}`;
  const cached = proxyCache.get(key);
  if (cached && Date.now() - cached.at < (cached.impl ? PROXY_HIT_TTL_MS : PROXY_MISS_TTL_MS)) {
    return cached.impl;
  }

  const rpc = rpcFor(chainId);
  if (!rpc) return null;

  let impl: string | null = null;
  if (direct === null) {
    const code = await rpcCall(rpc, "eth_getCode", [address, "latest"]);
    if (code && code !== "0x") {
      const clone = code.toLowerCase().match(EIP1167_RE);
      impl = clone
        ? `0x${clone[1]}`
        : slotToAddress(await rpcCall(rpc, "eth_getStorageAt", [address, EIP1967_IMPL_SLOT, "latest"]));
    }
  } else {
    impl = slotToAddress(await rpcCall(rpc, "eth_getStorageAt", [address, EIP1967_IMPL_SLOT, "latest"]));
    if (!impl) {
      impl = slotToAddress(await rpcCall(rpc, "eth_getStorageAt", [address, ZOS_IMPL_SLOT, "latest"]));
    }
    if (!impl) {
      const beacon = slotToAddress(await rpcCall(rpc, "eth_getStorageAt", [address, EIP1967_BEACON_SLOT, "latest"]));
      if (beacon) {
        impl = slotToAddress(await rpcCall(rpc, "eth_call", [{ to: beacon, data: IMPLEMENTATION_SELECTOR }, "latest"]));
      }
    }
  }

  proxyCache.set(key, { at: Date.now(), impl });
  return impl;
}

export interface ResolvedContract extends VerifiedContract {
  /** Present when the address is a proxy whose implementation we resolved. */
  proxy?: { implementation: string; implementationName: string | null };
}

/**
 * getVerifiedContract, but proxy-aware: proxy-suspect addresses get their
 * implementation resolved on-chain and its verification merged in — the
 * proxy's ABI plus the implementation's, under whichever name is the more
 * meaningful of the two. Non-suspects cost no RPC calls.
 */
export async function getVerifiedContractResolvingProxies(
  chainId: number,
  address: string,
): Promise<ResolvedContract | null> {
  const direct = await getVerifiedContract(chainId, address);
  const suspect = direct === null || abiLooksProxyish(direct);
  if (!suspect) return direct;

  const implAddr = await resolveProxyImplementation(chainId, address, direct);
  if (!implAddr) return direct;

  const impl = await getVerifiedContract(chainId, implAddr);
  if (!impl && !direct) return null;

  // "TransparentUpgradeableProxy" labels nothing — prefer the
  // implementation's name whenever the proxy's own is generic or missing
  const name =
    direct?.name && !/proxy/i.test(direct.name) ? direct.name : impl?.name ?? direct?.name ?? null;
  const abi = [...(direct?.abi ?? []), ...(impl?.abi ?? [])];
  const base = direct ?? impl!;
  return {
    match: base.match,
    name,
    compilerVersion: base.compilerVersion,
    language: base.language,
    verifiedAt: base.verifiedAt,
    abi: abi.length ? abi : null,
    proxy: { implementation: implAddr, implementationName: impl?.name ?? null },
  };
}
