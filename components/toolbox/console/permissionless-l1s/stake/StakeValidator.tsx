'use client';

import React, { useState } from 'react';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import InitiateValidatorRegistration from '@/components/toolbox/console/permissionless-l1s/stake/InitiateValidatorRegistration';
import CompletePChainRegistration from '@/components/toolbox/console/shared/CompletePChainRegistration';
import SubmitPChainTxRegisterL1Validator from '@/components/toolbox/console/permissioned-l1s/add-validator/SubmitPChainTxRegisterL1Validator';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { BaseConsoleToolProps } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { L1SubnetStep, StepFlowFooter, useL1SubnetState } from '../shared';
import { ValidatorListInput, ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';

export type TokenType = 'native' | 'erc20';

export interface StakeValidatorProps extends BaseConsoleToolProps {
  tokenType: TokenType;
}

export default function StakeValidator({ tokenType, onSuccess }: StakeValidatorProps) {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Validator details from ValidatorListInput
  const [validators, setValidators] = useState<ConvertToL1Validator[]>([]);

  // State for passing data between components
  const [validationID, setValidationID] = useState<string>('');
  const [initiateRegistrationTxHash, setInitiateRegistrationTxHash] = useState<string>('');
  const [completeRegistrationTxHash, setCompleteRegistrationTxHash] = useState<string>('');
  const [pChainTxId, setPChainTxId] = useState<string>('');

  const { exampleErc20Address } = useToolboxStore();
  const { pChainBalance, pChainAddress, isTestnet } = useWalletStore();
  const l1State = useL1SubnetState();
  const { validatorManagerDetails } = l1State;

  // Convert P-Chain balance to nAVAX (bigint)
  const userPChainBalanceNavax = pChainBalance ? BigInt(Math.floor(pChainBalance * 1e9)) : null;

  // Derive validator data from validators list
  const validator = validators[0];
  const nodeID = validator?.nodeID || '';
  const blsPublicKey = validator?.nodePOP?.publicKey || '';
  const blsProofOfPossession = validator?.nodePOP?.proofOfPossession || '';
  const validatorBalance = validator ? (Number(validator.validatorBalance) / 1e9).toString() : '0.1';

  const isNative = tokenType === 'native';
  const tokenLabel = isNative ? 'Native Token' : 'ERC20 Token';

  const handleReset = () => {
    setGlobalError(null);
    setGlobalSuccess(null);
    setValidators([]);
    setValidationID('');
    setInitiateRegistrationTxHash('');
    setCompleteRegistrationTxHash('');
    setPChainTxId('');
    l1State.setSubnetIdL1('');
    l1State.incrementResetKey();
  };

  return (
    <div className="space-y-6">
      {globalError && <Alert variant="error">Error: {globalError}</Alert>}

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
          <h2 className="text-lg font-semibold">Add Validator Details</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Add the validator details including node credentials and configuration.
          </p>

          {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
            <Alert variant="error" className="mb-4">
              This L1 is not using a Staking Manager. This tool is only for L1s with {tokenLabel} Staking Managers.
            </Alert>
          )}

          <ValidatorListInput
            key={`validator-input-${l1State.resetKey}`}
            validators={validators}
            onChange={setValidators}
            defaultAddress={pChainAddress || ''}
            label=""
            userPChainBalanceNavax={userPChainBalanceNavax}
            maxValidators={1}
            selectedSubnetId={l1State.subnetIdL1}
            isTestnet={isTestnet}
            hideConsensusWeight={true}
          />
        </Step>

        <Step>
          <h2 className="text-lg font-semibold">Initiate Validator Registration</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Register your validator on the staking manager contract and lock your{' '}
            {isNative ? 'native token' : 'ERC20 token'} stake.
            {!isNative && ' You will need to approve ERC20 tokens first.'}
          </p>

          <InitiateValidatorRegistration
            key={`initiate-${l1State.resetKey}-${tokenType}`}
            nodeID={nodeID}
            blsPublicKey={blsPublicKey}
            stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
            tokenType={tokenType}
            erc20TokenAddress={!isNative ? exampleErc20Address : undefined}
            remainingBalanceOwner={validator?.remainingBalanceOwner}
            disableOwner={validator?.deactivationOwner}
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
          <p className="text-sm text-zinc-500 mb-4">
            Sign the warp message and submit the validator registration to the P-Chain.
          </p>

          <SubmitPChainTxRegisterL1Validator
            subnetIdL1={l1State.subnetIdL1}
            signingSubnetId={l1State.validatorManagerDetails.signingSubnetId || l1State.subnetIdL1}
            validatorBalance={validatorBalance}
            userPChainBalanceNavax={userPChainBalanceNavax}
            blsProofOfPossession={blsProofOfPossession}
            evmTxHash={initiateRegistrationTxHash}
            onSuccess={(txId) => {
              setPChainTxId(txId);
              setGlobalError(null);
            }}
            onError={(message) => setGlobalError(message)}
          />
        </Step>

        <Step>
          <h2 className="text-lg font-semibold">Complete Validator Registration</h2>
          <p className="text-sm text-zinc-500 mb-4">
            After the P-Chain transaction is confirmed, complete the registration to activate your validator on the L1.
          </p>

          <CompletePChainRegistration
            key={`complete-${l1State.resetKey}-${tokenType}`}
            subnetIdL1={l1State.subnetIdL1}
            pChainTxId={pChainTxId}
            validationID={validationID}
            signingSubnetId={l1State.validatorManagerDetails.signingSubnetId || l1State.subnetIdL1}
            managerType={tokenType === 'native' ? 'PoS-Native' : 'PoS-ERC20'}
            managerAddress={validatorManagerDetails.contractOwner || ''}
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
        showReset={
          !!(initiateRegistrationTxHash || pChainTxId || completeRegistrationTxHash || globalError || globalSuccess)
        }
        onReset={handleReset}
      />
    </div>
  );
}
