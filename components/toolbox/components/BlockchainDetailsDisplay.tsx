'use client';

import { Copy, Check, ChevronDown, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
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

  if (!value) return <span className="text-[12px] text-zinc-400">—</span>;

  return (
    <button
      onClick={handleCopy}
      className="group/copy flex items-center gap-1.5 text-right font-mono text-[12px] text-zinc-900 underline-offset-4 transition-colors hover:underline dark:text-zinc-100"
    >
      <span className="break-all">{value}</span>
      {copied ? (
        <Check className="h-3 w-3 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 flex-shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover/copy:opacity-100" />
      )}
    </button>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="flex-shrink-0 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
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
      <div className="mt-3 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="p-3 flex items-center justify-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
          <span className="text-[12px] text-zinc-500 dark:text-zinc-400">Loading details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 flex items-center gap-2 border border-red-200 bg-red-50/60 p-3 dark:border-red-900/60 dark:bg-red-950/20">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-600 dark:text-red-400" />
        <span className="text-[12px] text-red-700 dark:text-red-400">{error}</span>
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
    <div className="mt-3 overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <button
        onClick={handleToggleExpanded}
        className="group/hdr flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors group-hover/hdr:text-zinc-900 dark:text-zinc-400 dark:group-hover/hdr:text-zinc-100">
            {title}
          </span>
          {blockchainData?.isTestnet !== undefined && (
            <span
              className={`border px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] ${
                blockchainData.isTestnet
                  ? 'border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300'
                  : 'border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300'
              }`}
            >
              {blockchainData.isTestnet ? 'Fuji' : 'Mainnet'}
            </span>
          )}
        </div>
        {currentIsExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover/hdr:text-[#E6212F]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover/hdr:text-[#E6212F]" />
        )}
      </button>

      {/* Content */}
      {currentIsExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 pb-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {/* Subnet info */}
          {isSubnetView && subnet && (
            <>
              <DetailRow label="Created">
                <span className="text-[13px] text-zinc-900 dark:text-zinc-100">
                  {formatTimestamp(subnet.createBlockTimestamp)}
                </span>
              </DetailRow>
              <DetailRow label="Blockchains">
                <span className="text-[13px] text-zinc-900 dark:text-zinc-100">{subnet.blockchains?.length || 0}</span>
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
                    <span className="text-[13px] text-zinc-900 dark:text-zinc-100">
                      {blockchainData.blockchainName || 'Unknown'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Created">
                    <span className="text-[13px] text-zinc-900 dark:text-zinc-100">
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
                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
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
