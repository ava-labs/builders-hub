"use client";

import React, { useState } from 'react';
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';
import { Input } from '@/components/toolbox/components/Input';
import InitiateDelegation from '@/components/toolbox/console/permissionless-l1s/delegate/InitiateDelegation';
import CompleteDelegation from '@/components/toolbox/console/permissionless-l1s/delegate/CompleteDelegation';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { BaseConsoleToolProps } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { L1SubnetStep, StepFlowFooter, useL1SubnetState } from '../shared';

export type TokenType = 'native' | 'erc20';

export interface DelegateValidatorProps extends BaseConsoleToolProps {
    tokenType: TokenType;
}

export default function DelegateValidator({ tokenType, onSuccess }: DelegateValidatorProps) {
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

    // State for passing data between components
    const [validationID, setValidationID] = useState<string>('');
    const [delegationID, setDelegationID] = useState<string>('');
    const [initiateDelegationTxHash, setInitiateDelegationTxHash] = useState<string>('');
    const [completeDelegationTxHash, setCompleteDelegationTxHash] = useState<string>('');

    const { exampleErc20Address } = useToolboxStore();
    const l1State = useL1SubnetState();
    const { validatorManagerDetails } = l1State;

    const isNative = tokenType === 'native';
    const tokenLabel = isNative ? 'Native Token' : 'ERC20 Token';

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setValidationID('');
        setDelegationID('');
        setInitiateDelegationTxHash('');
        setCompleteDelegationTxHash('');
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
                    description={`Choose the L1 subnet where you want to delegate ${tokenLabel}s to a validator.`}
                    validatorManagerDetails={validatorManagerDetails}
                    validatorManagerError={validatorManagerDetails.error}
                    isExpanded={l1State.isValidatorManagerDetailsExpanded}
                    onToggleExpanded={l1State.toggleValidatorManagerDetails}
                />

                <Step>
                    <h2 className="text-lg font-semibold">Select Validator</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Enter the validation ID of the validator you want to delegate to.
                    </p>

                    {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
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
                        Lock your {isNative ? 'native' : 'ERC20'} tokens to delegate to the selected validator.
                        {!isNative && ' You will need to approve ERC20 tokens first.'}
                    </p>

                    <InitiateDelegation
                        key={`initiate-${l1State.resetKey}-${tokenType}`}
                        validationID={validationID}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
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
                        to update the validator&apos;s weight with your delegation.
                    </p>

                    <Alert variant="info">
                        <p className="text-sm mb-2">
                            <strong>Use AvalancheGo CLI or Core Wallet:</strong>
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                            <li>Use your delegation ID from the previous step</li>
                            <li>Submit a transaction to increase the validator&apos;s weight on the P-Chain</li>
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
                        key={`complete-${l1State.resetKey}-${tokenType}`}
                        delegationID={delegationID}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
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

            <StepFlowFooter
                globalSuccess={globalSuccess}
                showReset={!!(initiateDelegationTxHash || completeDelegationTxHash || globalError || globalSuccess)}
                onReset={handleReset}
            />
        </div>
    );
}
