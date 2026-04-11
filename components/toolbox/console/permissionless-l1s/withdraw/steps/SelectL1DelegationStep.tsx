'use client';

import React, { useState, useEffect, useMemo } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { Input, type Suggestion } from '@/components/toolbox/components/Input';
import { useRemoveDelegationStore } from '@/components/toolbox/stores/removeDelegationStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import { formatEther } from 'viem';

export default function SelectL1DelegationStep() {
  const store = useRemoveDelegationStore();
  const vmcCtx = useValidatorManagerContext();
  const [isExpanded, setIsExpanded] = useState(true);
  const [allDelegations, setAllDelegations] = useState<
    Array<{
      delegationID: string;
      validationID: string;
      weight: string;
      owner: string;
      status: 'active' | 'completed';
    }>
  >([]);
  const [isLoadingDelegations, setIsLoadingDelegations] = useState(false);

  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();

  // Use the staking manager address from context (works for both native and ERC20)
  const stakingManagerAddress = vmcCtx.staking?.stakingManagerAddress || vmcCtx.contractOwner;
  const detectedType = vmcCtx.staking?.stakingType;

  const handleSubnetChange = (value: string) => {
    store.setSubnetIdL1(value);
  };

  // Fetch user's delegations when subnet/wallet changes
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
          args: {
            delegatorAddress: walletEVMAddress as `0x${string}`,
          },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        const delegations = await Promise.all(
          logs.map(async (log) => {
            const logDelegationID = log.topics[1] as string;
            const validationID = log.topics[2] as string;

            try {
              // getDelegatorInfo has identical signature on both Native and ERC20 staking managers
              const info = (await chainPublicClient.readContract({
                address: stakingManagerAddress as `0x${string}`,
                abi: NativeTokenStakingManager.abi,
                functionName: 'getDelegatorInfo',
                args: [logDelegationID as `0x${string}`],
              })) as { weight?: bigint; owner?: string };

              const weightStr = info.weight?.toString() || '0';
              return {
                delegationID: logDelegationID,
                validationID,
                weight: weightStr,
                owner: info.owner || '',
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
    return allDelegations.map((delegation) => {
      const isCompleted = delegation.status === 'completed';
      const isSelected = store.delegationId === delegation.delegationID;

      let weightDisplay = delegation.weight;
      try {
        const weightBigInt = BigInt(delegation.weight);
        if (weightBigInt > 0n) {
          weightDisplay = formatEther(weightBigInt) + ' tokens';
        }
      } catch {
        // Keep original weight
      }

      return {
        title: `${delegation.delegationID.substring(0, 18)}...${isSelected ? ' \u2713' : ''}`,
        value: delegation.delegationID,
        description: `Weight: ${weightDisplay}${isCompleted ? ' (Completed)' : ''}`,
      };
    });
  }, [allDelegations, store.delegationId]);

  const selectedDelegation = allDelegations.find((d) => d.delegationID === store.delegationId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">Choose the L1 subnet where you want to remove a delegation.</p>
          <SelectSubnetId
            value={store.subnetIdL1}
            onChange={handleSubnetChange}
            error={vmcCtx.error}
            hidePrimaryNetwork={true}
          />
          {detectedType && (
            <p className="text-xs text-zinc-500">
              Detected:{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                {detectedType} Token Staking
              </span>
            </p>
          )}
        </div>
        {store.subnetIdL1 && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <ValidatorManagerDetails
              validatorManagerAddress={vmcCtx.validatorManagerAddress}
              blockchainId={vmcCtx.blockchainId}
              subnetId={store.subnetIdL1}
              isLoading={vmcCtx.isLoading}
              signingSubnetId={vmcCtx.signingSubnetId}
              contractTotalWeight={vmcCtx.contractTotalWeight}
              l1WeightError={vmcCtx.l1WeightError}
              isLoadingL1Weight={vmcCtx.isLoadingL1Weight}
              contractOwner={vmcCtx.contractOwner}
              ownershipError={vmcCtx.ownershipError}
              isLoadingOwnership={vmcCtx.isLoadingOwnership}
              isOwnerContract={vmcCtx.isOwnerContract}
              ownerType={vmcCtx.ownerType}
              isDetectingOwnerType={vmcCtx.isDetectingOwnerType}
              isExpanded={isExpanded}
              onToggleExpanded={() => setIsExpanded((prev) => !prev)}
            />
          </div>
        )}
      </div>

      {store.subnetIdL1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Select Delegation to Remove</h3>
          <p className="text-sm text-gray-500">
            Select the delegation you want to remove from the dropdown or enter the delegation ID directly.
          </p>

          {vmcCtx.ownerType && vmcCtx.ownerType !== 'StakingManager' && (
            <Alert variant="error">
              This L1 is not using a Staking Manager. This tool is only for permissionless L1s that support delegation.
            </Alert>
          )}

          {!isLoadingDelegations && allDelegations.length === 0 && walletEVMAddress && stakingManagerAddress && (
            <Alert variant="warning">No delegations found for your address on this L1.</Alert>
          )}

          <Input
            label="Delegation ID"
            value={store.delegationId}
            onChange={store.setDelegationId}
            suggestions={delegationSuggestions}
            placeholder={
              isLoadingDelegations ? 'Loading delegations...' : 'Enter delegation ID or select from suggestions'
            }
            helperText="Select your delegation from the dropdown or enter the delegation ID manually"
          />

          {selectedDelegation && (
            <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div className="text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <strong>Status:</strong>
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedDelegation.status === 'completed'
                        ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {selectedDelegation.status === 'completed' ? 'Completed' : 'Active'}
                  </span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  <strong>Validation ID:</strong>{' '}
                  <code className="text-xs">{selectedDelegation.validationID.substring(0, 18)}...</code>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  <strong>Weight:</strong> {selectedDelegation.weight}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
