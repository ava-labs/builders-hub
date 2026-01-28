"use client";

import React, { useState } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';
import { Input } from '@/components/toolbox/components/Input';
import InitiateDelegation from '@/components/toolbox/console/permissionless-l1s/delegate/InitiateDelegation';
import CompleteDelegation from '@/components/toolbox/console/permissionless-l1s/delegate/CompleteDelegation';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
    title: "Delegate to Validator",
    description: "Delegate tokens to an existing validator on your L1",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

type TokenType = 'native' | 'erc20';

const Delegate: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
    const [tokenType, setTokenType] = useState<TokenType>('native');
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
    const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false);

    // State for passing data between components
    const [validationID, setValidationID] = useState<string>('');
    const [delegationID, setDelegationID] = useState<string>('');
    const [initiateDelegationTxHash, setInitiateDelegationTxHash] = useState<string>('');
    const [completeDelegationTxHash, setCompleteDelegationTxHash] = useState<string>('');

    // Form state
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
    const [resetKey, setResetKey] = useState<number>(0);
    const viemChain = useViemChainStore();
    const { exampleErc20Address } = useToolboxStore();

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

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setValidationID('');
        setDelegationID('');
        setInitiateDelegationTxHash('');
        setCompleteDelegationTxHash('');
        setSubnetIdL1('');
        setResetKey(prev => prev + 1);
    };

    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';
    const isNative = tokenType === 'native';

    return (
        <>
            <div className="space-y-6">
                {/* Token Type Selector */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                        Delegation Token Type
                    </h3>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setTokenType('native')}
                            disabled={!!initiateDelegationTxHash || !!completeDelegationTxHash}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                                tokenType === 'native'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            } ${(initiateDelegationTxHash || completeDelegationTxHash) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className="text-left">
                                <div className="font-semibold text-sm">Native Token</div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                    Delegate L1 native tokens
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={() => setTokenType('erc20')}
                            disabled={!!initiateDelegationTxHash || !!completeDelegationTxHash}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                                tokenType === 'erc20'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            } ${(initiateDelegationTxHash || completeDelegationTxHash) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className="text-left">
                                <div className="font-semibold text-sm">ERC20 Token</div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                    Delegate custom ERC20 tokens
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
                            Choose the L1 subnet where you want to delegate {tokenLabel}s to a validator.
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
                        <h2 className="text-lg font-semibold">Select Validator</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Enter the validation ID of the validator you want to delegate to.
                        </p>

                        {ownerType && ownerType !== 'StakingManager' && (
                            <Alert variant="error" className="mb-4">
                                This L1 is not using a Staking Manager. This tool is only for L1s with {tokenLabel} Staking Managers.
                            </Alert>
                        )}

                        <div className="space-y-3">
                            <Input
                                label="Validation ID"
                                value={validationID}
                                onChange={setValidationID}
                                placeholder="0x..."
                                helperText="The validation ID of the active validator you want to delegate to"
                            />
                        </div>
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Initiate Delegation</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Lock your tokens to delegate to the selected validator.
                            {!isNative && ' You will need to approve ERC20 tokens first.'}
                        </p>

                        <InitiateDelegation
                            key={`initiate-${resetKey}-${tokenType}`}
                            validationID={validationID}
                            stakingManagerAddress={contractOwner || ''}
                            tokenType={tokenType}
                            erc20TokenAddress={!isNative ? exampleErc20Address : undefined}
                            onSuccess={(data) => {
                                setInitiateDelegationTxHash(data.txHash);
                                setDelegationID(data.delegationID);
                                setGlobalError(null);
                            }}
                            onError={(message) => setGlobalError(message)}
                        />
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Submit P-Chain Transaction</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            After initiating delegation, you need to submit a transaction on the P-Chain
                            to update the validator's weight with your delegation.
                        </p>

                        <Alert variant="info">
                            <p className="text-sm mb-2">
                                <strong>Use AvalancheGo CLI or Core Wallet:</strong>
                            </p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                <li>Use your delegation ID from the previous step</li>
                                <li>Submit a transaction to increase the validator's weight on the P-Chain</li>
                                <li>Wait for the transaction to be confirmed</li>
                                <li>Once confirmed, proceed to complete delegation</li>
                            </ul>
                        </Alert>

                        {delegationID && (
                            <div className="mt-4">
                                <Success
                                    label="Your Delegation ID"
                                    value={delegationID}
                                />
                            </div>
                        )}
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Complete Delegation</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            After the P-Chain transaction is confirmed, complete the delegation
                            to activate your delegation on the L1.
                        </p>

                        <CompleteDelegation
                            key={`complete-${resetKey}-${tokenType}`}
                            delegationID={delegationID}
                            stakingManagerAddress={contractOwner || ''}
                            tokenType={tokenType}
                            onSuccess={(data) => {
                                setCompleteDelegationTxHash(data.txHash);
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

                {(initiateDelegationTxHash || completeDelegationTxHash || globalError || globalSuccess) && (
                    <Button onClick={handleReset} variant="secondary" className="mt-6">
                        Reset All Steps
                    </Button>
                )}
            </div>
        </>
    );
};

export default withConsoleToolMetadata(Delegate, metadata);
