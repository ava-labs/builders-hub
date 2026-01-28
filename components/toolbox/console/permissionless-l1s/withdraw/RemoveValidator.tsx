"use client";

import React, { useState } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';
import SelectValidationID, { ValidationSelection } from '@/components/toolbox/components/SelectValidationID';
import InitiateValidatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/InitiateValidatorRemoval';
import CompleteValidatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/CompleteValidatorRemoval';
import ClaimDelegationFees from '@/components/toolbox/console/permissionless-l1s/withdraw/ClaimDelegationFees';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
    title: "Remove Staking Validator",
    description: "Remove a staking validator from your L1 and claim rewards with optional uptime proof",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

type TokenType = 'native' | 'erc20';

const RemoveValidator: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
    const [tokenType, setTokenType] = useState<TokenType>('native');
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
    const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false);

    // State for passing data between components
    const [validationSelection, setValidationSelection] = useState<ValidationSelection>({
        validationId: '',
        nodeId: ''
    });
    const [initiateRemovalTxHash, setInitiateRemovalTxHash] = useState<string>('');
    const [removalCompleteTxHash, setRemovalCompleteTxHash] = useState<string>('');
    const [feeClaimTxHash, setFeeClaimTxHash] = useState<string>('');

    // Form state
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
    const [resetKey, setResetKey] = useState<number>(0);
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

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setValidationSelection({ validationId: '', nodeId: '' });
        setInitiateRemovalTxHash('');
        setRemovalCompleteTxHash('');
        setFeeClaimTxHash('');
        setSubnetIdL1('');
        setResetKey(prev => prev + 1);
    };

    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

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
                            Choose the L1 subnet where you want to remove a validator with {tokenLabel} staking.
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
                        <h2 className="text-lg font-semibold">Select Validator to Remove</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Select the validator you want to remove. Only your own validators will be shown.
                        </p>

                        {ownerType && ownerType !== 'StakingManager' && (
                            <Alert variant="error" className="mb-4">
                                This L1 is not using a Staking Manager. This tool is only for L1s with {tokenLabel} Staking Managers.
                            </Alert>
                        )}

                        <SelectValidationID
                            value={validationSelection.validationId}
                            onChange={setValidationSelection}
                            subnetId={subnetIdL1}
                            format="hex"
                            error={!subnetIdL1 ? "Please select a subnet first" : null}
                        />

                        {validationSelection.nodeId && (
                            <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                                <p><strong>Selected Validator Node ID:</strong> {validationSelection.nodeId}</p>
                            </div>
                        )}
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Initiate Validator Removal</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Call the <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/StakingManager.sol#L241" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">initiateValidatorRemoval</a> function on the Staking Manager contract.
                            You can optionally include an uptime proof to potentially increase your rewards.
                        </p>

                        <Alert variant="info" className="mb-4">
                            <p className="text-sm">
                                <strong>Uptime Proof:</strong> Including an uptime proof fetches the validator's actual uptime
                                from the network and may result in higher reward calculations. The system will automatically
                                try different signature quorum percentages to ensure successful signing.
                            </p>
                        </Alert>

                        <InitiateValidatorRemoval
                            key={`initiate-${resetKey}-${tokenType}`}
                            validationID={validationSelection.validationId}
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
                        <h2 className="text-lg font-semibold">Complete Validator Removal</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Finalize the validator removal by calling <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/StakingManager.sol" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">completeValidatorRemoval</a>.
                            This will return your staked {tokenLabel.toLowerCase()}s and distribute rewards.
                        </p>

                        <CompleteValidatorRemoval
                            key={`complete-${resetKey}-${tokenType}`}
                            validationID={validationSelection.validationId}
                            stakingManagerAddress={contractOwner || ''}
                            tokenType={tokenType}
                            onSuccess={(data) => {
                                setRemovalCompleteTxHash(data.txHash);
                                setGlobalSuccess(data.message);
                                setGlobalError(null);
                            }}
                            onError={(message) => setGlobalError(message)}
                        />
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Claim Delegation Fees (Optional)</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            If you had delegators, you can claim the accumulated delegation fees separately.
                            These fees are based on the delegation fee percentage you set when registering the validator.
                        </p>

                        <ClaimDelegationFees
                            key={`claim-fees-${resetKey}-${tokenType}`}
                            validationID={validationSelection.validationId}
                            stakingManagerAddress={contractOwner || ''}
                            tokenType={tokenType}
                            onSuccess={(data) => {
                                setFeeClaimTxHash(data.txHash);
                                setGlobalError(null);
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

                {(initiateRemovalTxHash || removalCompleteTxHash || feeClaimTxHash || globalError || globalSuccess) && (
                    <Button onClick={handleReset} variant="secondary" className="mt-6">
                        Reset All Steps
                    </Button>
                )}
            </div>
        </>
    );
};

export default withConsoleToolMetadata(RemoveValidator, metadata);
