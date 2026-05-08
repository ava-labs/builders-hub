'use client';

import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeABI from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import ERC20TokenRemoteABI from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import type { TokenKind } from './types';

export interface TokenSnapshot {
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  bridged: bigint; // home: getTransferredBalance(remoteChainID); remote: same as totalSupply
  isLoading: boolean;
  error: string | null;
}

const EMPTY_SNAPSHOT: TokenSnapshot = {
  symbol: '—',
  decimals: 18,
  totalSupply: 0n,
  bridged: 0n,
  isLoading: false,
  error: null,
};

/**
 * Reads token snapshot data for the home side of a bridge:
 *   - symbol/decimals from the underlying ERC20/native token
 *   - totalSupply from the underlying token
 *   - bridged from `getTransferredBalance(remoteBlockchainID)` on the home
 *
 * Native homes hold the native gas token, so totalSupply isn't a useful
 * metric there — we surface the home contract's own balance instead.
 */
export function useHomeTokenSnapshot(args: {
  homeChain?: L1ListItem;
  homeAddress: string | null;
  homeKind: TokenKind;
  remoteChainId?: string;
}): TokenSnapshot {
  const { homeChain, homeAddress, homeKind, remoteChainId } = args;
  const [snapshot, setSnapshot] = useState<TokenSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    if (!homeChain?.rpcUrl || !homeAddress) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    let cancelled = false;
    setSnapshot((s) => ({ ...s, isLoading: true, error: null }));
    const client = makePublicClientForChain(homeChain.rpcUrl);
    if (!client) {
      setSnapshot({ ...EMPTY_SNAPSHOT, error: 'Could not create RPC client' });
      return;
    }

    (async () => {
      try {
        const homeAbi = (homeKind === 'erc20' ? ERC20TokenHomeABI.abi : NativeTokenHomeABI.abi) as any;
        const tokenAddress = (await client.readContract({
          address: homeAddress as `0x${string}`,
          abi: homeAbi,
          functionName: 'getTokenAddress',
        })) as `0x${string}`;

        // ERC20: read symbol/decimals/totalSupply from the underlying token.
        // Native: the wrapped-native helper exposes these too, so the same
        // path works for both — but we still use the kind-specific ABI for
        // safety on the home itself.
        const [symbol, decimals, totalSupply] = await Promise.all([
          client.readContract({ address: tokenAddress, abi: ExampleERC20.abi, functionName: 'symbol' }),
          client.readContract({ address: tokenAddress, abi: ExampleERC20.abi, functionName: 'decimals' }),
          client.readContract({ address: tokenAddress, abi: ExampleERC20.abi, functionName: 'totalSupply' }),
        ]);

        // bridged = getTransferredBalance(remoteBlockchainIDHex)
        let bridged = 0n;
        if (remoteChainId) {
          try {
            const remoteHex = cb58ToHex(remoteChainId);
            bridged = (await client.readContract({
              address: homeAddress as `0x${string}`,
              abi: homeAbi,
              functionName: 'getTransferredBalance',
              args: [remoteHex],
            })) as bigint;
          } catch {
            /* getTransferredBalance may revert if remote not registered yet */
          }
        }

        if (cancelled) return;
        setSnapshot({
          symbol: String(symbol),
          decimals: Number(decimals),
          totalSupply: totalSupply as bigint,
          bridged,
          isLoading: false,
          error: null,
        });
      } catch (e: any) {
        if (cancelled) return;
        setSnapshot({
          ...EMPTY_SNAPSHOT,
          error: `Read failed: ${e?.shortMessage ?? e?.message ?? 'unknown'}`,
          isLoading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [homeChain?.rpcUrl, homeAddress, homeKind, remoteChainId]);

  return snapshot;
}

/**
 * Reads remote-side token snapshot:
 *   - symbol/decimals/totalSupply from the remote contract (it IS the
 *     wrapped token in the ERC-20 case; native remote exposes the same).
 *   - bridged is symmetrical to totalSupply on the remote (everything
 *     minted there came over the bridge).
 */
export function useRemoteTokenSnapshot(args: {
  remoteChain?: L1ListItem;
  remoteAddress: string | null;
}): TokenSnapshot {
  const { remoteChain, remoteAddress } = args;
  const [snapshot, setSnapshot] = useState<TokenSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    if (!remoteChain?.rpcUrl || !remoteAddress) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    let cancelled = false;
    setSnapshot((s) => ({ ...s, isLoading: true, error: null }));
    const client = makePublicClientForChain(remoteChain.rpcUrl);
    if (!client) {
      setSnapshot({ ...EMPTY_SNAPSHOT, error: 'Could not create RPC client' });
      return;
    }

    (async () => {
      try {
        const [symbol, decimals, totalSupply] = await Promise.all([
          client.readContract({
            address: remoteAddress as `0x${string}`,
            abi: ERC20TokenRemoteABI.abi,
            functionName: 'symbol',
          }),
          client.readContract({
            address: remoteAddress as `0x${string}`,
            abi: ERC20TokenRemoteABI.abi,
            functionName: 'decimals',
          }),
          client.readContract({
            address: remoteAddress as `0x${string}`,
            abi: ERC20TokenRemoteABI.abi,
            functionName: 'totalSupply',
          }),
        ]);

        if (cancelled) return;
        setSnapshot({
          symbol: String(symbol),
          decimals: Number(decimals),
          totalSupply: totalSupply as bigint,
          bridged: totalSupply as bigint,
          isLoading: false,
          error: null,
        });
      } catch (e: any) {
        if (cancelled) return;
        setSnapshot({
          ...EMPTY_SNAPSHOT,
          error: `Read failed: ${e?.shortMessage ?? e?.message ?? 'unknown'}`,
          isLoading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [remoteChain?.rpcUrl, remoteAddress]);

  return snapshot;
}

export function formatTokenAmount(value: bigint, decimals: number, maxFractionDigits = 4): string {
  if (value === 0n) return '0';
  const formatted = formatUnits(value, decimals);
  const num = Number(formatted);
  if (!isFinite(num)) return formatted;
  // Compact display for large numbers
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num < 0.0001 && num > 0) return '<0.0001';
  return num.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}
