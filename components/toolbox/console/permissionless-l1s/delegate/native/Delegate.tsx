"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/toolbox/components/Button';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';
import SelectValidationID, { ValidationSelection } from '@/components/toolbox/components/SelectValidationID';

import InitiateNativeDelegation from '@/components/toolbox/console/permissionless-l1s/delegate/native/InitiateNativeDelegation';
import SubmitPChainTxDelegationWeightChange from '@/components/toolbox/console/permissionless-l1s/delegate/native/SubmitPChainTxDelegationWeightChange';
import CompleteDelegatorRegistration from '@/components/toolbox/console/permissionless-l1s/delegate/native/CompleteDelegatorRegistration';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
    title: "Delegate to Validator",
    description: "Delegate your native tokens to an existing validator on your L1",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
        WalletRequirementsConfigKey.PChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

const DelegateToValidator: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
    const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false);

    // State for passing data between components
    const [validationSelection, setValidationSelection] = useState<ValidationSelection>({
        validationId: '',
        nodeId: ''
    });
    const [delegationID, setDelegationID] = useState<string>('');
    const [pChainTxId, setPChainTxId] = useState<string>('');
    const [evmTxHash, setEvmTxHash] = useState<string>('');
    const [eventData, setEventData] = useState<{
        validationID: `0x${string}`;
        nonce: bigint;
        weight: bigint;
        messageID: `0x${string}`;
    } | null>(null);

    // Form state
    const { isTestnet } = useWalletStore();
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
    const [resetKey, setResetKey] = useState<number>(0);
    const [userPChainBalanceNavax, setUserPChainBalanceNavax] = useState<bigint | null>(null);

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
        setDelegationID('');
        setPChainTxId('');
        setEvmTxHash('');
        setEventData(null);
        setSubnetIdL1('');
        setResetKey(prev => prev + 1); // Force re-render of all child components
    };

    return (
        <>
            <div className="space-y-6">
                {globalError && (
                    <Alert variant="error">Error: {globalError}</Alert>
                )}

                <Steps>
                    <Step>
                        <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Choose the L1 subnet where you want to delegate to a validator.
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
                        <h2 className="text-lg font-semibold">Select Validator to Delegate To</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Select the validator you want to delegate to. The dropdown shows all active validators with their weights and remaining balances.
                        </p>

                        {ownerType && ownerType !== 'StakingManager' && (
                            <Alert variant="error" className="mb-4">
                                This L1 is not using a Staking Manager. This tool is only for L1s with Native Token Staking Managers that support delegation.
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
                        <h2 className="text-lg font-semibold">Initiate Delegation</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Call the <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/NativeTokenStakingManager.sol" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">initiateDelegatorRegistration</a> function on the Native Token Staking Manager contract with your delegation amount. This transaction will emit a warp message for P-Chain registration.
                        </p>

                        <InitiateNativeDelegation
                            key={`initiate-${resetKey}`}
                            subnetId={subnetIdL1}
                            stakingManagerAddress={contractOwner || ''}
                            validationID={validationSelection.validationId}
                            onSuccess={(data) => {
                                setDelegationID(data.delegationID);
                                setEvmTxHash(data.txHash);
                                setGlobalError(null);
                            }}
                            onError={(message) => setGlobalError(message)}
                        />
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Submit SetL1ValidatorWeightTx to P-Chain</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Sign the emitted warp message and submit a SetL1ValidatorWeightTx to P-Chain. This transaction will update the validator's weight to include your delegation.
                        </p>
                        <SubmitPChainTxDelegationWeightChange
                            key={`submit-pchain-${resetKey}`}
                            subnetIdL1={subnetIdL1}
                            initialEvmTxHash={evmTxHash}
                            signingSubnetId={signingSubnetId}
                            onSuccess={(pChainTxId, data) => {
                                setPChainTxId(pChainTxId);
                                setEventData(data);
                                setGlobalError(null);
                            }}
                            onError={(message) => setGlobalError(message)}
                        />
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Complete Delegator Registration</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Complete the delegator registration by signing the P-Chain L1ValidatorRegistrationMessage and calling the <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/NativeTokenStakingManager.sol" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">completeDelegatorRegistration</a> function on the Staking Manager contract.
                        </p>
                        <CompleteDelegatorRegistration
                            key={`complete-registration-${resetKey}`}
                            subnetIdL1={subnetIdL1}
                            delegationID={delegationID}
                            pChainTxId={pChainTxId}
                            stakingManagerAddress={contractOwner || ''}
                            signingSubnetId={signingSubnetId}
                            onSuccess={(message) => {
                                setGlobalSuccess(message);
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

                {(pChainTxId || globalError || globalSuccess) && (
                    <Button onClick={handleReset} variant="secondary" className="mt-6">
                        Reset All Steps
                    </Button>
                )}
            </div>
        </>
    );
};

export default withConsoleToolMetadata(DelegateToValidator, metadata);