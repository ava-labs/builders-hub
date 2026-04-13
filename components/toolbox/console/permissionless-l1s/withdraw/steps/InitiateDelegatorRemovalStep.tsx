'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { Input, type Suggestion } from '@/components/toolbox/components/Input';
import { useRemoveDelegationStore } from '@/components/toolbox/stores/removeDelegationStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import InitiateDelegatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/InitiateDelegatorRemoval';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import { formatEther } from 'viem';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { DELEGATION_REMOVAL_STEPS } from '../codeConfig';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];

export default function InitiateDelegatorRemovalStep() {
  const store = useRemoveDelegationStore();
  const vmcCtx = useValidatorManagerContext();
  const viemChain = useViemChainStore();
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();

  const stakingManagerAddress = vmcCtx.staking?.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const tokenType = vmcCtx.staking?.stakingType || 'native';

  const [allDelegations, setAllDelegations] = useState<
    Array<{ delegationID: string; validationID: string; weight: string; status: 'active' | 'completed' }>
  >([]);
  const [isLoadingDelegations, setIsLoadingDelegations] = useState(false);

  // Fetch user's delegations
  useEffect(() => {
    const fetchUserDelegations = async () => {
      if (!chainPublicClient || !stakingManagerAddress || !walletEVMAddress) {
        setAllDelegations([]);
        return;
      }
      setIsLoadingDelegations(true);
      try {
        const logs = await chainPublicClient.getLogs({
          address: stakingManagerAddress as `0x${string}`,
          event: {
            type: 'event',
            name: 'InitiatedDelegatorRegistration',
            inputs: [
              { name: 'delegationID', type: 'bytes32', indexed: true },
              { name: 'validationID', type: 'bytes32', indexed: true },
              { name: 'delegatorAddress', type: 'address', indexed: true },
              { name: 'nonce', type: 'uint64', indexed: false },
              { name: 'validatorWeight', type: 'uint64', indexed: false },
              { name: 'delegatorWeight', type: 'uint64', indexed: false },
              { name: 'setWeightMessageID', type: 'bytes32', indexed: false },
              { name: 'rewardRecipient', type: 'address', indexed: false },
            ],
          },
          args: { delegatorAddress: walletEVMAddress as `0x${string}` },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        const delegations = await Promise.all(
          logs.map(async (log) => {
            const logDelegationID = log.topics[1] as string;
            const validationID = log.topics[2] as string;
            try {
              const info = (await chainPublicClient.readContract({
                address: stakingManagerAddress as `0x${string}`,
                abi: NativeTokenStakingManager.abi,
                functionName: 'getDelegatorInfo',
                args: [logDelegationID as `0x${string}`],
              })) as { weight?: bigint };
              const weightStr = info.weight?.toString() || '0';
              return {
                delegationID: logDelegationID,
                validationID,
                weight: weightStr,
                status: (weightStr === '0' ? 'completed' : 'active') as 'active' | 'completed',
              };
            } catch {
              return null;
            }
          }),
        );
        setAllDelegations(delegations.filter((d): d is NonNullable<typeof d> => d !== null));
      } catch {
        setAllDelegations([]);
      } finally {
        setIsLoadingDelegations(false);
      }
    };
    fetchUserDelegations();
  }, [chainPublicClient, stakingManagerAddress, walletEVMAddress]);

  const delegationSuggestions: Suggestion[] = useMemo(() => {
    return allDelegations.map((d) => {
      let weightDisplay = d.weight;
      try {
        const w = BigInt(d.weight);
        if (w > 0n) weightDisplay = formatEther(w) + ' tokens';
      } catch {
        /* keep original */
      }
      return {
        title: `${d.delegationID.substring(0, 18)}...`,
        value: d.delegationID,
        description: `Weight: ${weightDisplay}${d.status === 'completed' ? ' (Completed)' : ''}`,
      };
    });
  }, [allDelegations]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        {!store.subnetIdL1 && <Alert variant="warning">No L1 subnet selected. Go back to the previous step.</Alert>}

        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 space-y-4">
            {!isLoadingDelegations && allDelegations.length === 0 && walletEVMAddress && stakingManagerAddress && (
              <Alert variant="warning">No delegations found for your address on this L1.</Alert>
            )}

            <Input
              label="Delegation ID"
              value={store.delegationId}
              onChange={store.setDelegationId}
              suggestions={delegationSuggestions}
              placeholder={isLoadingDelegations ? 'Loading delegations...' : 'Select or enter delegation ID'}
              helperText="Select your delegation from the dropdown or paste the ID"
            />

            {store.delegationId && stakingManagerAddress && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <InitiateDelegatorRemoval
                  delegationID={store.delegationId}
                  stakingManagerAddress={stakingManagerAddress}
                  rpcUrl={viemChain?.rpcUrls?.default?.http[0] || ''}
                  signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
                  tokenType={tokenType}
                  onSuccess={(data) => {
                    store.setEvmTxHash(data.txHash);
                    store.setGlobalError(null);
                  }}
                  onError={(message) => store.setGlobalError(message)}
                />
              </div>
            )}
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">forceInitiateDelegatorRemoval()</span>
            <a
              href={`https://github.com/ava-labs/icm-contracts/tree/${ICM_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
            >
              @{ICM_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </div>
      <StepCodeViewer activeStep={0} steps={DELEGATION_REMOVAL_STEPS} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
