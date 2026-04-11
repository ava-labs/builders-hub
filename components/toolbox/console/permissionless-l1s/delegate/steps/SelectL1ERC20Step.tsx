'use client';

import React, { useState, useEffect } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import SelectValidationID from '@/components/toolbox/components/SelectValidationID';
import { useDelegateStore, useDelegateStoreApi } from '@/components/toolbox/stores/delegateStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { Alert } from '@/components/toolbox/components/Alert';

export default function SelectL1ERC20Step() {
  const store = useDelegateStore();
  const vmcCtx = useValidatorManagerContext();
  const createChainStoreSubnetId = useCreateChainStore()((state: { subnetId: string }) => state.subnetId);

  // Stable setter references via selector — avoids infinite loop from
  // subscribing to the entire store object in useEffect deps.
  const storeApi = useDelegateStoreApi();
  const setTokenType = storeApi((s) => s.setTokenType);
  const setSubnetIdL1 = storeApi((s) => s.setSubnetIdL1);

  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(true);

  useEffect(() => {
    if (!store.subnetIdL1 && createChainStoreSubnetId) {
      setSubnetIdL1(createChainStoreSubnetId);
    }
  }, [store.subnetIdL1, createChainStoreSubnetId, setSubnetIdL1]);

  useEffect(() => {
    setTokenType('erc20');
  }, [setTokenType]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Select L1 & Validator (ERC20 Token)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Choose the L1 subnet and select an active validator to delegate your ERC20 tokens to.
        </p>
        <SelectSubnetId
          value={store.subnetIdL1}
          onChange={store.setSubnetIdL1}
          error={vmcCtx.error}
          hidePrimaryNetwork={true}
        />

        {vmcCtx.ownerType && vmcCtx.ownerType !== 'StakingManager' && (
          <Alert variant="error">
            This L1 is not using a Staking Manager. This tool is only for L1s with ERC20 Token Staking Managers.
          </Alert>
        )}

        <SelectValidationID
          value={store.validationId}
          onChange={(selection) => {
            store.setValidationId(selection.validationId);
            store.setNodeId(selection.nodeId);
          }}
          format="hex"
          subnetId={store.subnetIdL1}
        />

        {store.nodeId && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-700 dark:text-green-300 font-medium">Selected Validator</p>
            <p className="text-sm font-mono text-green-900 dark:text-green-100 mt-1">{store.nodeId}</p>
          </div>
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
            isExpanded={isValidatorManagerDetailsExpanded}
            onToggleExpanded={() => setIsValidatorManagerDetailsExpanded((prev) => !prev)}
          />
        </div>
      )}
    </div>
  );
}
