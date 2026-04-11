'use client';

import React, { useState } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import SelectValidationID, { type ValidationSelection } from '@/components/toolbox/components/SelectValidationID';
import { useRemovePoSValidatorStore } from '@/components/toolbox/stores/removePoSValidatorStore';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { Alert } from '@/components/toolbox/components/Alert';

export default function SelectL1ValidatorNativeStep() {
  const store = useRemovePoSValidatorStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const validatorManagerDetails = useValidatorManagerDetails({ subnetId: store.subnetIdL1 });

  const handleSubnetChange = (value: string) => {
    store.setSubnetIdL1(value);
    store.setTokenType('native');
  };

  const handleValidationChange = (selection: ValidationSelection) => {
    store.setValidationId(selection.validationId);
    store.setNodeId(selection.nodeId);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 mb-4">
            Choose the L1 subnet where you want to remove a validator using Native Token staking.
          </p>
          <SelectSubnetId
            value={store.subnetIdL1}
            onChange={handleSubnetChange}
            error={validatorManagerDetails.error}
            hidePrimaryNetwork={true}
          />
        </div>
        {store.subnetIdL1 && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <ValidatorManagerDetails
              validatorManagerAddress={validatorManagerDetails.validatorManagerAddress}
              blockchainId={validatorManagerDetails.blockchainId}
              subnetId={store.subnetIdL1}
              isLoading={validatorManagerDetails.isLoading}
              signingSubnetId={validatorManagerDetails.signingSubnetId}
              contractTotalWeight={validatorManagerDetails.contractTotalWeight}
              l1WeightError={validatorManagerDetails.l1WeightError}
              isLoadingL1Weight={validatorManagerDetails.isLoadingL1Weight}
              contractOwner={validatorManagerDetails.contractOwner}
              ownershipError={validatorManagerDetails.ownershipError}
              isLoadingOwnership={validatorManagerDetails.isLoadingOwnership}
              isOwnerContract={validatorManagerDetails.isOwnerContract}
              ownerType={validatorManagerDetails.ownerType}
              isDetectingOwnerType={validatorManagerDetails.isDetectingOwnerType}
              isExpanded={isExpanded}
              onToggleExpanded={() => setIsExpanded((prev) => !prev)}
            />
          </div>
        )}
      </div>

      {store.subnetIdL1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Select Validator to Remove</h3>
          <p className="text-sm text-zinc-500">
            Select the validator you want to remove. Only validators with weight are shown.
          </p>

          {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
            <Alert variant="error">
              This L1 is not using a Staking Manager. This tool is only for L1s with Native Token Staking Managers.
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
