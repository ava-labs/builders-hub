'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { gasPrice, nativeBalance, type ChainInfo } from '@/lib/console-wallets/signer';

export interface FundChain extends ChainInfo {
  chainId: number;
  faucets?: Record<string, string>;
  /** Rough gas the tool expects to use here; priced with the chain's current gas price, plus headroom. */
  gasUnits?: bigint;
  /** Shown instead of a faucet, e.g. for an L1 whose genesis already funds the signer. */
  note?: string;
}

export interface ChainFunds {
  balance: bigint | null;
  /** What the planned work should cost here, when the chain answered a gas price. */
  estimate: bigint | null;
  failed: boolean;
  /** Read, and below the estimate (or empty when there is no estimate). */
  low: boolean;
}

export type FundsState = ReturnType<typeof useChainFunds>;

const EMPTY: ChainFunds = { balance: null, estimate: null, failed: false, low: false };
const REFRESH_MS = 15_000;

/** Native balances of `address` on each chain, refreshed every 15s, with the planned need priced live. */
export function useChainFunds(address: `0x${string}` | null | undefined, chains: FundChain[]) {
  // Callers rebuild the chain list on every render; only these fields decide what to read.
  const key = chains.map((c) => `${c.chainId}:${c.rpcUrl}:${c.gasUnits ?? ''}`).join('|');
  const stable = useMemo(() => chains, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [funds, setFunds] = useState<Record<number, ChainFunds>>({});

  const readOne = useCallback(
    async (chain: FundChain) => {
      if (!address || !chain.rpcUrl) return;
      const info = { ...chain, explorerUrl: null };
      const [balance, price] = await Promise.allSettled([
        nativeBalance(address, chain.chainId, info),
        chain.gasUnits ? gasPrice(chain.chainId, info) : Promise.reject(new Error('no estimate')),
      ]);
      const value = balance.status === 'fulfilled' ? balance.value : null;
      const estimate = price.status === 'fulfilled' && chain.gasUnits ? (chain.gasUnits * price.value * 3n) / 2n : null;
      setFunds((f) => ({
        ...f,
        [chain.chainId]: {
          balance: value,
          estimate,
          failed: balance.status === 'rejected',
          low: value !== null && (estimate !== null ? value < estimate : value === 0n),
        },
      }));
    },
    [address],
  );

  const reload = useCallback(
    (chainId?: number) => {
      for (const c of stable) if (chainId === undefined || c.chainId === chainId) void readOne(c);
    },
    [readOne, stable],
  );

  useEffect(() => {
    setFunds({});
    reload();
    const t = setInterval(reload, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  const readable = stable.filter((c) => c.rpcUrl);
  const of = (chainId: number) => funds[chainId] ?? EMPTY;
  return {
    of,
    reload,
    /** Every readable chain has answered (or failed). */
    checked: readable.every((c) => funds[c.chainId] !== undefined),
    short: readable.filter((c) => of(c.chainId).low),
  };
}
