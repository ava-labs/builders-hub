import "server-only";
import l1ChainsData from "@/constants/l1-chains.json";

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

/** EVM chain id → public RPC, from the chain catalog. The Primary Network
 *  pair is pinned so proxy resolution never depends on catalog contents. */
let rpcByChainId: Map<number, string> | null = null;
function rpcFor(chainId: number): string | null {
  if (!rpcByChainId) {
    rpcByChainId = new Map([
      [43114, "https://api.avax.network/ext/bc/C/rpc"],
      [43113, "https://api.avax-test.network/ext/bc/C/rpc"],
    ]);
    for (const c of l1ChainsData as { chainId: string; rpcUrl?: string }[]) {
      const id = Number(c.chainId);
      if (Number.isInteger(id) && c.rpcUrl && !rpcByChainId.has(id)) rpcByChainId.set(id, c.rpcUrl);
    }
  }
  return rpcByChainId.get(chainId) ?? null;
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
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
