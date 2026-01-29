"use client";

import React, { useState } from 'react';
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';
import { Input } from '@/components/toolbox/components/Input';
import InitiateValidatorRegistration from '@/components/toolbox/console/permissionless-l1s/stake/InitiateValidatorRegistration';
import CompleteValidatorRegistration from '@/components/toolbox/console/permissionless-l1s/stake/CompleteValidatorRegistration';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { BaseConsoleToolProps } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { L1SubnetStep, StepFlowFooter, useL1SubnetState } from '../shared';

export type TokenType = 'native' | 'erc20';

export interface StakeValidatorProps extends BaseConsoleToolProps {
    tokenType: TokenType;
}

export default function StakeValidator({ tokenType, onSuccess }: StakeValidatorProps) {
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

    // State for passing data between components
    const [nodeID, setNodeID] = useState<string>('');
    const [blsPublicKey, setBlsPublicKey] = useState<string>('');
    const [validationID, setValidationID] = useState<string>('');
    const [initiateRegistrationTxHash, setInitiateRegistrationTxHash] = useState<string>('');
    const [completeRegistrationTxHash, setCompleteRegistrationTxHash] = useState<string>('');

    const { exampleErc20Address } = useToolboxStore();
    const l1State = useL1SubnetState();
    const { validatorManagerDetails } = l1State;

    const isNative = tokenType === 'native';
    const tokenLabel = isNative ? 'Native Token' : 'ERC20 Token';

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setNodeID('');
        setBlsPublicKey('');
        setValidationID('');
        setInitiateRegistrationTxHash('');
        setCompleteRegistrationTxHash('');
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
                    description={`Choose the L1 subnet where you want to register a validator with ${tokenLabel} staking.`}
                    validatorManagerDetails={validatorManagerDetails}
                    validatorManagerError={validatorManagerDetails.error}
                    isExpanded={l1State.isValidatorManagerDetailsExpanded}
                    onToggleExpanded={l1State.toggleValidatorManagerDetails}
                />

                <Step>
                    <h2 className="text-lg font-semibold">Enter Validator Details</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Provide your validator&apos;s Node ID and BLS Public Key.
                    </p>

                    {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
                        <Alert variant="error" className="mb-4">
                            This L1 is not using a Staking Manager. This tool is only for L1s with {tokenLabel} Staking Managers.
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
                        Register your validator on the staking manager contract and lock your {isNative ? 'native token' : 'ERC20 token'} stake.
                        {!isNative && ' You will need to approve ERC20 tokens first.'}
                    </p>

                    <InitiateValidatorRegistration
                        key={`initiate-${l1State.resetKey}-${tokenType}`}
                        nodeID={nodeID}
                        blsPublicKey={blsPublicKey}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
                        tokenType={tokenType}
                        erc20TokenAddress={!isNative ? exampleErc20Address : undefined}
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
                        key={`complete-${l1State.resetKey}-${tokenType}`}
                        validationID={validationID}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
                        tokenType={tokenType}
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

            <StepFlowFooter
                globalSuccess={globalSuccess}
                showReset={!!(initiateRegistrationTxHash || completeRegistrationTxHash || globalError || globalSuccess)}
                onReset={handleReset}
            />
        </div>
    );
}
