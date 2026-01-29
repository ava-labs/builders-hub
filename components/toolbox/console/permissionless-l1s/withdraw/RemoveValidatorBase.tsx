"use client";

import React, { useState } from 'react';
import { Steps, Step } from "fumadocs-ui/components/steps";
import SelectValidationID, { ValidationSelection } from '@/components/toolbox/components/SelectValidationID';
import InitiateValidatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/InitiateValidatorRemoval';
import CompleteValidatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/CompleteValidatorRemoval';
import ClaimDelegationFees from '@/components/toolbox/console/permissionless-l1s/withdraw/ClaimDelegationFees';
import { BaseConsoleToolProps } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { L1SubnetStep, StepFlowFooter, useL1SubnetState } from '../shared';

export type TokenType = 'native' | 'erc20';

export interface RemoveValidatorBaseProps extends BaseConsoleToolProps {
    tokenType: TokenType;
}

export default function RemoveValidatorBase({ tokenType }: RemoveValidatorBaseProps) {
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

    // State for passing data between components
    const [validationSelection, setValidationSelection] = useState<ValidationSelection>({
        validationId: '',
        nodeId: ''
    });
    const [initiateRemovalTxHash, setInitiateRemovalTxHash] = useState<string>('');
    const [removalCompleteTxHash, setRemovalCompleteTxHash] = useState<string>('');
    const [feeClaimTxHash, setFeeClaimTxHash] = useState<string>('');

    const l1State = useL1SubnetState();
    const { validatorManagerDetails, viemChain } = l1State;

    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setValidationSelection({ validationId: '', nodeId: '' });
        setInitiateRemovalTxHash('');
        setRemovalCompleteTxHash('');
        setFeeClaimTxHash('');
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
                    description="Choose the L1 subnet where you want to remove a validator."
                    validatorManagerDetails={validatorManagerDetails}
                    validatorManagerError={validatorManagerDetails.error}
                    isExpanded={l1State.isValidatorManagerDetailsExpanded}
                    onToggleExpanded={l1State.toggleValidatorManagerDetails}
                />

                <Step>
                    <h2 className="text-lg font-semibold">Select Validator to Remove</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Select the validator you want to remove. Only your own validators will be shown.
                    </p>

                    {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
                        <Alert variant="error" className="mb-4">
                            This L1 is not using a Staking Manager. This tool is only for L1s with {tokenLabel} Staking Managers.
                        </Alert>
                    )}

                    <SelectValidationID
                        value={validationSelection.validationId}
                        onChange={setValidationSelection}
                        subnetId={l1State.subnetIdL1}
                        format="hex"
                        error={!l1State.subnetIdL1 ? "Please select a subnet first" : null}
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
                            <strong>Uptime Proof:</strong> Including an uptime proof fetches the validator&apos;s actual uptime
                            from the network and may result in higher reward calculations. The system will automatically
                            try different signature quorum percentages to ensure successful signing.
                        </p>
                    </Alert>

                    <InitiateValidatorRemoval
                        key={`initiate-${l1State.resetKey}-${tokenType}`}
                        validationID={validationSelection.validationId}
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
                    <h2 className="text-lg font-semibold">Complete Validator Removal</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Finalize the validator removal by calling <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/StakingManager.sol" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">completeValidatorRemoval</a>.
                        This will return your staked {tokenType === 'native' ? 'native' : 'ERC20'} tokens and distribute rewards.
                    </p>

                    <CompleteValidatorRemoval
                        key={`complete-${l1State.resetKey}-${tokenType}`}
                        validationID={validationSelection.validationId}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
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
                        key={`claim-fees-${l1State.resetKey}-${tokenType}`}
                        validationID={validationSelection.validationId}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
                        tokenType={tokenType}
                        onSuccess={(data) => {
                            setFeeClaimTxHash(data.txHash);
                            setGlobalError(null);
                        }}
                        onError={(message) => setGlobalError(message)}
                    />
                </Step>
            </Steps>

            <StepFlowFooter
                globalSuccess={globalSuccess}
                showReset={!!(initiateRemovalTxHash || removalCompleteTxHash || feeClaimTxHash || globalError || globalSuccess)}
                onReset={handleReset}
            />
        </div>
    );
}
