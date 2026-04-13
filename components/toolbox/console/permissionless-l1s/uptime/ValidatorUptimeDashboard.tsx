'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { hexToBytes } from 'viem';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { useUptimeProof } from '@/components/toolbox/hooks/useUptimeProof';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/validator-manager/packWarp';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { type StakingType } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { cb58ToHex } from '@/components/toolbox/console/utilities/format-converter/FormatConverter';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import { Check, AlertCircle, ArrowUpCircle, Server, Shield, ShieldOff } from 'lucide-react';
import Link from 'next/link';

interface ValidatorInfo {
  validationID: string;
  nodeID: string;
  weight: string;
  uptimeSeconds: number;
  storedUptimeSeconds: number;
  startTimestamp?: number;
  connected?: boolean;
  isPoS: boolean;
}

interface SubmitState {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

function formatUptime(seconds: number): string {
  if (seconds === 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function uptimePercentage(uptimeSeconds: number, startTimestamp?: number): string | null {
  if (!startTimestamp) return null;
  const elapsed = Math.floor(Date.now() / 1000) - startTimestamp;
  if (elapsed <= 0) return null;
  const pct = Math.min(100, (uptimeSeconds / elapsed) * 100);
  return pct.toFixed(1);
}

function uptimeBarColor(pct: number): string {
  if (pct >= 95) return 'bg-green-500';
  if (pct >= 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

function uptimeTextColor(pct: number): string {
  if (pct >= 95) return 'text-green-600 dark:text-green-400';
  if (pct >= 80) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

interface ValidatorUptimeDashboardProps {
  stakingManagerAddress: string;
  stakingType: StakingType;
  subnetIdL1: string;
  blockchainId: string;
  uptimeBlockchainID: string;
  nodeUrl: string;
  onNodeUrlChange: (url: string) => void;
}

export default function ValidatorUptimeDashboard({
  stakingManagerAddress,
  stakingType,
  subnetIdL1: _subnetIdL1,
  blockchainId,
  uptimeBlockchainID,
  nodeUrl,
  onNodeUrlChange,
}: ValidatorUptimeDashboardProps) {
  const viemChain = useViemChainStore();
  const chainPublicClient = useChainPublicClient();
  const { notify } = useConsoleNotifications();
  const { createAndSignUptimeProof } = useUptimeProof();

  const nativeStakingManager = useNativeTokenStakingManager(stakingType === 'native' ? stakingManagerAddress : null);
  const erc20StakingManager = useERC20TokenStakingManager(stakingType === 'erc20' ? stakingManagerAddress : null);

  const [validators, setValidators] = useState<ValidatorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitStates, setSubmitStates] = useState<Record<string, SubmitState>>({});
  const [needsNodeUrl, setNeedsNodeUrl] = useState(!!nodeUrl);

  const defaultRpcUrl = viemChain?.rpcUrls?.default?.http[0] || '';

  // Accept either a base node URL (http://node:9650) or a full RPC URL
  // (http://node:9650/ext/bc/<id>/rpc). Detect by checking for /ext/bc/.
  const rpcUrl = (() => {
    if (!nodeUrl) return defaultRpcUrl;
    const trimmed = nodeUrl.replace(/\/$/, '');
    if (trimmed.includes('/ext/bc/')) return trimmed.endsWith('/rpc') ? trimmed : `${trimmed}/rpc`;
    return `${trimmed}/ext/bc/${blockchainId}/rpc`;
  })();

  const fetchValidators = useCallback(async () => {
    if (!rpcUrl) return;
    setIsLoading(true);
    setFetchError(null);

    try {
      const validatorsRpcUrl = rpcUrl.replace('/rpc', '/validators');
      const response = await fetch(validatorsRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'validators.getCurrentValidators',
          params: { nodeIDs: [] },
          id: 1,
        }),
      });

      if (!response.ok) throw new Error(`${response.status}`);

      const data = await response.json();
      if (!data?.result?.validators) throw new Error('No validators found');

      const parsed: ValidatorInfo[] = data.result.validators.map((v: any) => {
        let hexId = v.validationID || '';
        if (hexId && !hexId.startsWith('0x')) {
          try {
            hexId = '0x' + cb58ToHex(hexId);
          } catch {
            /* keep original */
          }
        }
        return {
          validationID: hexId.toLowerCase(),
          nodeID: v.nodeID || '',
          weight: v.weight?.toString() || '0',
          uptimeSeconds: Number(v.uptimeSeconds || 0),
          startTimestamp: v.startTimestamp ? Number(v.startTimestamp) : undefined,
          connected: v.connected,
          isPoS: false,
          storedUptimeSeconds: 0, // resolved by PoS detection effect
        };
      });

      parsed.sort((a, b) => b.uptimeSeconds - a.uptimeSeconds);
      setValidators(parsed);
      setNeedsNodeUrl(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('404') || msg.includes('Failed to fetch')) {
        setNeedsNodeUrl(true);
      }
      setFetchError(msg);
      setValidators([]);
    } finally {
      setIsLoading(false);
    }
  }, [rpcUrl]);

  useEffect(() => {
    fetchValidators();
  }, [fetchValidators]);

  // Detect PoS status + stored uptime from contract.
  // Uses validatorIds as a stable key so it only re-fetches when the validator
  // list changes, but ALSO re-runs when chainPublicClient or stakingManagerAddress
  // become available (they load async after validators on page reload).
  const validatorIds = validators.map((v) => v.validationID).join(',');

  useEffect(() => {
    if (!chainPublicClient || !stakingManagerAddress || !validatorIds) return;

    const ids = validatorIds.split(',');
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    let cancelled = false;

    const detectPoS = async () => {
      const updates = await Promise.all(
        ids.map(async (id) => {
          try {
            const result = await chainPublicClient.readContract({
              address: stakingManagerAddress as `0x${string}`,
              abi: NativeTokenStakingManager.abi,
              functionName: 'getStakingValidator',
              args: [id as `0x${string}`],
            });
            const info = result as any;
            const owner = String(info?.owner ?? info?.[0] ?? '');
            const storedUptime = Number(info?.uptimeSeconds ?? info?.[3] ?? 0);
            return { id, isPoS: !!owner && owner !== ZERO_ADDRESS, storedUptime };
          } catch {
            return { id, isPoS: false, storedUptime: 0 };
          }
        }),
      );

      if (cancelled) return;

      const dataMap = new Map(updates.map((u) => [u.id, u]));
      setValidators((prev) =>
        prev.map((v) => {
          const data = dataMap.get(v.validationID);
          if (!data) return v;
          return { ...v, isPoS: data.isPoS, storedUptimeSeconds: data.storedUptime };
        }),
      );
    };

    detectPoS();
    return () => {
      cancelled = true;
    };
  }, [chainPublicClient, stakingManagerAddress, validatorIds]);

  const handleSubmitProof = async (validator: ValidatorInfo) => {
    const id = validator.validationID;
    setSubmitStates((prev) => ({ ...prev, [id]: { status: 'loading' } }));

    try {
      // Step 1: Aggregate uptime proof signatures
      const proofPromise = createAndSignUptimeProof(validator.validationID, rpcUrl, uptimeBlockchainID);
      notify({ type: 'local', name: 'Aggregate Uptime Proof Signatures' }, proofPromise);
      const proof = await proofPromise;

      const signedWarpBytes = hexToBytes(`0x${proof.signedWarpMessage}`);
      const accessList = packWarpIntoAccessList(signedWarpBytes);

      await (stakingType === 'native'
        ? nativeStakingManager.submitUptimeProof(validator.validationID, 0, accessList)
        : erc20StakingManager.submitUptimeProof(validator.validationID, 0, accessList));

      setSubmitStates((prev) => ({
        ...prev,
        [id]: { status: 'success', message: `${formatUptime(proof.uptimeSeconds)} locked in` },
      }));

      // Update stored uptime in the validator list
      setValidators((prev) =>
        prev.map((v) => (v.validationID === id ? { ...v, storedUptimeSeconds: proof.uptimeSeconds } : v)),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitStates((prev) => ({ ...prev, [id]: { status: 'error', message: msg } }));
    }
  };

  // ── Node URL required ──
  if (needsNodeUrl) {
    return (
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Server className="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Connect to L1 Node</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                The validators API is not available at the default RPC. Enter your AvalancheGo node URL.
              </p>
            </div>
          </div>

          <Input
            label="L1 RPC URL"
            value={nodeUrl}
            onChange={onNodeUrlChange}
            placeholder="https://node:9650/ext/bc/<blockchainId>/rpc"
            helperText={
              <>
                Full RPC URL or base node URL of your L1.{' '}
                <Link
                  href="/docs/rpcs/subnet-evm#validatorsgetcurrentvalidators"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Docs
                </Link>
              </>
            }
          />

          {fetchError && !fetchError.includes('404') && <Alert variant="error">{fetchError}</Alert>}

          <Button
            variant="primary"
            onClick={() => {
              setFetchError(null);
              fetchValidators();
            }}
            disabled={!nodeUrl.trim() || isLoading}
            loading={isLoading}
          >
            Connect & Fetch Validators
          </Button>
        </div>
      </div>
    );
  }

  // ── Validator list ──
  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Validators{validators.length > 0 && <span className="text-zinc-400 ml-1.5">({validators.length})</span>}
        </h3>
        <button
          type="button"
          onClick={fetchValidators}
          disabled={isLoading}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Content */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
        {fetchError && (
          <div className="px-5 py-3">
            <Alert variant="error">{fetchError}</Alert>
          </div>
        )}

        {validators.length === 0 && !isLoading && !fetchError && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-zinc-400">No validators found for this L1.</p>
          </div>
        )}

        {validators.map((v) => {
          const pct = uptimePercentage(v.uptimeSeconds, v.startTimestamp);
          const pctNum = pct ? parseFloat(pct) : null;
          const state = submitStates[v.validationID] || { status: 'idle' };

          return (
            <div key={v.validationID} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-4">
                {/* Left: info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.connected !== false ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                    />
                    <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate block">
                      {v.nodeID}
                    </code>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        v.isPoS
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {v.isPoS ? <Shield className="w-2.5 h-2.5" /> : <ShieldOff className="w-2.5 h-2.5" />}
                      {v.isPoS ? 'PoS' : 'PoA'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    {/* Uptime bar + percentage */}
                    <div className="flex items-center gap-1.5">
                      <span>Uptime</span>
                      <span
                        className={`font-medium font-mono ${pctNum !== null ? uptimeTextColor(pctNum) : 'text-zinc-700 dark:text-zinc-300'}`}
                      >
                        {formatUptime(v.uptimeSeconds)}
                      </span>
                      {pctNum !== null && (
                        <>
                          <div className="w-12 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${uptimeBarColor(pctNum)}`}
                              style={{ width: `${Math.min(100, pctNum)}%` }}
                            />
                          </div>
                          <span className={`font-mono ${uptimeTextColor(pctNum)}`}>{pct}%</span>
                        </>
                      )}
                    </div>
                    <span className="text-zinc-300 dark:text-zinc-700">|</span>
                    <span>
                      Weight <span className="font-mono text-zinc-700 dark:text-zinc-300">{v.weight}</span>
                    </span>
                    {v.isPoS && (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        <span>
                          On-chain{' '}
                          <span
                            className={`font-mono ${v.storedUptimeSeconds > 0 ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'}`}
                          >
                            {v.storedUptimeSeconds > 0 ? formatUptime(v.storedUptimeSeconds) : '0s'}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: action */}
                <div className="shrink-0">
                  {!v.isPoS ? (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">No stake</span>
                  ) : state.status === 'success' ? (
                    <button
                      type="button"
                      onClick={() => handleSubmitProof(v)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                    >
                      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                      <span className="text-[11px] font-medium text-green-700 dark:text-green-300">
                        {state.message}
                      </span>
                    </button>
                  ) : state.status === 'error' ? (
                    <button
                      type="button"
                      onClick={() => handleSubmitProof(v)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <AlertCircle className="w-3 h-3 text-red-500" />
                      <span className="text-[11px] font-medium text-red-700 dark:text-red-300">Retry</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSubmitProof(v)}
                      disabled={state.status === 'loading'}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      {state.status === 'loading' ? (
                        <span className="text-[11px] font-medium">Signing...</span>
                      ) : (
                        <>
                          <ArrowUpCircle className="w-3 h-3" />
                          <span className="text-[11px] font-medium">Submit Proof</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Submitting uptime proofs locks in your validator&apos;s current uptime on-chain. Higher stored uptime = higher
          staking rewards when the validator exits.
        </p>
      </div>
    </div>
  );
}
