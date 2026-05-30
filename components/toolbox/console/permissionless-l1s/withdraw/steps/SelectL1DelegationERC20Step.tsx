'use client';

import React, { useState, useEffect, useMemo } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { Input, type Suggestion } from '@/components/toolbox/components/Input';
import { useRemoveDelegationStore } from '@/components/toolbox/stores/removeDelegationStore';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { Alert } from '@/components/toolbox/components/Alert';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { formatEther } from 'viem';

export default function SelectL1DelegationERC20Step() {
  const store = useRemoveDelegationStore();
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

  const validatorManagerDetails = useValidatorManagerDetails({ subnetId: store.subnetIdL1 });
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();

  const handleSubnetChange = (value: string) => {
    store.setSubnetIdL1(value);
    store.setTokenType('erc20');
  };

  // Fetch user's delegations when subnet, wallet changes
  useEffect(() => {
    const fetchUserDelegations = async () => {
      if (!chainPublicClient || !validatorManagerDetails.contractOwner || !walletEVMAddress) {
        setAllDelegations([]);
        return;
      }

      setIsLoadingDelegations(true);
      try {
        const logs = await chainPublicClient.getLogs({
          address: validatorManagerDetails.contractOwner as `0x${string}`,
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
              const info = (await chainPublicClient.readContract({
                address: validatorManagerDetails.contractOwner as `0x${string}`,
                abi: ERC20TokenStakingManager.abi,
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
  }, [chainPublicClient, validatorManagerDetails.contractOwner, walletEVMAddress]);

  const delegationSuggestions: Suggestion[] = useMemo(() => {
    return allDelegations.map((delegation) => {
      const isCompleted = delegation.status === 'completed';
      const isSelected = store.delegationId === delegation.delegationID;
      const statusLabel = isCompleted ? ' (Completed)' : '';
      const selectedLabel = isSelected ? ' ✓' : '';

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
        title: `${delegation.delegationID.substring(0, 18)}...${selectedLabel}`,
        value: delegation.delegationID,
        description: `Weight: ${weightDisplay}${statusLabel}`,
      };
    });
  }, [allDelegations, store.delegationId]);

  const selectedDelegation = allDelegations.find((d) => d.delegationID === store.delegationId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 mb-4">
            Choose the L1 subnet where you want to remove a delegation using ERC20 Token staking.
          </p>
          <SelectSubnetId
            value={store.subnetIdL1}
            onChange={handleSubnetChange}
            error={validatorManagerDetails.error}
            hidePrimaryNetwork={true}
          />
        </div>
        {store.subnetIdL1 && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <ValidatorManagerDetails
              validatorManagerAddress={validatorManagerDetails.validatorManagerAddress}
              blockchainId={validatorManagerDetails.blockchainId}
              subnetId={store.subnetIdL1}
              isLoading={validatorManagerDetails.isLoading}
              signingSubnetId={validatorManagerDetails.signingSubnetId}
              contractTotalWeight={validatorManagerDetails.contractTotalWeight}
              l1WeightError={validatorManagerDetails.l1WeightError}
              isLoadingL1Weight={validatorManagerDetails.isLoadingL1Weight}
              contractOwner={validatorManagerDetails.contractOwner}
              ownershipError={validatorManagerDetails.ownershipError}
              isLoadingOwnership={validatorManagerDetails.isLoadingOwnership}
              isOwnerContract={validatorManagerDetails.isOwnerContract}
              ownerType={validatorManagerDetails.ownerType}
              isDetectingOwnerType={validatorManagerDetails.isDetectingOwnerType}
              isExpanded={isExpanded}
              onToggleExpanded={() => setIsExpanded((prev) => !prev)}
            />
          </div>
        )}
      </div>

      {store.subnetIdL1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Select Delegation to Remove</h3>
          <p className="text-sm text-zinc-500">
            Select the delegation you want to remove from the dropdown or enter the delegation ID directly.
          </p>

          {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
            <Alert variant="error">
              This L1 is not using a Staking Manager. This tool is only for L1s with ERC20 Token Staking Managers that
              support delegation.
            </Alert>
          )}

          {!isLoadingDelegations &&
            allDelegations.length === 0 &&
            walletEVMAddress &&
            validatorManagerDetails.contractOwner && (
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
                {selectedDelegation.status === 'completed' && (
                  <Alert variant="info" className="mt-2">
                    <p className="text-xs">
                      This delegation is already completed. You can use this ID for reference but cannot remove it
                      again.
                    </p>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
