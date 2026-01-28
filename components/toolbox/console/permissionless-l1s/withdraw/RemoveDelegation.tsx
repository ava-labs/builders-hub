"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';
import { Input } from '@/components/toolbox/components/Input';
import InitiateDelegatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/InitiateDelegatorRemoval';
import CompleteDelegatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/CompleteDelegatorRemoval';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';

const metadata: ConsoleToolMetadata = {
    title: "Remove Delegation",
    description: "Remove your delegation from a validator and claim rewards with optional uptime proof",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

type TokenType = 'native' | 'erc20';

const RemoveDelegation: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
    const [tokenType, setTokenType] = useState<TokenType>('native');
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
    const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false);

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

    // Form state
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
    const [resetKey, setResetKey] = useState<number>(0);
    const { publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();

    const {
        validatorManagerAddress,
        error: validatorManagerError,
        isLoading: isLoadingVMCDetails,
        blockchainId,
        contractOwner,
        isOwnerContract,
        contractTotalWeight,
        l1WeightError,
        signingSubnetId,
        isLoadingOwnership,
        isLoadingL1Weight,
        ownershipError,
        ownerType,
        isDetectingOwnerType
    } = useValidatorManagerDetails({ subnetId: subnetIdL1 });

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    // Fetch user's delegations when subnet, wallet, or token type changes
    useEffect(() => {
        const fetchUserDelegations = async () => {
            if (!publicClient || !contractOwner || !walletEVMAddress) {
                setUserDelegations([]);
                return;
            }

            setIsLoadingDelegations(true);
            try {
                // Query InitiatedDelegatorRegistration events for this user
                const logs = await publicClient.getLogs({
                    address: contractOwner as `0x${string}`,
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
                        const delegationID = log.topics[1] as string;
                        const validationID = log.topics[2] as string;

                        try {
                            // Get current delegation info using the appropriate ABI
                            const info = await publicClient.readContract({
                                address: contractOwner as `0x${string}`,
                                abi: contractAbi,
                                functionName: 'getDelegator',
                                args: [delegationID as `0x${string}`],
                            }) as any;

                            return {
                                delegationID,
                                validationID,
                                weight: info.weight?.toString() || '0',
                                owner: info.owner,
                            };
                        } catch (err) {
                            console.warn(`Could not fetch info for delegation ${delegationID}:`, err);
                            return null;
                        }
                    })
                );

                // Filter out null entries and delegations that are no longer active
                const activeDelegations = delegations.filter(d => d !== null && d.weight !== '0');
                setUserDelegations(activeDelegations as any[]);
            } catch (err) {
                console.error('Failed to fetch user delegations:', err);
                setUserDelegations([]);
            } finally {
                setIsLoadingDelegations(false);
            }
        };

        fetchUserDelegations();
    }, [publicClient, contractOwner, walletEVMAddress, tokenType, contractAbi]);

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setDelegationID('');
        setInitiateRemovalTxHash('');
        setRemovalCompleteTxHash('');
        setSubnetIdL1('');
        setResetKey(prev => prev + 1);
    };

    return (
        <>
            <div className="space-y-6">
                {/* Token Type Selector */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                        Staking Token Type
                    </h3>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setTokenType('native')}
                            disabled={!!initiateRemovalTxHash || !!removalCompleteTxHash}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                                tokenType === 'native'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            } ${(initiateRemovalTxHash || removalCompleteTxHash) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className="text-left">
                                <div className="font-semibold text-sm">Native Token</div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                    L1 native token staking
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={() => setTokenType('erc20')}
                            disabled={!!initiateRemovalTxHash || !!removalCompleteTxHash}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                                tokenType === 'erc20'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            } ${(initiateRemovalTxHash || removalCompleteTxHash) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className="text-left">
                                <div className="font-semibold text-sm">ERC20 Token</div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                    Custom ERC20 token staking
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {globalError && (
                    <Alert variant="error">Error: {globalError}</Alert>
                )}

                <Steps>
                    <Step>
                        <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Choose the L1 subnet where you want to remove a delegation with {tokenLabel} staking.
                        </p>
                        <div className="space-y-2">
                            <SelectSubnetId
                                value={subnetIdL1}
                                onChange={setSubnetIdL1}
                                error={validatorManagerError}
                                hidePrimaryNetwork={true}
                            />
                            <ValidatorManagerDetails
                                validatorManagerAddress={validatorManagerAddress}
                                blockchainId={blockchainId}
                                subnetId={subnetIdL1}
                                isLoading={isLoadingVMCDetails}
                                signingSubnetId={signingSubnetId}
                                contractTotalWeight={contractTotalWeight}
                                l1WeightError={l1WeightError}
                                isLoadingL1Weight={isLoadingL1Weight}
                                contractOwner={contractOwner}
                                ownershipError={ownershipError}
                                isLoadingOwnership={isLoadingOwnership}
                                isOwnerContract={isOwnerContract}
                                ownerType={ownerType}
                                isDetectingOwnerType={isDetectingOwnerType}
                                isExpanded={isValidatorManagerDetailsExpanded}
                                onToggleExpanded={() => setIsValidatorManagerDetailsExpanded(!isValidatorManagerDetailsExpanded)}
                            />
                        </div>
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Select Delegation to Remove</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Select the delegation you want to remove. Only your active delegations will be shown.
                        </p>

                        {ownerType && ownerType !== 'StakingManager' && (
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

                        {!isLoadingDelegations && userDelegations.length === 0 && walletEVMAddress && contractOwner && (
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
                                <strong>Uptime Proof:</strong> Including an uptime proof fetches the validator's uptime
                                and may result in higher reward calculations based on the validator's performance.
                            </p>
                        </Alert>

                        <InitiateDelegatorRemoval
                            key={`initiate-${resetKey}-${tokenType}`}
                            delegationID={delegationID}
                            stakingManagerAddress={contractOwner || ''}
                            rpcUrl={viemChain?.rpcUrls?.default?.http[0] || ''}
                            signingSubnetId={signingSubnetId}
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
                            key={`complete-${resetKey}-${tokenType}`}
                            delegationID={delegationID}
                            stakingManagerAddress={contractOwner || ''}
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

                {globalSuccess && (
                    <Success
                        label="Process Complete"
                        value={globalSuccess}
                    />
                )}

                {(initiateRemovalTxHash || removalCompleteTxHash || globalError || globalSuccess) && (
                    <Button onClick={handleReset} variant="secondary" className="mt-6">
                        Reset All Steps
                    </Button>
                )}
            </div>
        </>
    );
};

export default withConsoleToolMetadata(RemoveDelegation, metadata);
