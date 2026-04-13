'use client';

import { Copy, Check, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { BlockchainInfo } from './SelectBlockchain';
import { SUBNET_EVM_VM_ID } from '@/constants/console';
import { useWalletStore } from '../stores/walletStore';
import { PRIMARY_NETWORK_SUBNET_ID } from './InputSubnetId';

interface BlockchainDetailsDisplayProps {
  subnet?: any | null;
  blockchain?: BlockchainInfo | null;
  isLoading?: boolean;
  error?: string | null;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  customTitle?: string;
}

function CopyableValue({ value }: { value: string | number | undefined | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  if (!value) return <span className="text-xs text-zinc-400">—</span>;

  return (
    <button
      onClick={handleCopy}
      className="group/copy flex items-center gap-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 hover:text-foreground transition-colors text-right"
    >
      <span className="break-all">{value}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
      ) : (
        <Copy className="h-3 w-3 text-zinc-400 opacity-0 group-hover/copy:opacity-100 flex-shrink-0 transition-opacity" />
      )}
    </button>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">{label}</span>
      {children}
    </div>
  );
}

export default function BlockchainDetailsDisplay({
  subnet,
  blockchain,
  isLoading,
  error,
  isExpanded = false,
  onToggleExpanded,
  customTitle,
}: BlockchainDetailsDisplayProps) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const { isTestnet } = useWalletStore();

  const currentIsExpanded = onToggleExpanded ? isExpanded : internalIsExpanded;
  const handleToggleExpanded = onToggleExpanded || (() => setInternalIsExpanded(!internalIsExpanded));

  if (isLoading) {
    return (
      <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="p-3 flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300"></div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Loading details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      </div>
    );
  }

  if (!subnet && !blockchain) {
    return null;
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isSubnetView = !!subnet;
  const blockchainData = blockchain || (subnet?.blockchains?.[0] ? { ...subnet.blockchains[0], isTestnet } : null);

  const subnetIdToCheck = isSubnetView ? subnet?.subnetId : blockchainData?.subnetId;
  const isPrimaryNetwork = subnetIdToCheck === PRIMARY_NETWORK_SUBNET_ID;

  const title =
    customTitle ||
    (isPrimaryNetwork
      ? 'Primary Network'
      : isSubnetView
        ? subnet?.isL1
          ? 'L1 Details'
          : 'Subnet Details'
        : 'Blockchain Details');

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggleExpanded}
        className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{title}</span>
          {blockchainData?.isTestnet !== undefined && (
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                blockchainData.isTestnet
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}
            >
              {blockchainData.isTestnet ? 'Fuji' : 'Mainnet'}
            </span>
          )}
        </div>
        {currentIsExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
        )}
      </button>

      {/* Content */}
      {currentIsExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 pb-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {/* Subnet info */}
          {isSubnetView && subnet && (
            <>
              <DetailRow label="Created">
                <span className="text-xs text-zinc-800 dark:text-zinc-200">
                  {formatTimestamp(subnet.createBlockTimestamp)}
                </span>
              </DetailRow>
              <DetailRow label="Blockchains">
                <span className="text-xs text-zinc-800 dark:text-zinc-200">{subnet.blockchains?.length || 0}</span>
              </DetailRow>

              {/* Owner */}
              {subnet.subnetOwnershipInfo?.addresses?.[0] && (
                <DetailRow label="Owner">
                  <div className="text-right">
                    <CopyableValue value={subnet.subnetOwnershipInfo.addresses[0]} />
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {subnet.subnetOwnershipInfo.threshold}/{subnet.subnetOwnershipInfo.addresses.length} threshold
                    </div>
                  </div>
                </DetailRow>
              )}

              {/* L1 Validator Manager */}
              {subnet.isL1 && subnet.l1ValidatorManagerDetails?.contractAddress && (
                <DetailRow label="Validator Manager">
                  <CopyableValue value={subnet.l1ValidatorManagerDetails.contractAddress} />
                </DetailRow>
              )}
            </>
          )}

          {/* Blockchain info */}
          {blockchainData && (
            <>
              {!isSubnetView && (
                <>
                  <DetailRow label="Name">
                    <span className="text-xs text-zinc-800 dark:text-zinc-200">
                      {blockchainData.blockchainName || 'Unknown'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Created">
                    <span className="text-xs text-zinc-800 dark:text-zinc-200">
                      {formatTimestamp(blockchainData.createBlockTimestamp)}
                    </span>
                  </DetailRow>
                </>
              )}

              {blockchainData.evmChainId && (
                <DetailRow label="EVM Chain ID">
                  <CopyableValue value={blockchainData.evmChainId} />
                </DetailRow>
              )}
              <DetailRow label="Blockchain ID">
                <CopyableValue value={blockchainData.blockchainId} />
              </DetailRow>
              <DetailRow label="Subnet ID">
                <CopyableValue value={blockchainData.subnetId} />
              </DetailRow>
              <DetailRow label="VM ID">
                <div className="text-right">
                  <CopyableValue value={blockchainData.vmId} />
                  {blockchainData.vmId && blockchainData.vmId !== SUBNET_EVM_VM_ID && (
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Non-standard VM</span>
                    </div>
                  )}
                </div>
              </DetailRow>
            </>
          )}
        </div>
      )}
    </div>
  );
}
