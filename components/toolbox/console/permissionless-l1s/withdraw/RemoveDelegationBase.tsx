"use client";

import React, { useState, useEffect } from 'react';
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Input } from '@/components/toolbox/components/Input';
import InitiateDelegatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/InitiateDelegatorRemoval';
import CompleteDelegatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/CompleteDelegatorRemoval';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { BaseConsoleToolProps } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { L1SubnetStep, StepFlowFooter, useL1SubnetState } from '../shared';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';

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
    const [removalCompleteTxHash, setRemovalCompleteTxHash] = useState<string>('');
    const [userDelegations, setUserDelegations] = useState<Array<{
        delegationID: string;
        validationID: string;
        weight: string;
        owner: string;
    }>>([]);
    const [isLoadingDelegations, setIsLoadingDelegations] = useState(false);

    const { publicClient, walletEVMAddress } = useWalletStore();
    const l1State = useL1SubnetState();
    const { validatorManagerDetails, viemChain } = l1State;

    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';
    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;

    // Fetch user's delegations when subnet, wallet changes
    useEffect(() => {
        const fetchUserDelegations = async () => {
            if (!publicClient || !validatorManagerDetails.contractOwner || !walletEVMAddress) {
                setUserDelegations([]);
                return;
            }

            setIsLoadingDelegations(true);
            try {
                // Query InitiatedDelegatorRegistration events for this user
                const logs = await publicClient.getLogs({
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
                            const info = await publicClient.readContract({
                                address: validatorManagerDetails.contractOwner as `0x${string}`,
                                abi: contractAbi,
                                functionName: 'getDelegator',
                                args: [logDelegationID as `0x${string}`],
                            }) as { weight?: bigint; owner?: string };

                            return {
                                delegationID: logDelegationID,
                                validationID,
                                weight: info.weight?.toString() || '0',
                                owner: info.owner || '',
                            };
                        } catch (err) {
                            console.warn(`Could not fetch info for delegation ${logDelegationID}:`, err);
                            return null;
                        }
                    })
                );

                // Filter out null entries and delegations that are no longer active
                const activeDelegations = delegations.filter(d => d !== null && d.weight !== '0') as Array<{
                    delegationID: string;
                    validationID: string;
                    weight: string;
                    owner: string;
                }>;
                setUserDelegations(activeDelegations);
            } catch (err) {
                console.error('Failed to fetch user delegations:', err);
                setUserDelegations([]);
            } finally {
                setIsLoadingDelegations(false);
            }
        };

        fetchUserDelegations();
    }, [publicClient, validatorManagerDetails.contractOwner, walletEVMAddress, contractAbi]);

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setDelegationID('');
        setInitiateRemovalTxHash('');
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
                        Select the delegation you want to remove. Only your active delegations will be shown.
                    </p>

                    {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
                        <Alert variant="error" className="mb-4">
                            This L1 is not using a Staking Manager. This tool is only for L1s with {tokenLabel} Staking Managers that support delegation.
                        </Alert>
                    )}

                    {isLoadingDelegations && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md mb-4">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Loading your delegations...
                            </p>
                        </div>
                    )}

                    {!isLoadingDelegations && userDelegations.length === 0 && walletEVMAddress && validatorManagerDetails.contractOwner && (
                        <Alert variant="warning" className="mb-4">
                            No active delegations found for your address on this L1.
                        </Alert>
                    )}

                    {userDelegations.length > 0 && (
                        <div className="space-y-2 mb-4">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Your Delegations
                            </label>
                            <div className="space-y-2">
                                {userDelegations.map((delegation) => (
                                    <div
                                        key={delegation.delegationID}
                                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                            delegationID === delegation.delegationID
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                        }`}
                                        onClick={() => setDelegationID(delegation.delegationID)}
                                    >
                                        <div className="text-sm space-y-1">
                                            <p><strong>Delegation ID:</strong> <code className="text-xs">{delegation.delegationID}</code></p>
                                            <p><strong>Weight:</strong> {delegation.weight}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Input
                        label="Delegation ID (or select from above)"
                        value={delegationID}
                        onChange={setDelegationID}
                        placeholder="0x..."
                        helperText="The unique identifier for your delegation"
                    />
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
                    <h2 className="text-lg font-semibold">Complete Delegator Removal</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Finalize the delegation removal by calling <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/StakingManager.sol" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">completeDelegatorRemoval</a>.
                        This will return your delegated stake and distribute rewards (minus delegation fees).
                    </p>

                    <CompleteDelegatorRemoval
                        key={`complete-${l1State.resetKey}-${tokenType}`}
                        delegationID={delegationID}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
                        tokenType={tokenType}
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
                showReset={!!(initiateRemovalTxHash || removalCompleteTxHash || globalError || globalSuccess)}
                onReset={handleReset}
            />
        </div>
    );
}
