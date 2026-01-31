"use client"
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Success } from '@/components/toolbox/components/Success';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';

import InitiateChangeWeight from '@/components/toolbox/console/permissioned-l1s/ChangeWeight/InitiateChangeWeight';
import SubmitPChainTxChangeWeight from '@/components/toolbox/console/permissioned-l1s/ChangeWeight/SubmitPChainTxChangeWeight';
import CompleteChangeWeight from '@/components/toolbox/console/permissioned-l1s/ChangeWeight/CompleteChangeWeight';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import versions from "@/scripts/versions.json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

// TypeScript code for P-Chain step (Step 3)
const PCHAIN_WEIGHT_CODE = `// Step 3a: Aggregate signatures using Avalanche SDK
import { Avalanche } from "@avalabs/avalanche-sdk";

const sdk = new Avalanche({ network: "fuji" });

// Get the unsigned warp message from the EVM transaction receipt
const receipt = await publicClient.waitForTransactionReceipt({
  hash: initiateWeightChangeTxHash
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

// Step 3b: Submit SetL1ValidatorWeightTx to P-Chain
// Updates the validator's weight on the P-Chain
const txHash = await walletClient.setL1ValidatorWeight({
  signedWarpMessage: signedMessage,
});`;

// Step configuration for the code viewer
const STEP_CONFIG = [
  { id: 'select', title: 'Select L1', description: 'Choose your L1 subnet' },
  {
    id: 'initiate',
    title: 'Initiate Weight Change',
    description: 'Call initiateValidatorWeightUpdate on ValidatorManager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: 'initiateValidatorWeightUpdate',
    filename: 'ValidatorManager.sol',
  },
  {
    id: 'pchain',
    title: 'P-Chain Weight Update',
    description: 'Aggregate signatures and submit SetL1ValidatorWeightTx',
    codeType: 'typescript' as const,
    code: PCHAIN_WEIGHT_CODE,
    filename: 'setL1ValidatorWeight.ts',
    githubUrl: 'https://github.com/ava-labs/avalanche-sdk',
  },
  {
    id: 'complete',
    title: 'Complete Weight Change',
    description: 'Call completeValidatorWeightUpdate on ValidatorManager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: 'completeValidatorWeightUpdate',
    filename: 'ValidatorManager.sol',
  },
];

const metadata: ConsoleToolMetadata = {
  title: "Change Consensus Weight of Validators",
  description: "Modify a validator's consensus weight to determine their influence in the network",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance,
    WalletRequirementsConfigKey.PChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

const ChangeWeightStateless: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(1); // Start at step 2 (initiate) which has code

  // State for passing data between components
  const [evmTxHash, setEvmTxHash] = useState<string>('');
  const [pChainTxId, setPChainTxId] = useState<string>('');

  // Form state
  const { walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
  const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
  const [nodeId, setNodeId] = useState<string>('');
  const [validationId, setValidationId] = useState<string>('');
  const [newWeight, setNewWeight] = useState<string>('');
  const [resetInitiateForm, setResetInitiateForm] = useState<boolean>(false);
  const [resetKey, setResetKey] = useState<number>(0);

  const {
    validatorManagerAddress,
    error: validatorManagerError,
    isLoading: isLoadingVMCDetails,
    blockchainId,
    contractOwner,
    isOwnerContract,
    contractTotalWeight,
    signingSubnetId,
    isLoadingOwnership,
    l1WeightError,
    isLoadingL1Weight,
    ownershipError,
    ownerType,
    isDetectingOwnerType
  } = useValidatorManagerDetails({ subnetId: subnetIdL1 });

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
    setEvmTxHash('');
    setPChainTxId('');
    setSubnetIdL1('');
    setNodeId('');
    setValidationId('');
    setNewWeight('');
    setResetInitiateForm(true);
    setActiveStep(1);
    setResetKey(prev => prev + 1); // Force re-render of all child components
    // Reset the flag after a brief delay to allow the child component to process it
    setTimeout(() => setResetInitiateForm(false), 100);
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
            <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
            <p className="text-sm text-gray-500 mb-4">
              Choose the L1 subnet where you want to change the validator weight.
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
            <h2 className="text-lg font-semibold">Initiate Weight Change</h2>
            <p className="text-sm text-gray-500 mb-4">
              Call <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">initiateValidatorWeightUpdate</code> on the Validator Manager contract.
            </p>

            {/* Focus wrapper - switches code viewer to step 2 */}
            <div onFocus={() => setActiveStep(1)}>
              <InitiateChangeWeight
                subnetId={subnetIdL1}
                validatorManagerAddress={validatorManagerAddress}
                resetForm={resetInitiateForm}
                initialNodeId={nodeId}
                initialValidationId={validationId}
                initialWeight={newWeight}
                ownershipState={ownershipState}
                contractTotalWeight={contractTotalWeight}
                onSuccess={(data) => {
                  setNodeId(data.nodeId);
                  setValidationId(data.validationId);
                  setNewWeight(data.weight);
                  setEvmTxHash(data.txHash);
                  setGlobalError(null);
                  setResetInitiateForm(false);
                  setActiveStep(2); // Advance to P-Chain step
                }}
                onError={(message) => setGlobalError(message)}
              />
            </div>
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Submit to P-Chain</h2>
            <p className="text-sm text-gray-500 mb-4">
              Aggregate validator signatures and submit <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">SetL1ValidatorWeightTx</code> to P-Chain.
            </p>

            {/* Focus wrapper - switches code viewer to step 3 */}
            <div onFocus={() => setActiveStep(2)}>
              <SubmitPChainTxChangeWeight
                key={`submit-pchain-${resetKey}`}
                subnetIdL1={subnetIdL1}
                initialEvmTxHash={evmTxHash}
                signingSubnetId={signingSubnetId}
                onSuccess={(pChainTxId) => {
                  setPChainTxId(pChainTxId);
                  setGlobalError(null);
                  setActiveStep(3); // Advance to complete step
                }}
                onError={(message) => setGlobalError(message)}
              />
            </div>
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Complete Weight Change</h2>
            <p className="text-sm text-gray-500 mb-4">
              Call <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">completeValidatorWeightUpdate</code> on the Validator Manager contract.
            </p>

            {/* Focus wrapper - switches code viewer to step 4 */}
            <div onFocus={() => setActiveStep(3)}>
              <CompleteChangeWeight
                key={`complete-change-${resetKey}`}
                subnetIdL1={subnetIdL1}
                initialPChainTxId={pChainTxId}
                isContractOwner={isContractOwner}
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

        {(evmTxHash || pChainTxId || globalError || globalSuccess) && (
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

export default withConsoleToolMetadata(ChangeWeightStateless, metadata);
