'use client';

import React, { useState } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import SelectValidationID, { type ValidationSelection } from '@/components/toolbox/components/SelectValidationID';
import { useRemovePoSValidatorStore } from '@/components/toolbox/stores/removePoSValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { Alert } from '@/components/toolbox/components/Alert';

export default function SelectL1ValidatorStep() {
  const store = useRemovePoSValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSubnetChange = (value: string) => {
    store.setSubnetIdL1(value);
  };

  const handleValidationChange = (selection: ValidationSelection) => {
    store.setValidationId(selection.validationId);
    store.setNodeId(selection.nodeId);
  };

  // Auto-detect staking type from context
  const detectedType = vmcCtx.staking?.stakingType;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">Choose the L1 subnet where you want to remove a validator.</p>
          <SelectSubnetId
            value={store.subnetIdL1}
            onChange={handleSubnetChange}
            error={vmcCtx.error}
            hidePrimaryNetwork={true}
          />
          {detectedType && (
            <p className="text-xs text-zinc-500">
              Detected:{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                {detectedType} Token Staking
              </span>
            </p>
          )}
        </div>
        {store.subnetIdL1 && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <ValidatorManagerDetails
              validatorManagerAddress={vmcCtx.validatorManagerAddress}
              blockchainId={vmcCtx.blockchainId}
              subnetId={store.subnetIdL1}
              isLoading={vmcCtx.isLoading}
              signingSubnetId={vmcCtx.signingSubnetId}
              contractTotalWeight={vmcCtx.contractTotalWeight}
              l1WeightError={vmcCtx.l1WeightError}
              isLoadingL1Weight={vmcCtx.isLoadingL1Weight}
              contractOwner={vmcCtx.contractOwner}
              ownershipError={vmcCtx.ownershipError}
              isLoadingOwnership={vmcCtx.isLoadingOwnership}
              isOwnerContract={vmcCtx.isOwnerContract}
              ownerType={vmcCtx.ownerType}
              isDetectingOwnerType={vmcCtx.isDetectingOwnerType}
              isExpanded={isExpanded}
              onToggleExpanded={() => setIsExpanded((prev) => !prev)}
            />
          </div>
        )}
      </div>

      {store.subnetIdL1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Select Validator to Remove</h3>
          <p className="text-sm text-gray-500">
            Select the validator you want to remove. Only validators with weight are shown.
          </p>

          {vmcCtx.ownerType && vmcCtx.ownerType !== 'StakingManager' && (
            <Alert variant="error">
              This L1 is not using a Staking Manager. This tool is only for permissionless L1s.
            </Alert>
          )}

          <SelectValidationID
            value={store.validationId}
            onChange={handleValidationChange}
            subnetId={store.subnetIdL1}
            format="hex"
            error={!store.subnetIdL1 ? 'Please select a subnet first' : null}
          />

          {store.nodeId && (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              <p>
                <strong>Selected Validator Node ID:</strong> {store.nodeId}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
