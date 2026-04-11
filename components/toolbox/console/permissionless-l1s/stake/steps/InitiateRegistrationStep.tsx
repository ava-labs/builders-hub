'use client';

import React from 'react';
import InitiateValidatorRegistration from '@/components/toolbox/console/permissionless-l1s/stake/InitiateValidatorRegistration';
import {
  useStakeValidatorStore,
  deserializeStakeValidators,
  serializeStakeValidators,
} from '@/components/toolbox/stores/stakeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Alert } from '@/components/toolbox/components/Alert';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';
import { ValidatorListInput, type ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];

const NATIVE_CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'NativeTokenStakingManager',
    filename: 'NativeTokenStakingManager.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`,
    description: 'Manages validator registration and staking with native tokens. Stake is sent as msg.value.',
  },
];

const ERC20_CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'ERC20TokenStakingManager',
    filename: 'ERC20TokenStakingManager.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ERC20TokenStakingManager.sol`,
    description:
      'Manages validator registration and staking with ERC20 tokens. Requires token approval before staking.',
  },
];

interface InitiateRegistrationStepProps {
  tokenType: 'native' | 'erc20';
}

export default function InitiateRegistrationStep({ tokenType }: InitiateRegistrationStepProps) {
  const store = useStakeValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const { pChainAddress, pChainBalance, isTestnet } = useWalletStore();

  const isNative = tokenType === 'native';
  const contractSources = isNative ? NATIVE_CONTRACT_SOURCES : ERC20_CONTRACT_SOURCES;
  // Use the staking manager address resolved from the context — handles both
  // inheritance (VMC is the staking manager) and composition (owner is the staking manager)
  const stakingManagerAddress = vmcCtx.staking.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const erc20TokenAddress = vmcCtx.staking.erc20TokenAddress;

  const userPChainBalanceNavax = pChainBalance ? BigInt(Math.floor(pChainBalance * 1e9)) : null;
  const validators = deserializeStakeValidators(store.validators);
  const validator = validators[0];
  const nodeID = validator?.nodeID || '';
  const blsPublicKey = validator?.nodePOP?.publicKey || '';

  const handleValidatorsChange = (newValidators: ConvertToL1Validator[]) => {
    store.setValidators(serializeStakeValidators(newValidators));
  };

  return (
    <ContractDeployViewer contracts={contractSources}>
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-4">
          {!store.subnetIdL1 && (
            <Alert variant="warning">
              No L1 subnet selected. Go back to <strong>Select L1 Subnet</strong> to choose one.
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

          {vmcCtx.staking.isLoading && validators.length > 0 && (
            <p className="text-xs text-zinc-500 animate-pulse">Resolving staking manager address...</p>
          )}

          {/* Contract interaction — flows below the validator form */}
          {validators.length > 0 && !vmcCtx.staking.isLoading && stakingManagerAddress && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <InitiateValidatorRegistration
                nodeID={nodeID}
                blsPublicKey={blsPublicKey}
                stakingManagerAddress={stakingManagerAddress}
                tokenType={tokenType}
                erc20TokenAddress={!isNative ? (erc20TokenAddress ?? undefined) : undefined}
                remainingBalanceOwner={validator?.remainingBalanceOwner}
                disableOwner={validator?.deactivationOwner}
                onSuccess={(data) => {
                  store.setEvmTxHash(data.txHash);
                  store.setValidationID(data.validationID);
                  store.setGlobalError(null);
                }}
                onError={(message) => store.setGlobalError(message)}
              />
            </div>
          )}
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">initiateValidatorRegistration()</span>
          <a
            href={`https://github.com/ava-labs/icm-contracts/tree/${ICM_COMMIT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
          >
            @{ICM_COMMIT.slice(0, 7)}
          </a>
        </div>
      </div>
    </ContractDeployViewer>
  );
}
