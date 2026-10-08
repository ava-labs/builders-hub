'use client';

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { BoardHeader, HashChip } from '@/components/explorer-v2/ui';
import { networkIDs } from '@avalabs/avalanchejs';
import { GlobalParamNetwork } from '@avalabs/avacloud-sdk/models/components';
import { AvaCloudSDK } from '@avalabs/avacloud-sdk';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useVMCAddress } from '@/components/toolbox/hooks/useVMCAddress';
import { useVMCDetails } from '@/components/toolbox/hooks/useVMCDetails';
import { usePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
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

/** A hairline board with nothing in it yet: what's missing, one sentence, and the way forward. */
function EmptyBoard({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border border-zinc-200 bg-white px-5 py-6 md:px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{children}</p>
      {action && <div className="mt-2">{action}</div>}
    </section>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 sm:w-28 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="min-w-0 text-[13px] text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-50">{children}</dd>
    </div>
  );
}

export function QueryL1ValidatorSetInner({}: BaseConsoleToolProps) {
  const { avalancheNetworkID, isTestnet } = useWalletStore();
  const [subnetId, setSubnetId] = useState('');
  const [validators, setValidators] = useState<ValidatorResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  const vmcAddress = useVMCAddress(subnetId);

  // Read contract state from the VMC's own chain — independent of the
  // wallet's currently-selected network. Resolves well-known C-Chain
  // IDs even when the user's l1List has been customized.
  const vmcPublicClient = usePublicClientForChain(vmcAddress.blockchainId);

  const vmcDetails = useVMCDetails(vmcAddress.validatorManagerAddress, vmcPublicClient);

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
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      {/* Left: Subnet selector + VMC details */}
      <section className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <BoardHeader label="L1 subnet" />
        <div className="flex flex-col gap-4 px-5 py-5 md:px-6">
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Pick an L1 to see its active validators and validator manager.
          </p>
          <SelectSubnetId value={subnetId} onChange={setSubnetId} hidePrimaryNetwork={true} />
        </div>
      </section>

      {/* Right: VMC details + Validator list */}
      <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4 lg:self-start">
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
          <EmptyBoard label="No L1 selected">Pick an L1 subnet to list its active validators.</EmptyBoard>
        ) : isLoading ? (
          <section
            role="status"
            aria-label="Loading validators"
            className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          >
            <BoardHeader
              label="Validators"
              action={
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading
                </span>
              }
            />
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex h-11 items-center gap-3 px-5 md:px-6">
                  <span className="h-3.5 w-3.5 shrink-0" />
                  <span className="h-3 flex-1 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                  <span className="h-3 w-10 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                  <span className="h-1 w-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                </div>
              ))}
            </div>
          </section>
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : validators.length === 0 ? (
          <EmptyBoard
            label="No active validators"
            action={
              <Link
                href="/console/add-validator"
                className="group/add inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
              >
                Add a validator
                <ArrowRight className="h-3 w-3 text-[#E6212F] transition-transform group-hover/add:translate-x-0.5" />
              </Link>
            }
          >
            This L1 has no validators with weight above zero.
          </EmptyBoard>
        ) : (
          <section className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <BoardHeader
              label={`Validators · ${validators.length}`}
              action={
                <span className="font-mono text-[10.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  Total weight {totalWeight.toLocaleString()}
                </span>
              }
            />
            <div className="hidden grid-cols-[0.875rem_minmax(0,1fr)_3.5rem_4rem] gap-3 border-b border-zinc-200 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:border-zinc-800 dark:text-zinc-500">
              <span />
              <span>Node ID</span>
              <span className="text-right">Share</span>
              <span />
            </div>

            <div className="max-h-[600px] divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800">
              {validators.map((v) => {
                const isExpanded = expandedNodeId === v.nodeId;
                const weightPct = totalWeight > 0 ? ((v.weight / totalWeight) * 100).toFixed(1) : '0';

                return (
                  <div key={v.nodeId}>
                    <button
                      onClick={() => setExpandedNodeId(isExpanded ? null : v.nodeId)}
                      aria-expanded={isExpanded}
                      className="group/row grid w-full grid-cols-[0.875rem_minmax(0,1fr)_3.5rem_4rem] items-center gap-3 px-5 py-3 text-left md:px-6"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-all group-hover/row:translate-x-0.5 group-hover/row:text-[#E6212F]" />
                      )}
                      <code className="truncate font-mono text-[12.5px] text-zinc-900 underline-offset-4 group-hover/row:underline dark:text-zinc-50">
                        {v.nodeId}
                      </code>
                      <span className="text-right font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                        {weightPct}%
                      </span>
                      <span className="h-1 w-full bg-zinc-100 dark:bg-zinc-800">
                        <span
                          className="block h-full bg-zinc-900 dark:bg-zinc-100"
                          style={{ width: `${Math.min(parseFloat(weightPct), 100)}%` }}
                        />
                      </span>
                    </button>

                    {isExpanded && (
                      <dl className="mx-5 mb-3 divide-y divide-zinc-200 border-t border-zinc-200 md:mx-6 md:ml-[3.375rem] dark:divide-zinc-800 dark:border-zinc-800">
                        <DetailRow label="Weight">
                          <span className="font-mono tabular-nums">{formatStake(v.weight.toString())}</span>
                        </DetailRow>
                        <DetailRow label="Balance">
                          <span className="font-mono tabular-nums">
                            {formatAvaxBalance(parseFloat(v.remainingBalance))}{' '}
                            <span className="text-zinc-400 dark:text-zinc-500">AVAX</span>
                          </span>
                        </DetailRow>
                        <DetailRow label="Created">{formatTimestamp(v.creationTimestamp)}</DetailRow>
                        <DetailRow label="Status">
                          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            Active
                          </span>
                        </DetailRow>
                        {v.validationId && (
                          <DetailRow label="Validation ID">
                            <HashChip value={v.validationId} len={18} />
                          </DetailRow>
                        )}
                        <DetailRow label="Node ID">
                          <HashChip value={v.nodeId} len={22} />
                        </DetailRow>
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(QueryL1ValidatorSetInner, metadata);
