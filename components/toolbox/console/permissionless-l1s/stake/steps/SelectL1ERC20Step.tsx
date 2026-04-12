'use client';

import React, { useState, useEffect } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { ValidatorListInput, type ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import {
  useStakeValidatorStore,
  useStakeValidatorStoreApi,
  deserializeStakeValidators,
  serializeStakeValidators,
} from '@/components/toolbox/stores/stakeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Alert } from '@/components/toolbox/components/Alert';

export default function SelectL1ERC20Step() {
  const store = useStakeValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const { pChainAddress, pChainBalance, isTestnet } = useWalletStore();

  const storeApi = useStakeValidatorStoreApi();
  const setTokenType = storeApi((s) => s.setTokenType);

  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(true);

  const userPChainBalanceNavax = pChainBalance ? BigInt(Math.floor(pChainBalance * 1e9)) : null;
  const validators = deserializeStakeValidators(store.validators);

  useEffect(() => {
    setTokenType('erc20');
  }, [setTokenType]);

  const handleValidatorsChange = (newValidators: ConvertToL1Validator[]) => {
    store.setValidators(serializeStakeValidators(newValidators));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Select L1 & Validator (ERC20 Token)</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Choose the L1 subnet and add validator details for ERC20 token staking.
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

        <ValidatorListInput
          validators={validators}
          onChange={handleValidatorsChange}
          defaultAddress={pChainAddress ?? ''}
          label=""
          userPChainBalanceNavax={userPChainBalanceNavax}
          maxValidators={1}
          selectedSubnetId={store.subnetIdL1}
          isTestnet={isTestnet}
          hideConsensusWeight={true}
        />
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
