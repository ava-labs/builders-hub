'use client';

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Users, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { networkIDs } from '@avalabs/avalanchejs';
import { GlobalParamNetwork } from '@avalabs/avacloud-sdk/models/components';
import { AvaCloudSDK } from '@avalabs/avacloud-sdk';
import { createPublicClient, http } from 'viem';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useVMCAddress } from '@/components/toolbox/hooks/useVMCAddress';
import { useVMCDetails } from '@/components/toolbox/hooks/useVMCDetails';
import { useL1List } from '@/components/toolbox/stores/l1ListStore';
import { getBlockchainInfoForNetwork } from '@/components/toolbox/coreViem/utils/glacier';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { ValidatorResponse, formatTimestamp, formatStake } from './types';
import { formatAvaxBalance } from '@/components/toolbox/coreViem/utils/format';
import { Alert } from '@/components/toolbox/components/Alert';

const metadata: ConsoleToolMetadata = {
  title: 'L1 Validators',
  description: 'View the validator set and manager details for any L1',
  toolRequirements: [],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

const networkNames: Record<number, GlobalParamNetwork> = {
  [networkIDs.MainnetID]: 'mainnet',
  [networkIDs.FujiID]: 'fuji',
};

export function QueryL1ValidatorSetInner({}: BaseConsoleToolProps) {
  const { avalancheNetworkID, isTestnet } = useWalletStore();
  const l1List = useL1List();
  const [subnetId, setSubnetId] = useState('');
  const [validators, setValidators] = useState<ValidatorResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [vmcChainRpcUrl, setVmcChainRpcUrl] = useState<string | null>(null);

  const vmcAddress = useVMCAddress(subnetId);

  // Create a standalone public client for the VMC's chain (works without switching wallet)
  const vmcPublicClient = useMemo(() => {
    if (!vmcChainRpcUrl) return null;
    return createPublicClient({ transport: http(vmcChainRpcUrl) });
  }, [vmcChainRpcUrl]);

  const vmcDetails = useVMCDetails(vmcAddress.validatorManagerAddress, vmcPublicClient);

  // Resolve the RPC URL for the VMC's chain when blockchainId changes
  useEffect(() => {
    if (!vmcAddress.blockchainId) {
      setVmcChainRpcUrl(null);
      return;
    }

    // First check the L1 list for a known chain
    const knownL1 = l1List.find((l1: { id: string; rpcUrl: string }) => l1.id === vmcAddress.blockchainId);
    if (knownL1?.rpcUrl) {
      setVmcChainRpcUrl(knownL1.rpcUrl);
      return;
    }

    // Fall back to Glacier API
    const network = avalancheNetworkID === networkIDs.MainnetID ? 'mainnet' : 'testnet';
    getBlockchainInfoForNetwork(network as 'mainnet' | 'testnet', vmcAddress.blockchainId)
      .then((_info) => {
        // Construct RPC URL from blockchain info
        const baseUrl = isTestnet ? 'https://api.avax-test.network' : 'https://api.avax.network';
        setVmcChainRpcUrl(`${baseUrl}/ext/bc/${vmcAddress.blockchainId}/rpc`);
      })
      .catch(() => {
        // If that fails, try the standard C-Chain RPC for well-known chains
        setVmcChainRpcUrl(null);
      });
  }, [vmcAddress.blockchainId, l1List, avalancheNetworkID, isTestnet]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  // Auto-fetch validators when subnet changes
  useEffect(() => {
    if (!subnetId?.trim()) {
      setValidators([]);
      setError(null);
      return;
    }

    const fetchValidators = async () => {
      setIsLoading(true);
      setError(null);
      setExpandedNodeId(null);

      try {
        const network = networkNames[Number(avalancheNetworkID)];
        if (!network) throw new Error('Invalid network');

        const sdk = new AvaCloudSDK({
          serverURL: isTestnet ? 'https://api.avax-test.network' : 'https://api.avax.network',
          network,
        });

        const result = await sdk.data.primaryNetwork.listL1Validators({ network, subnetId });
        const all: ValidatorResponse[] = [];
        for await (const page of result) {
          if ('result' in page && page.result && 'validators' in page.result) {
            all.push(...(page.result.validators as unknown as ValidatorResponse[]));
          } else if ('validators' in page) {
            all.push(...(page.validators as unknown as ValidatorResponse[]));
          }
        }

        const active = all.filter((v) => v.weight > 0).sort((a, b) => b.weight - a.weight);
        setValidators(active);

        // Detect L1 vs legacy subnet — L1s have validators with validationId
      } catch (err) {
        console.error('Error fetching validators:', err);
        setError('Failed to fetch validators');
      } finally {
        setIsLoading(false);
      }
    };

    fetchValidators();
  }, [subnetId, avalancheNetworkID, isTestnet]);

  const totalWeight = validators.reduce((sum, v) => sum + v.weight, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left: Subnet selector + VMC details */}
      <div className="space-y-4">
        <SelectSubnetId value={subnetId} onChange={setSubnetId} hidePrimaryNetwork={true} />
      </div>

      {/* Right: VMC details + Validator list */}
      <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
        {subnetId && (vmcAddress.validatorManagerAddress || vmcAddress.isLoading) && (
          <ValidatorManagerDetails
            key={`${subnetId}-${vmcAddress.validatorManagerAddress}`}
            validatorManagerAddress={vmcAddress.validatorManagerAddress}
            blockchainId={vmcAddress.blockchainId}
            subnetId={subnetId}
            isLoading={vmcAddress.isLoading}
            signingSubnetId={vmcAddress.signingSubnetId}
            contractTotalWeight={vmcDetails.contractTotalWeight}
            l1WeightError={vmcDetails.l1WeightError}
            isLoadingL1Weight={vmcDetails.isLoadingL1Weight}
            contractOwner={vmcDetails.contractOwner}
            ownershipError={vmcDetails.ownershipError}
            isLoadingOwnership={vmcDetails.isLoadingOwnership}
            isOwnerContract={vmcDetails.isOwnerContract}
            ownerType={vmcDetails.ownerType}
            isDetectingOwnerType={vmcDetails.isDetectingOwnerType}
            isExpanded={true}
            onToggleExpanded={() => {}}
          />
        )}
        {subnetId && !vmcAddress.isLoading && vmcAddress.error && <Alert variant="warning">{vmcAddress.error}</Alert>}
        {!subnetId ? (
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 p-8 text-center">
            <Users className="h-6 w-6 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Select a subnet to view its validators</p>
          </div>
        ) : isLoading ? (
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 p-8 text-center">
            <Loader2 className="h-6 w-6 text-zinc-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Loading validators...</p>
          </div>
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : validators.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 p-8 text-center">
            <Users className="h-6 w-6 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No active validators found</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Validators</span>
                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-full">
                  {validators.length}
                </span>
              </div>
              <span className="text-xs text-zinc-400">Total weight: {totalWeight.toLocaleString()}</span>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[600px] overflow-y-auto">
              {validators.map((v) => {
                const isExpanded = expandedNodeId === v.nodeId;
                const weightPct = totalWeight > 0 ? ((v.weight / totalWeight) * 100).toFixed(1) : '0';

                return (
                  <div key={v.nodeId} className="group">
                    <button
                      onClick={() => setExpandedNodeId(isExpanded ? null : v.nodeId)}
                      className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      )}
                      <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate flex-1">
                        {v.nodeId}
                      </code>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-zinc-500">{weightPct}%</span>
                        <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-zinc-400 dark:bg-zinc-500 rounded-full"
                            style={{ width: `${Math.min(parseFloat(weightPct), 100)}%` }}
                          />
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 pl-11 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-zinc-400">Weight</span>
                            <p className="font-mono text-zinc-700 dark:text-zinc-300">
                              {formatStake(v.weight.toString())}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-400">Balance</span>
                            <p className="font-mono text-blue-600 dark:text-blue-400">
                              {formatAvaxBalance(parseFloat(v.remainingBalance))} AVAX
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-400">Created</span>
                            <p className="text-zinc-600 dark:text-zinc-400">{formatTimestamp(v.creationTimestamp)}</p>
                          </div>
                          <div>
                            <span className="text-zinc-400">Status</span>
                            <p className="text-green-600 dark:text-green-400">Active</p>
                          </div>
                        </div>
                        {v.validationId && (
                          <div className="text-xs">
                            <span className="text-zinc-400">Validation ID</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="font-mono text-zinc-600 dark:text-zinc-400 text-[10px] truncate flex-1">
                                {v.validationId}
                              </code>
                              <button
                                onClick={() => copyToClipboard(v.validationId)}
                                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 shrink-0"
                              >
                                {copiedId === v.validationId ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-zinc-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="text-xs">
                          <span className="text-zinc-400">Node ID</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <code className="font-mono text-zinc-600 dark:text-zinc-400 text-[10px] truncate flex-1">
                              {v.nodeId}
                            </code>
                            <button
                              onClick={() => copyToClipboard(v.nodeId)}
                              className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 shrink-0"
                            >
                              {copiedId === v.nodeId ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3 text-zinc-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(QueryL1ValidatorSetInner, metadata);
