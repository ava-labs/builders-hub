"use client";

import React, { useState } from 'react';
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';
import InitiateDelegation from '@/components/toolbox/console/permissionless-l1s/delegate/InitiateDelegation';
import SubmitPChainTxWeightUpdate from '@/components/toolbox/console/shared/SubmitPChainTxWeightUpdate';
import CompletePChainWeightUpdate from '@/components/toolbox/console/shared/CompletePChainWeightUpdate';
import SelectValidationID, { ValidationSelection } from '@/components/toolbox/components/SelectValidationID';
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
    const [validatorSelection, setValidatorSelection] = useState<ValidationSelection>({ validationId: '', nodeId: '' });
    const [delegationID, setDelegationID] = useState<string>('');
    const [initiateDelegationTxHash, setInitiateDelegationTxHash] = useState<string>('');
    const [pChainTxId, setPChainTxId] = useState<string>('');
    const [completeDelegationTxHash, setCompleteDelegationTxHash] = useState<string>('');

    const { exampleErc20Address } = useToolboxStore();
    const l1State = useL1SubnetState();
    const { validatorManagerDetails } = l1State;

    const isNative = tokenType === 'native';
    const tokenLabel = isNative ? 'Native Token' : 'ERC20 Token';

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setValidatorSelection({ validationId: '', nodeId: '' });
        setDelegationID('');
        setInitiateDelegationTxHash('');
        setPChainTxId('');
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
                        Choose an active validator to delegate your {tokenLabel.toLowerCase()}s to.
                    </p>

                    {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
                        <Alert variant="error" className="mb-4">
                            This L1 is not using a Staking Manager. This tool is only for L1s with {tokenLabel} Staking Managers.
                        </Alert>
                    )}

                    <SelectValidationID
                        value={validatorSelection.validationId}
                        onChange={setValidatorSelection}
                        format="hex"
                        subnetId={l1State.subnetIdL1}
                    />

                    {validatorSelection.nodeId && (
                        <div className="mt-3 bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                            <p className="text-xs text-green-700 dark:text-green-300 font-medium">Selected Validator</p>
                            <p className="text-sm font-mono text-green-900 dark:text-green-100 mt-1">
                                {validatorSelection.nodeId}
                            </p>
                        </div>
                    )}
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Initiate Delegation</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Lock your {isNative ? 'native' : 'ERC20'} tokens to delegate to the selected validator.
                        {!isNative && ' You will need to approve ERC20 tokens first.'}
                    </p>

                    <InitiateDelegation
                        key={`initiate-${l1State.resetKey}-${tokenType}`}
                        validationID={validatorSelection.validationId}
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
                        Sign the warp message and submit the weight update to the P-Chain.
                    </p>

                    <SubmitPChainTxWeightUpdate
                        key={`pchain-${l1State.resetKey}-${tokenType}`}
                        subnetIdL1={l1State.subnetIdL1}
                        initialEvmTxHash={initiateDelegationTxHash}
                        signingSubnetId={l1State.subnetIdL1}
                        txHashLabel="Initiate Delegation Transaction Hash"
                        txHashPlaceholder="Enter the transaction hash from Step 3 (0x...)"
                        additionalInfo={delegationID ? (
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                                <p><strong>Delegation ID:</strong></p>
                                <p className="font-mono text-xs break-all">{delegationID}</p>
                            </div>
                        ) : undefined}
                        onSuccess={(txId) => {
                            setPChainTxId(txId);
                            setGlobalError(null);
                        }}
                        onError={(message) => setGlobalError(message)}
                    />
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Complete Delegation</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        After the P-Chain transaction is confirmed, complete the delegation
                        to activate your delegation on the L1.
                    </p>

                    <CompletePChainWeightUpdate
                        key={`complete-${l1State.resetKey}-${tokenType}`}
                        subnetIdL1={l1State.subnetIdL1}
                        pChainTxId={pChainTxId}
                        signingSubnetId={l1State.subnetIdL1}
                        updateType="Delegation"
                        managerAddress={validatorManagerDetails.contractOwner || ''}
                        delegationID={delegationID}
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
                showReset={!!(initiateDelegationTxHash || pChainTxId || completeDelegationTxHash || globalError || globalSuccess)}
                onReset={handleReset}
            />
        </div>
    );
}
