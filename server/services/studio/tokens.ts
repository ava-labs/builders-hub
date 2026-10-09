import 'server-only';
import { erc20Abi, formatUnits, getAddress, isAddress, type Abi } from 'viem';
import { loadRegistry } from '@/lib/blueprints';
import { fetchErc20Balances } from '@/lib/rwa/glacier/client';
import { publicClient, rpcUrlOf } from './chain';
import { StudioError } from './errors';
import { frontendContext } from './frontend';

/*
 * Tokens for a Studio frontend, answered through the Preview bridge:
 * a token list for a chain (the verified registry, CoinGecko's list where the
 * explorer uses one, and ERC-20s this project deployed), and an address's
 * ERC-20 balances (the Avalanche Data API where it covers the chain, else
 * balanceOf over that list through an RPC the server chose). The frame never
 * names an RPC or an upstream itself.
 */

export interface TokenEntry {
  address: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logoURI: string | null;
  source: 'registry' | 'coingecko' | 'project';
}

const COINGECKO_LISTS: Record<number, string> = { 43114: 'https://tokens.coingecko.com/avalanche/all.json' };
const MAX_BALANCE_CANDIDATES = 60;

const isErc20 = (abi: Abi) => {
  const names = new Set(abi.filter((i) => i.type === 'function').map((i) => (i as { name: string }).name));
  return ['balanceOf', 'transfer', 'decimals', 'symbol'].every((n) => names.has(n));
};

async function coingeckoList(chainId: number): Promise<TokenEntry[]> {
  const url = COINGECKO_LISTS[chainId];
  if (!url) return [];
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'builders-hub-studio/1.0' },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return [];
    const list = (await res.json()) as {
      tokens?: { chainId: number; address: string; symbol: string; name: string; decimals: number; logoURI?: string }[];
    };
    return (list.tokens ?? [])
      .filter((t) => t.chainId === chainId && isAddress(t.address))
      .map((t) => ({
        address: getAddress(t.address),
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI ?? null,
        source: 'coingecko' as const,
      }));
  } catch {
    return [];
  }
}

/** The contracts and chains token data is answered for: a project's live deployments, or a published site's snapshot. */
export interface TokenScope {
  contracts: { name: string; address: string; chainId: number | null; abi: Abi }[];
  chains: Record<number, { rpcUrl: string | null }>;
}

const projectScope = (userId: string, projectId: string): Promise<TokenScope> =>
  frontendContext(userId, projectId, { withFiles: false });

export async function tokenList(userId: string, projectId: string, chainId: number): Promise<TokenEntry[]> {
  return tokenListIn(await projectScope(userId, projectId), chainId);
}

export async function tokenBalances(userId: string, projectId: string, chainId: number, owner: string) {
  return tokenBalancesIn(await projectScope(userId, projectId), chainId, owner);
}

export async function tokenListIn(scope: TokenScope, chainId: number): Promise<TokenEntry[]> {
  const registry = loadRegistry();
  const fromRegistry: TokenEntry[] = Object.values(registry.networks)
    .filter((n) => n.evmChainId === chainId)
    .flatMap((n) =>
      Object.entries((n.tokens ?? {}) as Record<string, { address?: string; decimals?: number }>)
        .filter(([, t]) => t.address && isAddress(t.address))
        .map(([symbol, t]) => ({
          address: getAddress(t.address!),
          symbol,
          name: symbol,
          decimals: t.decimals ?? null,
          logoURI: null,
          source: 'registry' as const,
        })),
    );
  const fromProject: TokenEntry[] = scope.contracts
    .filter((c) => c.chainId === chainId && isErc20(c.abi))
    .map((c) => ({
      address: getAddress(c.address),
      symbol: null,
      name: c.name,
      decimals: null,
      logoURI: null,
      source: 'project' as const,
    }));

  const seen = new Set<string>();
  return [...fromProject, ...fromRegistry, ...(await coingeckoList(chainId))].filter((t) => {
    const key = t.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** An RPC the server trusts for this chain: the registry's, or one the server itself recorded for the scope. */
function rpcFor(scope: TokenScope, chainId: number): string | null {
  const registry = loadRegistry();
  const key = Object.entries(registry.networks).find(([, n]) => n.evmChainId === chainId)?.[0];
  if (key) {
    try {
      return rpcUrlOf(key, undefined);
    } catch {
      /* not a registry chain with a fixed RPC */
    }
  }
  return scope.chains[chainId]?.rpcUrl ?? null;
}

export interface TokenBalance {
  address: string;
  symbol: string | null;
  name: string | null;
  decimals: number;
  balance: string;
  formatted: string;
  logoURI: string | null;
}

export async function tokenBalancesIn(
  scope: TokenScope,
  chainId: number,
  owner: string,
): Promise<{ source: 'data-api' | 'rpc'; balances: TokenBalance[] }> {
  if (!isAddress(owner)) throw new StudioError(400, 'Pass an EVM address');
  const list = await tokenListIn(scope, chainId);
  const meta = new Map(list.map((t) => [t.address.toLowerCase(), t]));

  try {
    const res = await fetchErc20Balances(String(chainId), owner);
    const items = (res.erc20TokenBalances ?? []) as {
      address: string;
      balance: string;
      decimals: number;
      name?: string;
      symbol?: string;
      logoUri?: string;
    }[];
    const project = list.filter((t) => t.source === 'project');
    const balances = items
      .filter((b) => BigInt(b.balance || '0') > 0n)
      .map((b) => {
        const m = meta.get(b.address.toLowerCase());
        return {
          address: getAddress(b.address),
          symbol: b.symbol ?? m?.symbol ?? null,
          name: b.name ?? m?.name ?? null,
          decimals: b.decimals,
          balance: b.balance,
          formatted: formatUnits(BigInt(b.balance), b.decimals),
          logoURI: b.logoUri ?? m?.logoURI ?? null,
        };
      });
    // The Data API may not have indexed a token this project just deployed.
    if (project.every((p) => balances.some((b) => b.address.toLowerCase() === p.address.toLowerCase()))) {
      return { source: 'data-api', balances };
    }
  } catch {
    /* chain not covered, or the Data API is unavailable: fall back to the RPC */
  }

  const rpc = rpcFor(scope, chainId);
  if (!rpc) throw new StudioError(400, `Studio has no RPC for chain ${chainId}`);
  const client = publicClient(rpc);
  const account = getAddress(owner);
  const candidates = list.slice(0, MAX_BALANCE_CANDIDATES);
  const results = await Promise.all(
    candidates.map(async (t) => {
      const token = t.address as `0x${string}`;
      try {
        const balance = await client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        });
        if (balance === 0n) return null;
        const [decimals, symbol] = await Promise.all([
          t.decimals ??
            client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18),
          t.symbol ?? client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }).catch(() => null),
        ]);
        return {
          address: t.address,
          symbol,
          name: t.name,
          decimals: Number(decimals),
          balance: balance.toString(),
          formatted: formatUnits(balance, Number(decimals)),
          logoURI: t.logoURI,
        };
      } catch {
        return null;
      }
    }),
  );
  return { source: 'rpc', balances: results.filter((r): r is TokenBalance => r !== null) };
}
