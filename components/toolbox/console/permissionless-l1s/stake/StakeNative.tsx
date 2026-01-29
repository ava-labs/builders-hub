"use client";

import React, { useState } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';
import { Input } from '@/components/toolbox/components/Input';
import InitiateValidatorRegistration from '@/components/toolbox/console/permissionless-l1s/stake/InitiateValidatorRegistration';
import CompleteValidatorRegistration from '@/components/toolbox/console/permissionless-l1s/stake/CompleteValidatorRegistration';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
    title: "Stake Validator (Native Token)",
    description: "Register and stake a new validator on your L1 with native tokens",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

const StakeNative: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
    const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false);

    // State for passing data between components
    const [nodeID, setNodeID] = useState<string>('');
    const [blsPublicKey, setBlsPublicKey] = useState<string>('');
    const [validationID, setValidationID] = useState<string>('');
    const [initiateRegistrationTxHash, setInitiateRegistrationTxHash] = useState<string>('');
    const [completeRegistrationTxHash, setCompleteRegistrationTxHash] = useState<string>('');

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
        setNodeID('');
        setBlsPublicKey('');
        setValidationID('');
        setInitiateRegistrationTxHash('');
        setCompleteRegistrationTxHash('');
        setSubnetIdL1('');
        setResetKey(prev => prev + 1);
    };

    return (
        <>
            <div className="space-y-6">
                {/* Token Type Indicator */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-500">
                    <div className="font-semibold text-sm mb-1">Native Token Staking</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        You are staking with the L1's native tokens
                    </div>
                </div>

                {globalError && (
                    <Alert variant="error">Error: {globalError}</Alert>
                )}

                <Steps>
                    <Step>
                        <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Choose the L1 subnet where you want to register a validator with Native Token staking.
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
                        <h2 className="text-lg font-semibold">Enter Validator Details</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Provide your validator's Node ID and BLS Public Key.
                        </p>

                        {ownerType && ownerType !== 'StakingManager' && (
                            <Alert variant="error" className="mb-4">
                                This L1 is not using a Staking Manager. This tool is only for L1s with Native Token Staking Managers.
                            </Alert>
                        )}

                        <div className="space-y-3">
                            <Input
                                label="Node ID"
                                value={nodeID}
                                onChange={setNodeID}
                                placeholder="0x..."
                                helperText="Your validator's Node ID from the P-Chain"
                            />

                            <Input
                                label="BLS Public Key"
                                value={blsPublicKey}
                                onChange={setBlsPublicKey}
                                placeholder="0x..."
                                helperText="Your validator's BLS public key for signing"
                            />
                        </div>
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Initiate Validator Registration</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Register your validator on the staking manager contract and lock your native token stake.
                        </p>

                        <InitiateValidatorRegistration
                            key={`initiate-${resetKey}-native`}
                            nodeID={nodeID}
                            blsPublicKey={blsPublicKey}
                            stakingManagerAddress={contractOwner || ''}
                            tokenType="native"
                            onSuccess={(data) => {
                                setInitiateRegistrationTxHash(data.txHash);
                                setValidationID(data.validationID);
                                setGlobalError(null);
                            }}
                            onError={(message) => setGlobalError(message)}
                        />
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Submit P-Chain Transaction</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            After initiating registration, you need to submit a transaction on the P-Chain
                            to actually register the validator on the network.
                        </p>

                        <Alert variant="info">
                            <p className="text-sm mb-2">
                                <strong>Use AvalancheGo CLI or Core Wallet:</strong>
                            </p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                <li>Use your validation ID from the previous step</li>
                                <li>Submit an AddL1ValidatorTx on the P-Chain</li>
                                <li>Wait for the transaction to be confirmed</li>
                                <li>Once confirmed, proceed to complete registration</li>
                            </ul>
                        </Alert>

                        {validationID && (
                            <div className="mt-4">
                                <Success
                                    label="Your Validation ID"
                                    value={validationID}
                                />
                            </div>
                        )}
                    </Step>

                    <Step>
                        <h2 className="text-lg font-semibold">Complete Validator Registration</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            After the P-Chain transaction is confirmed, complete the registration
                            to activate your validator on the L1.
                        </p>

                        <CompleteValidatorRegistration
                            key={`complete-${resetKey}-native`}
                            validationID={validationID}
                            stakingManagerAddress={contractOwner || ''}
                            tokenType="native"
                            onSuccess={(data) => {
                                setCompleteRegistrationTxHash(data.txHash);
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

                {(initiateRegistrationTxHash || completeRegistrationTxHash || globalError || globalSuccess) && (
                    <Button onClick={handleReset} variant="secondary" className="mt-6">
                        Reset All Steps
                    </Button>
                )}
            </div>
        </>
    );
};

export default withConsoleToolMetadata(StakeNative, metadata);
