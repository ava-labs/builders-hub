import { useState, useEffect, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { getBlockchainInfo } from '../coreViem/utils/glacier';

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
  onToggleExpanded
}: ValidatorManagerDetailsProps) {
  const [blockchainName, setBlockchainName] = useState<string | null>(null);
  const [isLoadingBlockchainName, setIsLoadingBlockchainName] = useState(false);
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

  if (isLoading) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 animate-pulse">Loading L1 details...</p>;
  }

  if (!validatorManagerAddress) {
    return null;
  }

  const ownerTypeLabel = isDetectingOwnerType
    ? 'detecting...'
    : ownerType || null;

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button
        onClick={handleToggleExpanded}
        className="w-full px-4 py-3 flex items-center justify-between text-left bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Validator Manager Details
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 select-none">
          {currentIsExpanded ? '−' : '+'}
        </span>
      </button>

      {currentIsExpanded && (
        <div className="px-4 py-3 space-y-3 text-sm border-t border-zinc-200 dark:border-zinc-800">
          <Row
            label="Contract Address"
            value={validatorManagerAddress}
            mono
            copyable
          />

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
              label={blockchainName
                ? `Home Chain — ${blockchainName}`
                : isLoadingBlockchainName
                  ? 'Home Chain — loading...'
                  : 'Home Chain'
              }
              value={blockchainId}
              mono
              copyable
            />
          )}

          {signingSubnetId && signingSubnetId !== subnetId && (
            <Row
              label="Signing Subnet ID"
              value={signingSubnetId}
              mono
              copyable
            />
          )}

          <Row
            label="Total Validator Weight"
            value={l1WeightError || (contractTotalWeight !== undefined ? contractTotalWeight.toString() : '0')}
            error={!!l1WeightError}
            loading={isLoadingL1Weight}
          />
        </div>
      )}
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
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        {badge && (
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!copyable}
        className={`group/copy w-full flex items-center justify-between gap-2 text-xs px-3 py-2 rounded border break-all text-left ${
          error
            ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50'
            : 'text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50'
        } ${mono ? 'font-mono' : ''} ${loading ? 'animate-pulse' : ''} ${
          copyable ? 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors' : 'cursor-default'
        }`}
      >
        <span>{value}</span>
        {copyable && (
          copied ? (
            <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-zinc-400 opacity-0 group-hover/copy:opacity-100 flex-shrink-0 transition-opacity" />
          )
        )}
      </button>
    </div>
  );
}
