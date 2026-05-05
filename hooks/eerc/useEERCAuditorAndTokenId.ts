'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import type { BJPoint } from '@/lib/eerc/crypto/babyjub';
import type { EERCDeployment, Hex } from '@/lib/eerc/types';

/**
 * Small shared hook: reads the two pieces of on-chain state every
 * transfer/withdraw/burn flow needs — the auditor's public key (so we can
 * encrypt an audit PCT to it) and, for converter mode, the tokenId
 * corresponding to the source ERC20.
 */
export function useEERCAuditorAndTokenId(deployment: EERCDeployment | undefined, tokenAddress?: Hex) {
  const publicClient = usePublicClient();
  const [auditorPublicKey, setAuditorPublicKey] = useState<BJPoint | null>(null);
  const [auditorAddress, setAuditorAddress] = useState<Hex | null>(null);
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicClient || !deployment) return;
    setIsLoading(true);
    setError(null);
    try {
      const [pkRaw, addr] = await Promise.all([
        publicClient.readContract({
          address: deployment.encryptedERC,
          abi: EncryptedERCArtifact.abi,
          functionName: 'auditorPublicKey',
          args: [],
        }),
        publicClient.readContract({
          address: deployment.encryptedERC,
          abi: EncryptedERCArtifact.abi,
          functionName: 'auditor',
          args: [],
        }) as Promise<Hex>,
      ]);

      // The ABI declares `auditorPublicKey()` with named outputs `x` and
      // `y`, so viem returns it as `{ x: bigint, y: bigint }`, not a
      // positional tuple. Earlier versions accessed `pkArr[0]` / `pkArr[1]`
      // which silently gave `undefined`, then bombed deep inside the
      // withdraw/transfer prover with "Cannot convert undefined to a
      // BigInt". Read by name with a tuple fallback so this never bites
      // again across ABI rebuilds.
      const pkObj = pkRaw as
        | { x: bigint; y: bigint }
        | readonly [bigint, bigint]
        | undefined;
      const x: bigint | undefined =
        (pkObj && (pkObj as { x?: bigint }).x) ??
        (Array.isArray(pkObj) ? (pkObj as readonly bigint[])[0] : undefined);
      const y: bigint | undefined =
        (pkObj && (pkObj as { y?: bigint }).y) ??
        (Array.isArray(pkObj) ? (pkObj as readonly bigint[])[1] : undefined);

      if (x === undefined || y === undefined) {
        setAuditorPublicKey(null);
        setError('Could not read auditor public key from contract');
      } else if (x === 0n && y === 0n) {
        // Auditor not yet set — tools depending on this should surface a CTA.
        setAuditorPublicKey(null);
      } else {
        setAuditorPublicKey([x, y]);
      }
      setAuditorAddress(addr);

      if (tokenAddress) {
        const id = (await publicClient.readContract({
          address: deployment.encryptedERC,
          abi: EncryptedERCArtifact.abi,
          functionName: 'tokenIds',
          args: [tokenAddress],
        })) as bigint;
        setTokenId(id);
      } else {
        // Standalone mode uses tokenId = 0.
        setTokenId(0n);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read auditor / tokenId');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, deployment, tokenAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    auditorPublicKey,
    auditorAddress,
    tokenId,
    isAuditorSet: auditorPublicKey !== null,
    error,
    isLoading,
    refresh,
  };
}
