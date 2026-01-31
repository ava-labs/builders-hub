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
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import versions from "@/scripts/versions.json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

// TypeScript code for P-Chain step (Step 5)
const PCHAIN_CODE = `// Step 5a: Aggregate signatures using Avalanche SDK
import { Avalanche } from "@avalabs/avalanche-sdk";

const sdk = new Avalanche({ network: "fuji" });

// Get the unsigned warp message from the EVM transaction receipt
const receipt = await publicClient.waitForTransactionReceipt({
  hash: evmTxHash
});
const unsignedWarpMessage = receipt.logs[0].data;

// Aggregate signatures from the subnet validators (67% quorum)
const { signedMessage } = await sdk.data.signatureAggregator.aggregate({
  signatureAggregatorRequest: {
    message: unsignedWarpMessage,
    signingSubnetId: subnetId,
    quorumPercentage: 67,
  }
});

// Step 5b: Submit RegisterL1ValidatorTx to P-Chain
// balance and blsProofOfPossession come from validator config (Step 3)
const txHash = await walletClient.registerL1Validator({
  balance: validatorBalance,         // From validator config (in AVAX)
  blsProofOfPossession: blsPop,      // From validator's node info
  signedWarpMessage: signedMessage,  // Aggregated warp message
});`;

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

// Step configuration for the code viewer
const STEP_CONFIG = [
  { id: 'setup', title: 'Setup', description: 'Prerequisites and node setup' },
  { id: 'select', title: 'Select L1', description: 'Choose your L1 subnet' },
  { id: 'details', title: 'Validator Details', description: 'Configure validator parameters' },
  {
    id: 'initiate',
    title: 'Initiate Registration',
    description: 'Call initiateValidatorRegistration on ValidatorManager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: 'initiateValidatorRegistration',
    filename: 'ValidatorManager.sol',
  },
  {
    id: 'pchain',
    title: 'P-Chain Registration',
    description: 'Aggregate signatures and submit RegisterL1ValidatorTx',
    codeType: 'typescript' as const,
    code: PCHAIN_CODE,
    filename: 'registerL1Validator.ts',
    githubUrl: 'https://github.com/ava-labs/avalanche-sdk',
  },
  {
    id: 'complete',
    title: 'Complete Registration',
    description: 'Call completeValidatorRegistration on ValidatorManager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: 'completeValidatorRegistration',
    filename: 'ValidatorManager.sol',
  },
];

const AddValidatorExpert: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(3); // Start at step 4 (initiate) which has code

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

  const ownershipState = useMemo(() => {
    if (isOwnerContract) {
      return 'contract';
    }
    if (isContractOwner === true) {
      return 'currentWallet';
    }
    if (isContractOwner === false) {
      return 'differentEOA';
    }
    return 'loading';
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
    setActiveStep(3);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setResetKey(prev => prev + 1);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Wizard Steps */}
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
              Call <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">initiateValidatorRegistration</code> on the Validator Manager contract.
            </p>

            {/* Focus wrapper - switches code viewer to step 4 */}
            <div onFocus={() => setActiveStep(3)}>
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
                  setActiveStep(4); // Advance to P-Chain step
                }}
                onError={(message) => setGlobalError(message)}
              />
            </div>
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Submit to P-Chain</h2>
            <p className="text-sm text-gray-500 mb-4">
              Aggregate validator signatures and submit <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">RegisterL1ValidatorTx</code> to P-Chain.
            </p>

            {/* Focus wrapper - switches code viewer to step 5 */}
            <div onFocus={() => setActiveStep(4)}>
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
                  setActiveStep(5); // Advance to complete step
                }}
                onError={(message) => setGlobalError(message)}
                userPChainBalanceNavax={userPChainBalanceNavax}
              />
            </div>
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Complete Registration</h2>
            <p className="text-sm text-gray-500 mb-4">
              Call <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">completeValidatorRegistration</code> on the Validator Manager contract.
            </p>

            {/* Focus wrapper - switches code viewer to step 6 */}
            <div onFocus={() => setActiveStep(5)}>
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
            </div>
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

      {/* Right: Code Viewer - follows activeStep */}
      <StepCodeViewer
        activeStep={activeStep}
        steps={STEP_CONFIG}
        className="lg:sticky lg:top-4 lg:self-start"
      />
    </div>
  );
};

export default withConsoleToolMetadata(AddValidatorExpert, metadata);
