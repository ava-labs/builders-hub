'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { hexToBytes } from 'viem';
import { ChevronDown, Shield, ShieldOff, Loader2 } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import { LockedContent } from '@/components/toolbox/components/LockedContent';
import { ValidatorPreflightChecklist } from '@/components/toolbox/components/ValidatorPreflightChecklist';
import { useValidatorPreflight } from '@/components/toolbox/hooks/useValidatorPreflight';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { useUptimeProof, probeValidatorUptime } from '@/components/toolbox/hooks/useUptimeProof';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/validator-manager/packWarp';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface PosInitiateRemovalProps {
  validationID: string;
  stakingManagerAddress: string;
  validatorManagerAddress: string;
  rpcUrl: string;
  uptimeBlockchainID: string;
  tokenType: TokenType;
  onSuccess: (data: { txHash: string; forceMode: boolean }) => void;
  onError: (message: string) => void;
}

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'uptime-available'; uptimeSeconds: bigint }
  | { kind: 'uptime-unavailable'; reason: 'endpoint' | 'not-found' | 'rewards-ineligible' };

/**
 * Unified PoS removal step. Probes the validator's uptime endpoint upfront and
 * picks the right contract path automatically:
 *
 *   uptime-available    → initiateValidatorRemoval(includeUptimeProof=true)
 *                         (preserves staking rewards)
 *   uptime-unavailable  → forceInitiateValidatorRemoval(false, 0)
 *                         (forfeits rewards, but the only path that works when
 *                          the L1's /validators endpoint is unreachable or the
 *                          contract has already flagged the validator as
 *                          rewards-ineligible)
 *
 * The user sees one CTA at a time, with a banner explaining which path will run
 * and why. A collapsible "Custom Validators API URL" affordance lets them retry
 * the probe against a non-default node URL before falling back to force mode.
 */
export function PosInitiateRemoval({
  validationID,
  stakingManagerAddress,
  validatorManagerAddress,
  rpcUrl,
  uptimeBlockchainID,
  tokenType,
  onSuccess,
  onError,
}: PosInitiateRemovalProps) {
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const { notify } = useConsoleNotifications();

  const nativeStakingManager = useNativeTokenStakingManager(tokenType === 'native' ? stakingManagerAddress : null);
  const erc20StakingManager = useERC20TokenStakingManager(tokenType === 'erc20' ? stakingManagerAddress : null);
  const { createAndSignUptimeProof, isLoading: isSigningUptime } = useUptimeProof();

  const preflight = useValidatorPreflight({
    validationID: validationID || undefined,
    stakingManagerAddress,
    validatorManagerAddress,
    walletAddress: walletEVMAddress || undefined,
    stakingManagerType: tokenType,
  });

  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' });
  const [customValidatorsUrl, setCustomValidatorsUrl] = useState('');
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setErrorState] = useState<string | null>(null);

  // Re-probe whenever the actual inputs change. Drive directly from the primitive
  // string deps rather than from a useCallback identity — that avoids a render
  // loop if the probe function reference is ever unstable (it isn't anymore,
  // but the effect is the safer place to encode the invariant).
  //
  // The cancelled flag handles the case where the user switches validators
  // mid-probe — the stale fetch resolves last and would otherwise overwrite the
  // new validator's state.
  useEffect(() => {
    if (!validationID || !rpcUrl) {
      setProbe({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setProbe({ kind: 'probing' });
    probeValidatorUptime(validationID, rpcUrl, customValidatorsUrl || undefined).then((uptime) => {
      if (cancelled) return;
      if (uptime === null) {
        setProbe({ kind: 'uptime-unavailable', reason: 'endpoint' });
      } else {
        setProbe({ kind: 'uptime-available', uptimeSeconds: uptime });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [validationID, rpcUrl, customValidatorsUrl]);

  // Retry button — read latest customValidatorsUrl from state but doesn't need
  // to participate in the effect's dep chain.
  const runProbe = useCallback(() => {
    if (!validationID || !rpcUrl) {
      setProbe({ kind: 'idle' });
      return;
    }
    setProbe({ kind: 'probing' });
    void probeValidatorUptime(validationID, rpcUrl, customValidatorsUrl || undefined).then((uptime) => {
      if (uptime === null) {
        setProbe({ kind: 'uptime-unavailable', reason: 'endpoint' });
      } else {
        setProbe({ kind: 'uptime-available', uptimeSeconds: uptime });
      }
    });
  }, [validationID, rpcUrl, customValidatorsUrl]);

  const isLocked =
    preflight.isLoading || preflight.checks.initiateRemoval.status !== 'met' || probe.kind === 'probing';

  const handleRemove = async () => {
    if (isProcessing || probe.kind === 'idle' || probe.kind === 'probing') return;
    setIsProcessing(true);
    setErrorState(null);
    setTxHash(null);

    if (!chainPublicClient) {
      const msg = 'Chain client unavailable.';
      setErrorState(msg);
      onError(msg);
      setIsProcessing(false);
      return;
    }

    try {
      const useUptime = probe.kind === 'uptime-available';

      if (useUptime) {
        // Uptime path: aggregate signatures, pack into access list, call with
        // includeUptimeProof=true. The contract validates and reverts with
        // ValidatorIneligibleForRewards if the uptime isn't enough — we catch
        // that and transition to force mode rather than just dumping the
        // revert reason into the error banner.
        const uptimeProofPromise = createAndSignUptimeProof(
          validationID,
          rpcUrl,
          uptimeBlockchainID,
          customValidatorsUrl || undefined,
        );
        notify({ type: 'local', name: 'Aggregate Uptime Proof Signatures' }, uptimeProofPromise);
        const uptimeProof = await uptimeProofPromise;

        const signedWarpBytes = hexToBytes(`0x${uptimeProof.signedWarpMessage}`);
        const accessList = packWarpIntoAccessList(signedWarpBytes);

        const hash = await (tokenType === 'native'
          ? nativeStakingManager.initiateValidatorRemoval(
              validationID as `0x${string}`,
              true,
              0,
              accessList,
            )
          : erc20StakingManager.initiateValidatorRemoval(
              validationID as `0x${string}`,
              true,
              0,
              accessList,
            ));

        setTxHash(hash);
        const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
        if (receipt.status !== 'success') throw new Error(`Transaction failed with status: ${receipt.status}`);

        onSuccess({ txHash: hash, forceMode: false });
        return;
      }

      // Force path: skip uptime proof entirely.
      const hash = await (tokenType === 'native'
        ? nativeStakingManager.forceInitiateValidatorRemoval(validationID as `0x${string}`, false, 0)
        : erc20StakingManager.forceInitiateValidatorRemoval(validationID as `0x${string}`, false, 0));

      setTxHash(hash);
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status !== 'success') throw new Error(`Transaction failed with status: ${receipt.status}`);

      onSuccess({ txHash: hash, forceMode: true });
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);

      if (message.includes('User rejected')) {
        message = 'Transaction was rejected by user';
      } else if (message.includes('ValidatorIneligibleForRewards') || message.includes('ineligible for rewards')) {
        // The contract said "this validator hasn't earned rewards" — transition
        // to force mode so the user's next click does the no-rewards removal.
        setProbe({ kind: 'uptime-unavailable', reason: 'rewards-ineligible' });
        message = 'Validator is ineligible for staking rewards. Switch to Force Remove to proceed without them.';
      } else if (message.toLowerCase().includes('validators') && message.toLowerCase().includes('unavailable')) {
        setProbe({ kind: 'uptime-unavailable', reason: 'endpoint' });
      }

      setErrorState(message);
      onError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      {validationID && <ValidatorPreflightChecklist preflight={preflight} currentFlow="initiate-removal" />}

      <ProbeBanner probe={probe} onRetry={runProbe} />

      <CustomUrlDetails
        value={customValidatorsUrl}
        onChange={setCustomValidatorsUrl}
        open={showCustomUrl}
        onToggle={() => setShowCustomUrl((v) => !v)}
        disabled={isProcessing}
      />

      <LockedContent isUnlocked={!validationID || !isLocked}>
        <RemoveButton
          probe={probe}
          isProcessing={isProcessing}
          isSigningUptime={isSigningUptime}
          disabled={!validationID || !!txHash || preflight.isLoading || probe.kind === 'probing'}
          onClick={handleRemove}
        />
      </LockedContent>
    </div>
  );
}

// ─── Probe banner ───────────────────────────────────────────────────────────

function ProbeBanner({ probe, onRetry }: { probe: ProbeState; onRetry: () => void }) {
  if (probe.kind === 'idle') return null;

  if (probe.kind === 'probing') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3">
        <Loader2 className="h-4 w-4 text-zinc-400 animate-spin shrink-0" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Probing the L1 node's <code className="text-xs">/validators</code> endpoint…
        </p>
      </div>
    );
  }

  if (probe.kind === 'uptime-available') {
    const hours = Number(probe.uptimeSeconds) / 3600;
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-3">
        <div className="h-7 w-7 shrink-0 flex items-center justify-center rounded-xl bg-emerald-500/15">
          <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Removal will preserve staking rewards
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            L1 reported {hours.toFixed(1)} hours of uptime. We'll aggregate a signed proof and include it in the
            removal transaction.
          </p>
        </div>
      </div>
    );
  }

  // uptime-unavailable
  const reasonText =
    probe.reason === 'rewards-ineligible'
      ? "The contract says this validator hasn't met the rewards threshold."
      : probe.reason === 'not-found'
        ? "The L1 node's /validators endpoint didn't return this validator."
        : "The L1 node's /validators endpoint is unreachable.";

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-3">
      <div className="h-7 w-7 shrink-0 flex items-center justify-center rounded-xl bg-amber-500/15">
        <ShieldOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Removal will <span className="text-amber-700 dark:text-amber-400">forfeit staking rewards</span>
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {reasonText} Force removal skips the uptime proof and proceeds without rewards. Add a custom Validators API
          URL below to retry the uptime path against a different node.
        </p>
        {probe.reason !== 'rewards-ineligible' && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Retry uptime probe
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Custom URL collapsible ────────────────────────────────────────────────

function CustomUrlDetails({
  value,
  onChange,
  open,
  onToggle,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
      >
        <span>Custom Validators API URL (optional)</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-zinc-200/80 dark:border-zinc-800">
          <Input
            label=""
            value={value}
            onChange={onChange}
            placeholder="https://your-node/ext/bc/<blockchainID>/validators"
            disabled={disabled}
            helperText="Override the auto-detected URL if your node uses a non-standard path or the default endpoint is unavailable."
          />
        </div>
      )}
    </div>
  );
}

// ─── Action button ──────────────────────────────────────────────────────────

function RemoveButton({
  probe,
  isProcessing,
  isSigningUptime,
  disabled,
  onClick,
}: {
  probe: ProbeState;
  isProcessing: boolean;
  isSigningUptime: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const useUptime = probe.kind === 'uptime-available';
  const label = isSigningUptime
    ? 'Aggregating uptime proof…'
    : isProcessing
      ? 'Submitting…'
      : probe.kind === 'probing'
        ? 'Checking uptime…'
        : useUptime
          ? 'Remove Validator (preserves rewards)'
          : 'Force Remove Validator (forfeits rewards)';

  // Button stays primary blue across both probe states — the risk narrative is
  // carried by the banner + the inline "forfeits rewards" label text, not by
  // the button color. Variant flipping read as visual noise.
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isProcessing}
      loading={isProcessing || isSigningUptime}
      variant="primary"
    >
      {label}
    </Button>
  );
}

export default PosInitiateRemoval;
