import { useState, useEffect, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { formatEther } from 'viem';
import { getBlockchainInfo } from '../coreViem/utils/glacier';
import { hexToCB58 } from '@avalanche-sdk/client/utils';
import type { StakingDetails } from '@/components/toolbox/contexts/ValidatorManagerContext';

interface ValidatorManagerDetailsProps {
  validatorManagerAddress: string | null;
  blockchainId: string | null;
  subnetId: string;
  isLoading: boolean;
  signingSubnetId?: string;
  contractTotalWeight?: bigint;
  l1WeightError?: string | null;
  isLoadingL1Weight?: boolean;
  contractOwner?: string | null;
  ownershipError?: string | null;
  isLoadingOwnership?: boolean;
  isOwnerContract?: boolean;
  ownerType?: 'PoAManager' | 'StakingManager' | 'EOA' | null;
  isDetectingOwnerType?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  staking?: StakingDetails;
}

export function ValidatorManagerDetails({
  validatorManagerAddress,
  blockchainId,
  subnetId,
  isLoading,
  signingSubnetId,
  contractTotalWeight,
  l1WeightError,
  isLoadingL1Weight,
  contractOwner,
  ownershipError,
  isLoadingOwnership,
  ownerType,
  isDetectingOwnerType,
  isExpanded = true,
  onToggleExpanded,
  staking,
}: ValidatorManagerDetailsProps) {
  const [blockchainName, setBlockchainName] = useState<string | null>(null);
  const [isLoadingBlockchainName, setIsLoadingBlockchainName] = useState(false);
  const [uptimeChainName, setUptimeChainName] = useState<string | null>(null);
  const [isLoadingUptimeChainName, setIsLoadingUptimeChainName] = useState(false);
  const [internalIsExpanded, setInternalIsExpanded] = useState(true);

  const currentIsExpanded = onToggleExpanded ? isExpanded : internalIsExpanded;
  const handleToggleExpanded = onToggleExpanded || (() => setInternalIsExpanded(!internalIsExpanded));

  useEffect(() => {
    const fetchBlockchainName = async () => {
      if (!blockchainId) {
        setBlockchainName(null);
        return;
      }

      setIsLoadingBlockchainName(true);
      try {
        const blockchainInfo = await getBlockchainInfo(blockchainId);
        setBlockchainName(blockchainInfo.blockchainName);
      } catch (error) {
        console.error('Failed to fetch blockchain name:', error);
        setBlockchainName(null);
      } finally {
        setIsLoadingBlockchainName(false);
      }
    };

    fetchBlockchainName();
  }, [blockchainId]);

  // Resolve uptime blockchain name from Glacier
  const uptimeBlockchainID = staking?.settings?.uptimeBlockchainID;
  const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
  useEffect(() => {
    if (!uptimeBlockchainID || uptimeBlockchainID === ZERO_BYTES32) {
      setUptimeChainName(null);
      return;
    }
    let cancelled = false;
    setIsLoadingUptimeChainName(true);
    (async () => {
      try {
        const cb58Id = hexToCB58(uptimeBlockchainID as `0x${string}`);
        const info = await getBlockchainInfo(cb58Id);
        if (!cancelled) setUptimeChainName(info.blockchainName);
      } catch {
        if (!cancelled) setUptimeChainName(null);
      } finally {
        if (!cancelled) setIsLoadingUptimeChainName(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uptimeBlockchainID]);

  if (isLoading) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 animate-pulse">Loading L1 details...</p>;
  }

  if (!validatorManagerAddress) {
    return null;
  }

  const ownerTypeLabel = isDetectingOwnerType ? 'detecting...' : ownerType || null;

  return (
    <div className="mt-4 overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <button
        onClick={handleToggleExpanded}
        className="group/hdr flex w-full items-center justify-between bg-zinc-50/60 px-4 py-3 text-left transition-colors dark:bg-zinc-900/40"
      >
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors group-hover/hdr:text-zinc-900 dark:text-zinc-400 dark:group-hover/hdr:text-zinc-100">
          Validator Manager Details
        </span>
        <span className="select-none font-mono text-[13px] text-zinc-400 transition-colors group-hover/hdr:text-[#E6212F] dark:text-zinc-500">
          {currentIsExpanded ? '−' : '+'}
        </span>
      </button>

      {currentIsExpanded && (
        <div className="space-y-3 border-t border-zinc-200 px-4 py-3 text-[13px] dark:border-zinc-800">
          <Row label="Contract Address" value={validatorManagerAddress} mono copyable />

          <Row
            label="Contract Owner"
            badge={ownerTypeLabel}
            value={ownershipError || contractOwner || (isLoadingOwnership ? 'Loading...' : 'Unknown')}
            mono={!ownershipError && !!contractOwner}
            error={!!ownershipError}
            loading={isLoadingOwnership}
            copyable={!!contractOwner && !ownershipError}
          />

          {blockchainId && (
            <Row
              label="Home Chain"
              badge={blockchainName || (isLoadingBlockchainName ? 'loading...' : null)}
              value={blockchainId}
              mono
              copyable
            />
          )}

          {signingSubnetId && signingSubnetId !== subnetId && (
            <Row label="Signing Subnet ID" value={signingSubnetId} mono copyable />
          )}

          <Row
            label="Total Validator Weight"
            value={l1WeightError || (contractTotalWeight !== undefined ? contractTotalWeight.toString() : '0')}
            error={!!l1WeightError}
            loading={isLoadingL1Weight}
          />

          {/* Staking details (PoS only) */}
          {staking && !staking.isLoading && staking.stakingType && staking.settings && (
            <>
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-3">
                <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  Staking — {staking.stakingType === 'native' ? 'Native Token' : 'ERC20 Token'}
                </span>
              </div>

              {staking.erc20TokenAddress && <Row label="ERC20 Token" value={staking.erc20TokenAddress} mono copyable />}

              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Min Stake" value={formatEther(staking.settings.minimumStakeAmount)} />
                <MiniStat label="Max Stake" value={formatEther(staking.settings.maximumStakeAmount)} />
                <MiniStat label="Min Duration" value={formatDuration(Number(staking.settings.minimumStakeDuration))} />
                <MiniStat
                  label="Min Delegation Fee"
                  value={`${Number(staking.settings.minimumDelegationFeeBips) / 100}%`}
                />
                <MiniStat label="Max Stake Multiplier" value={`${staking.settings.maximumStakeMultiplier}x`} />
                <MiniStat
                  label="Weight:Value"
                  value={`${formatEther(staking.settings.weightToValueFactor)} tokens/weight`}
                />
              </div>

              {staking.settings.uptimeBlockchainID && staking.settings.uptimeBlockchainID !== ZERO_BYTES32 && (
                <Row
                  label="Uptime Chain"
                  badge={uptimeChainName || (isLoadingUptimeChainName ? 'loading...' : null)}
                  value={(() => {
                    try {
                      return hexToCB58(staking.settings.uptimeBlockchainID as `0x${string}`);
                    } catch {
                      return staking.settings.uptimeBlockchainID;
                    }
                  })()}
                  mono
                  copyable
                />
              )}

              {staking.settings.rewardCalculator &&
                staking.settings.rewardCalculator !== '0x0000000000000000000000000000000000000000' && (
                  <Row label="Reward Calculator" value={staking.settings.rewardCalculator} mono copyable />
                )}
            </>
          )}

          {staking?.isLoading && (
            <p className="animate-pulse text-[12px] text-zinc-500 dark:text-zinc-400">Loading staking details...</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return 'None';
  if (seconds < 3600) return `${seconds}s`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds < 604800) return `${(seconds / 86400).toFixed(1)}d`;
  return `${(seconds / 604800).toFixed(1)}w`;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50/60 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  badge,
  mono,
  error,
  loading,
  copyable,
}: {
  label: string;
  value: string;
  badge?: string | null;
  mono?: boolean;
  error?: boolean;
  loading?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!value || !copyable) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value, copyable]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        {badge && (
          <span className="border border-zinc-200 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {badge}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!copyable}
        className={`group/copy flex w-full items-center justify-between gap-2 break-all border px-3 py-2 text-left text-[12px] ${
          error
            ? 'border-red-200 bg-red-50/60 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400'
            : 'border-zinc-200 bg-zinc-50/60 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-100'
        } ${mono ? 'font-mono' : ''} ${loading ? 'animate-pulse' : ''} ${
          copyable
            ? 'cursor-pointer transition-colors hover:border-zinc-400 dark:hover:border-zinc-600'
            : 'cursor-default'
        }`}
      >
        <span>{value}</span>
        {copyable &&
          (copied ? (
            <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-zinc-400 opacity-0 group-hover/copy:opacity-100 flex-shrink-0 transition-opacity" />
          ))}
      </button>
    </div>
  );
}
