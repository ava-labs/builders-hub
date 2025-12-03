"use client"
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/toolbox/components/Button';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';

import InitiateValidatorRegistration from '@/components/toolbox/console/permissioned-l1s/AddValidator/InitiateValidatorRegistration';
import SubmitPChainTxRegisterL1Validator from '@/components/toolbox/console/permissioned-l1s/AddValidator/SubmitPChainTxRegisterL1Validator';
import CompleteValidatorRegistration from '@/components/toolbox/console/permissioned-l1s/AddValidator/CompleteValidatorRegistration';
import { ValidatorListInput, ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { Alert } from '@/components/toolbox/components/Alert';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

// Helper functions for BigInt serialization
const serializeValidators = (validators: ConvertToL1Validator[]) => {
  return validators.map(validator => ({
    ...validator,
    validatorWeight: validator.validatorWeight.toString(),
    validatorBalance: validator.validatorBalance.toString(),
  }));
};

const deserializeValidators = (serializedValidators: any[]): ConvertToL1Validator[] => {
  return serializedValidators.map(validator => ({
    ...validator,
    validatorWeight: BigInt(validator.validatorWeight),
    validatorBalance: BigInt(validator.validatorBalance),
  }));
};

const STORAGE_KEY = 'addValidator_validators';

const metadata: ConsoleToolMetadata = {
  title: "Add New Validator",
  description: "Add a validator to your L1 by following these steps in order",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance,
    WalletRequirementsConfigKey.PChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

const AddValidatorExpert: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false);

  // State for passing data between components
  const [pChainTxId, setPChainTxId] = useState<string>('');
  const [validatorBalance, setValidatorBalance] = useState<string>('');
  const [blsProofOfPossession, setBlsProofOfPossession] = useState<string>('');
  const [evmTxHash, setEvmTxHash] = useState<string>('');

  // Form state with local persistence
  const { walletEVMAddress, pChainAddress, isTestnet } = useWalletStore();
  const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
  const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
  const [resetKey, setResetKey] = useState<number>(0);
  const [userPChainBalanceNavax, setUserPChainBalanceNavax] = useState<bigint | null>(null);

  // Local validators state with localStorage persistence
  const [validators, setValidatorsState] = useState<ConvertToL1Validator[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const serialized = JSON.parse(saved);
          return deserializeValidators(serialized);
        }
      } catch (error) {
        console.error('Error loading validators from localStorage:', error);
      }
    }
    return [];
  });

  // Wrapper function to save to localStorage
  const setValidators = (newValidators: ConvertToL1Validator[]) => {
    setValidatorsState(newValidators);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeValidators(newValidators)));
      } catch (error) {
        console.error('Error saving validators to localStorage:', error);
      }
    }
  };

  const {
    validatorManagerAddress,
    error: validatorManagerError,
    isLoading: isLoadingVMCDetails,
    blockchainId,
    contractOwner,
    isOwnerContract,
    contractTotalWeight,
    l1WeightError,
    signingSubnetId,
    isLoadingOwnership,
    isLoadingL1Weight,
    ownershipError,
    ownerType,
    isDetectingOwnerType
  } = useValidatorManagerDetails({ subnetId: subnetIdL1 });

  // Restore intermediate state from persisted validators data when available
  useEffect(() => {
    if (validators.length > 0 && !validatorBalance && !blsProofOfPossession) {
      const validator = validators[0];
      setValidatorBalance((Number(validator.validatorBalance) / 1e9).toString());
      setBlsProofOfPossession(validator.nodePOP.proofOfPossession);
    } else if (validators.length === 0) {
      // Clear values when all validators are removed
      setValidatorBalance('');
      setBlsProofOfPossession('');
    }
  }, [validators, validatorBalance, blsProofOfPossession]);

  // Keep validatorBalance in sync with current validators selection
  useEffect(() => {
    if (validators.length > 0) {
      const validator = validators[0];
      setValidatorBalance((Number(validator.validatorBalance) / 1e9).toString());
    } else {
      setValidatorBalance('');
    }
  }, [validators]);

  // Simple ownership check - direct computation
  const isContractOwner = useMemo(() => {
    return contractOwner && walletEVMAddress
      ? walletEVMAddress.toLowerCase() === contractOwner.toLowerCase()
      : null;
  }, [contractOwner, walletEVMAddress]);

  // Determine UI state based on ownership:
  // Case 1: Contract is owned by another contract → show MultisigOption
  // Case 2: Contract is owned by current wallet → show regular button
  // Case 3: Contract is owned by different EOA → show error
  const ownershipState = useMemo(() => {
    if (isOwnerContract) {
      return 'contract'; // Case 1: Show MultisigOption
    }
    if (isContractOwner === true) {
      return 'currentWallet'; // Case 2: Show regular button
    }
    if (isContractOwner === false) {
      return 'differentEOA'; // Case 3: Show error
    }
    return 'loading'; // Still determining ownership
  }, [isOwnerContract, isContractOwner]);

  const handleReset = () => {
    setGlobalError(null);
    setGlobalSuccess(null);
    setPChainTxId('');
    setValidatorBalance('');
    setBlsProofOfPossession('');
    setEvmTxHash('');
    setSubnetIdL1('');
    setValidators([]);
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setResetKey(prev => prev + 1); // Force re-render of all child components
  };

  return (
    <>
        <div className="space-y-6">
          {globalError && (
            <Alert variant="error">Error: {globalError}</Alert>
          )}

          <Steps>
            <Step>
              <h2 className="text-lg font-semibold">Ensure L1 Node is Running</h2>
              <p className="text-sm text-gray-500 mb-4">
                Before adding a validator, you must have an L1 node set up and running. If you haven't done this yet, 
                visit the <Link href="/console/layer-1/l1-node-setup" className="text-blue-600 hover:text-blue-800 underline">L1 Node Setup Tool</Link> first.
                {isTestnet && (
                  <>
                    {' '}On testnet, you can also use our <Link href="/console/testnet-infra/nodes" className="text-blue-600 hover:text-blue-800 underline">free testnet infrastructure</Link>.
                  </>
                )}
              </p>
            </Step>
            
            <Step>
              <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
              <p className="text-sm text-gray-500 mb-4">
                Choose the L1 subnet where you want to add the validator.
              </p>
              <div className="space-y-2">
                <SelectSubnetId
                  value={subnetIdL1}
                  onChange={setSubnetIdL1}
                  error={validatorManagerError}
                  hidePrimaryNetwork={true}
                />
                <ValidatorManagerDetails
                  validatorManagerAddress={validatorManagerAddress}
                  blockchainId={blockchainId}
                  subnetId={subnetIdL1}
                  isLoading={isLoadingVMCDetails}
                  signingSubnetId={signingSubnetId}
                  contractTotalWeight={contractTotalWeight}
                  l1WeightError={l1WeightError}
                  isLoadingL1Weight={isLoadingL1Weight}
                  contractOwner={contractOwner}
                  ownershipError={ownershipError}
                  isLoadingOwnership={isLoadingOwnership}
                  isOwnerContract={isOwnerContract}
                  ownerType={ownerType}
                  isDetectingOwnerType={isDetectingOwnerType}
                  isExpanded={isValidatorManagerDetailsExpanded}
                  onToggleExpanded={() => setIsValidatorManagerDetailsExpanded(!isValidatorManagerDetailsExpanded)}
                />
              </div>
            </Step>

            <Step>
              <h2 className="text-lg font-semibold">Add Validator Details</h2>
              <p className="text-sm text-gray-500 mb-4">
                Add the validator details including node credentials and configuration.
              </p>

              <ValidatorListInput
                key={`validator-input-${resetKey}`}
                validators={validators}
                onChange={setValidators}
                defaultAddress={pChainAddress ? pChainAddress : ""}
                label=""
                l1TotalInitializedWeight={!l1WeightError && contractTotalWeight > 0n ? contractTotalWeight : null}
                userPChainBalanceNavax={userPChainBalanceNavax}
                maxValidators={1}
              />
            </Step>

            <Step>
              <h2 className="text-lg font-semibold">Initiate Validator Registration</h2>
              <p className="text-sm text-gray-500 mb-4">
                Call the <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/ValidatorManager.sol#L308" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">initiateValidatorRegistration</a> function on the Validator Manager contract. This transaction will emit a <a href="/docs/acps/77-reinventing-subnets#registerl1validatormessage" className="text-blue-600 hover:text-blue-800 underline">RegisterL1ValidatorMessage</a> warp message.
              </p>

              <InitiateValidatorRegistration
                key={`initiate-${resetKey}`}
                subnetId={subnetIdL1}
                validatorManagerAddress={validatorManagerAddress}
                validators={validators}
                ownershipState={ownershipState}
                contractTotalWeight={contractTotalWeight}
                l1WeightError={l1WeightError}
                onSuccess={(data) => {
                  setValidatorBalance(data.validatorBalance);
                  setBlsProofOfPossession(data.blsProofOfPossession);
                  setEvmTxHash(data.txHash);
                  setGlobalError(null);
                }}
                onError={(message) => setGlobalError(message)}
              />
            </Step>

            <Step>
              <h2 className="text-lg font-semibold">Sign RegisterL1ValidatorMessage & Submit RegisterL1ValidatorTx to P-Chain</h2>
              <p className="text-sm text-gray-500 mb-4">
                Sign the emitted <a href="/docs/acps/77-reinventing-subnets#registerl1validatormessage" className="text-blue-600 hover:text-blue-800 underline">RegisterL1ValidatorMessage</a> and submit a <a href="/docs/acps/77-reinventing-subnets#registerl1validatortx" className="text-blue-600 hover:text-blue-800 underline">RegisterL1ValidatorTx</a> to P-Chain. This transaction will emit a <a href="/docs/acps/77-reinventing-subnets#l1validatorregistrationmessage" className="text-blue-600 hover:text-blue-800 underline">L1ValidatorRegistrationMessage</a> warp message.
              </p>
              <SubmitPChainTxRegisterL1Validator
                key={`submit-pchain-${resetKey}`}
                subnetIdL1={subnetIdL1}
                validatorBalance={validatorBalance}
                blsProofOfPossession={blsProofOfPossession}
                evmTxHash={evmTxHash}
                signingSubnetId={signingSubnetId}
                onSuccess={(pChainTxId) => {
                  setPChainTxId(pChainTxId);
                  setGlobalError(null);
                }}
                onError={(message) => setGlobalError(message)}
                userPChainBalanceNavax={userPChainBalanceNavax}
              />
            </Step>

            <Step>
              <h2 className="text-lg font-semibold">Sign L1ValidatorRegistrationMessage & Submit completeValidatorRegistration on Validator Manager contract</h2>
              <p className="text-sm text-gray-500 mb-4">
                Complete the validator registration by signing the P-Chain <a href="/docs/acps/77-reinventing-subnets#l1validatorregistrationmessage" className="text-blue-600 hover:text-blue-800 underline">L1ValidatorRegistrationMessage</a> and calling the <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/ValidatorManager.sol#L425" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">completeValidatorRegistration</a> function on the Validator Manager contract.
              </p>
              <CompleteValidatorRegistration
                key={`complete-registration-${resetKey}`}
                subnetIdL1={subnetIdL1}
                pChainTxId={pChainTxId}
                ownershipState={ownershipState}
                validatorManagerAddress={validatorManagerAddress}
                signingSubnetId={signingSubnetId}
                contractOwner={contractOwner}
                isLoadingOwnership={isLoadingOwnership}
                ownerType={ownerType}
                onSuccess={(message) => {
                  setGlobalSuccess(message);
                  setGlobalError(null);
                  onSuccess?.();
                }}
                onError={(message) => setGlobalError(message)}
              />
            </Step>
          </Steps>

          {globalSuccess && (
            <Success
              label="Process Complete"
              value={globalSuccess}
            />
          )}

          {(pChainTxId || globalError || globalSuccess) && (
            <Button onClick={handleReset} variant="secondary" className="mt-6">
              Reset All Steps
            </Button>
          )}
        </div>
    </>
  );
};

export default withConsoleToolMetadata(AddValidatorExpert, metadata);
