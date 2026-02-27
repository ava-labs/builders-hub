"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Input, type Suggestion } from '@/components/toolbox/components/Input';
import InitiateDelegatorRemoval from '@/components/toolbox/console/permissionless-l1s/Withdraw/InitiateDelegatorRemoval';
import CompleteDelegatorRemoval from '@/components/toolbox/console/permissionless-l1s/Withdraw/CompleteDelegatorRemoval';
import SubmitPChainTxWeightUpdate from '@/components/toolbox/console/shared/SubmitPChainTxWeightUpdate';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { BaseConsoleToolProps } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { L1SubnetStep, StepFlowFooter, useL1SubnetState } from '../shared';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { formatEther } from 'viem';

export type TokenType = 'native' | 'erc20';

export interface RemoveDelegationBaseProps extends BaseConsoleToolProps {
    tokenType: TokenType;
}

export default function RemoveDelegationBase({ tokenType, onSuccess }: RemoveDelegationBaseProps) {
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

    // State for passing data between components
    const [delegationID, setDelegationID] = useState<string>('');
    const [initiateRemovalTxHash, setInitiateRemovalTxHash] = useState<string>('');
    const [pChainTxId, setPChainTxId] = useState<string>('');
    const [removalCompleteTxHash, setRemovalCompleteTxHash] = useState<string>('');
    const [allDelegations, setAllDelegations] = useState<Array<{
        delegationID: string;
        validationID: string;
        weight: string;
        owner: string;
        status: 'active' | 'completed';
    }>>([]);
    const [isLoadingDelegations, setIsLoadingDelegations] = useState(false);

    const { walletEVMAddress } = useWalletStore();
    const chainPublicClient = useChainPublicClient();
    const l1State = useL1SubnetState();
    const { validatorManagerDetails, viemChain } = l1State;

    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';
    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;

    // Fetch user's delegations when subnet, wallet changes
    useEffect(() => {
        const fetchUserDelegations = async () => {
            if (!chainPublicClient || !validatorManagerDetails.contractOwner || !walletEVMAddress) {
                setAllDelegations([]);
                return;
            }

            setIsLoadingDelegations(true);
            try {
                // Query InitiatedDelegatorRegistration events for this user
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
                            // Get current delegation info using the appropriate ABI
                            const info = await chainPublicClient.readContract({
                                address: validatorManagerDetails.contractOwner as `0x${string}`,
                                abi: contractAbi,
                                functionName: 'getDelegatorInfo',
                                args: [logDelegationID as `0x${string}`],
                            }) as { weight?: bigint; owner?: string };

                            const weightStr = info.weight?.toString() || '0';
                            return {
                                delegationID: logDelegationID,
                                validationID,
                                weight: weightStr,
                                owner: info.owner || '',
                                status: (weightStr === '0' ? 'completed' : 'active') as 'active' | 'completed',
                            };
                        } catch (err) {
                            console.warn(`Could not fetch info for delegation ${logDelegationID}:`, err);
                            return null;
                        }
                    })
                );

                // Filter out null entries and store all delegations
                const validDelegations = delegations.filter(d => d !== null) as Array<{
                    delegationID: string;
                    validationID: string;
                    weight: string;
                    owner: string;
                    status: 'active' | 'completed';
                }>;
                setAllDelegations(validDelegations);
            } catch (err) {
                console.error('Failed to fetch user delegations:', err);
                setAllDelegations([]);
            } finally {
                setIsLoadingDelegations(false);
            }
        };

        fetchUserDelegations();
    }, [chainPublicClient, validatorManagerDetails.contractOwner, walletEVMAddress, contractAbi]);

    // Create suggestions for the delegation input (similar to SelectValidationID)
    const delegationSuggestions: Suggestion[] = useMemo(() => {
        return allDelegations.map((delegation) => {
            const isCompleted = delegation.status === 'completed';
            const isSelected = delegationID === delegation.delegationID;
            const statusLabel = isCompleted ? ' (Completed)' : '';
            const selectedLabel = isSelected ? ' ✓' : '';
            
            // Format weight for display
            let weightDisplay = delegation.weight;
            try {
                // Try to convert weight to a more readable format
                const weightBigInt = BigInt(delegation.weight);
                if (weightBigInt > 0n) {
                    weightDisplay = formatEther(weightBigInt) + ' tokens';
                }
            } catch {
                // Keep original weight if conversion fails
            }

            return {
                title: `${delegation.delegationID.substring(0, 18)}...${selectedLabel}`,
                value: delegation.delegationID,
                description: `Weight: ${weightDisplay}${statusLabel}`,
            };
        });
    }, [allDelegations, delegationID]);

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setDelegationID('');
        setInitiateRemovalTxHash('');
        setPChainTxId('');
        setRemovalCompleteTxHash('');
        l1State.setSubnetIdL1('');
        l1State.incrementResetKey();
    };

    return (
        <div className="space-y-6">
            {globalError && (
                <Alert variant="error">Error: {globalError}</Alert>
            )}

            <Steps>
                <L1SubnetStep
                    subnetId={l1State.subnetIdL1}
                    onSubnetIdChange={l1State.setSubnetIdL1}
                    description="Choose the L1 subnet where you want to remove a delegation."
                    validatorManagerDetails={validatorManagerDetails}
                    validatorManagerError={validatorManagerDetails.error}
                    isExpanded={l1State.isValidatorManagerDetailsExpanded}
                    onToggleExpanded={l1State.toggleValidatorManagerDetails}
                />

                <Step>
                    <h2 className="text-lg font-semibold">Select Delegation to Remove</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Select the delegation you want to remove from the dropdown or enter the delegation ID directly.
                        Both active and completed delegations are shown.
                    </p>

                    {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
                        <Alert variant="error" className="mb-4">
                            This L1 is not using a Staking Manager. This tool is only for L1s with {tokenLabel} Staking Managers that support delegation.
                        </Alert>
                    )}

                    {!isLoadingDelegations && allDelegations.length === 0 && walletEVMAddress && validatorManagerDetails.contractOwner && (
                        <Alert variant="warning" className="mb-4">
                            No delegations found for your address on this L1.
                        </Alert>
                    )}

                    <Input
                        label="Delegation ID"
                        value={delegationID}
                        onChange={setDelegationID}
                        suggestions={delegationSuggestions}
                        placeholder={isLoadingDelegations ? "Loading delegations..." : "Enter delegation ID or select from suggestions"}
                        helperText="Select your delegation from the dropdown or enter the delegation ID manually"
                    />

                    {/* Show selected delegation info */}
                    {delegationID && allDelegations.find(d => d.delegationID === delegationID) && (
                        <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            {(() => {
                                const selectedDelegation = allDelegations.find(d => d.delegationID === delegationID);
                                if (!selectedDelegation) return null;
                                const isCompleted = selectedDelegation.status === 'completed';
                                return (
                                    <div className="text-sm space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-zinc-700 dark:text-zinc-300"><strong>Status:</strong></p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                isCompleted 
                                                    ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400' 
                                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            }`}>
                                                {isCompleted ? 'Completed' : 'Active'}
                                            </span>
                                        </div>
                                        <p className="text-zinc-600 dark:text-zinc-400">
                                            <strong>Validation ID:</strong> <code className="text-xs">{selectedDelegation.validationID.substring(0, 18)}...</code>
                                        </p>
                                        <p className="text-zinc-600 dark:text-zinc-400">
                                            <strong>Weight:</strong> {selectedDelegation.weight}
                                        </p>
                                        {isCompleted && (
                                            <Alert variant="info" className="mt-2">
                                                <p className="text-xs">
                                                    This delegation is already completed. You can use this ID for reference but cannot remove it again.
                                                </p>
                                            </Alert>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Initiate Delegator Removal</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Call the <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/IStakingManager.sol#L281" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">initiateDelegatorRemoval</a> function on the Staking Manager contract.
                        You can optionally include an uptime proof to potentially increase your rewards.
                    </p>

                    <Alert variant="info" className="mb-4">
                        <p className="text-sm">
                            <strong>Uptime Proof:</strong> Including an uptime proof fetches the validator&apos;s uptime
                            and may result in higher reward calculations based on the validator&apos;s performance.
                        </p>
                    </Alert>

                    <InitiateDelegatorRemoval
                        key={`initiate-${l1State.resetKey}-${tokenType}`}
                        delegationID={delegationID}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
                        rpcUrl={viemChain?.rpcUrls?.default?.http[0] || ''}
                        signingSubnetId={validatorManagerDetails.signingSubnetId}
                        tokenType={tokenType}
                        onSuccess={(data) => {
                            setInitiateRemovalTxHash(data.txHash);
                            setGlobalError(null);
                        }}
                        onError={(message) => setGlobalError(message)}
                    />
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Submit P-Chain Transaction</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Submit the weight update to the P-Chain. This step aggregates signatures from L1 validators
                        and updates the validator&apos;s weight on the P-Chain to reflect the removed delegation.
                    </p>

                    <SubmitPChainTxWeightUpdate
                        key={`pchain-${l1State.resetKey}-${tokenType}`}
                        subnetIdL1={l1State.subnetIdL1}
                        initialEvmTxHash={initiateRemovalTxHash}
                        signingSubnetId={validatorManagerDetails.signingSubnetId}
                        txHashLabel="Initiate Removal Transaction Hash"
                        txHashPlaceholder="Enter the transaction hash from the initiate removal step (0x...)"
                        onSuccess={(txId) => {
                            setPChainTxId(txId);
                            setGlobalError(null);
                        }}
                        onError={(message) => setGlobalError(message)}
                    />
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Complete Delegator Removal</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Finalize the delegation removal by calling <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/StakingManager.sol" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">completeDelegatorRemoval</a>.
                        This will aggregate the P-Chain signature, return your delegated stake, and distribute rewards (minus delegation fees).
                    </p>

                    <CompleteDelegatorRemoval
                        key={`complete-${l1State.resetKey}-${tokenType}`}
                        delegationID={delegationID}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
                        tokenType={tokenType}
                        subnetIdL1={l1State.subnetIdL1}
                        signingSubnetId={validatorManagerDetails.signingSubnetId}
                        pChainTxId={pChainTxId}
                        onSuccess={(data) => {
                            setRemovalCompleteTxHash(data.txHash);
                            setGlobalSuccess(data.message);
                            setGlobalError(null);
                            onSuccess?.();
                        }}
                        onError={(message) => setGlobalError(message)}
                    />
                </Step>
            </Steps>

            <StepFlowFooter
                globalSuccess={globalSuccess}
                showReset={!!(initiateRemovalTxHash || pChainTxId || removalCompleteTxHash || globalError || globalSuccess)}
                onReset={handleReset}
            />
        </div>
    );
}
