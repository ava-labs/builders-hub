"use client"
import React, { useState, useMemo } from 'react'
import { Button } from "@/components/toolbox/components/Button"
import { Alert } from '@/components/toolbox/components/Alert'
import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId"
import { ValidatorManagerDetails } from "@/components/toolbox/components/ValidatorManagerDetails"
import { Success } from "@/components/toolbox/components/Success"

import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore"
import { useWalletStore } from "@/components/toolbox/stores/walletStore"
import { useValidatorManagerDetails } from "@/components/toolbox/hooks/useValidatorManagerDetails"

import InitiateValidatorRemoval from "@/components/toolbox/console/permissioned-l1s/RemoveValidator/InitiateValidatorRemoval"
import CompleteValidatorRemoval from "@/components/toolbox/console/permissioned-l1s/RemoveValidator/CompleteValidatorRemoval"
import SubmitPChainTxRemoval from "@/components/toolbox/console/permissioned-l1s/RemoveValidator/SubmitPChainTxRemoval"
import { Step, Steps } from "fumadocs-ui/components/steps"
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements"
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata"
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext"
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url"
import { StepCodeViewer } from "@/components/console/step-code-viewer"
import versions from "@/scripts/versions.json"

const ICM_COMMIT = versions["ava-labs/icm-contracts"]

// TypeScript code for P-Chain step (Step 3)
const PCHAIN_REMOVAL_CODE = `// Step 3a: Aggregate signatures using Avalanche SDK
import { Avalanche } from "@avalabs/avalanche-sdk";

const sdk = new Avalanche({ network: "fuji" });

// Get the unsigned warp message from the EVM transaction receipt
const receipt = await publicClient.waitForTransactionReceipt({
  hash: initiateRemovalTxHash
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
// Sets the validator weight to 0, effectively removing them
const txHash = await walletClient.setL1ValidatorWeight({
  signedWarpMessage: signedMessage,
});`

const metadata: ConsoleToolMetadata = {
  title: "Remove Validator",
  description: "Remove a validator from an Avalanche L1 by following these steps in order",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance,
    WalletRequirementsConfigKey.PChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
}

// Step configuration for the code viewer
const STEP_CONFIG = [
  { id: 'select', title: 'Select L1', description: 'Choose your L1 subnet' },
  {
    id: 'initiate',
    title: 'Initiate Removal',
    description: 'Call initiateValidatorRemoval on ValidatorManager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: 'initiateValidatorRemoval',
    filename: 'ValidatorManager.sol',
  },
  {
    id: 'pchain',
    title: 'P-Chain Weight Update',
    description: 'Aggregate signatures and submit SetL1ValidatorWeightTx',
    codeType: 'typescript' as const,
    code: PCHAIN_REMOVAL_CODE,
    filename: 'setL1ValidatorWeight.ts',
    githubUrl: 'https://github.com/ava-labs/avalanche-sdk',
  },
  {
    id: 'complete',
    title: 'Complete Removal',
    description: 'Call completeValidatorRemoval on ValidatorManager',
    codeType: 'solidity' as const,
    sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
    highlightFunction: 'completeValidatorRemoval',
    filename: 'ValidatorManager.sol',
  },
]

const RemoveValidatorExpert: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null)
  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false)
  const [activeStep, setActiveStep] = useState<number>(1) // Start at step 2 (initiate) which has code

  // State for passing data between components
  const [initiateRemovalTxHash, setInitiateRemovalTxHash] = useState<string>("")
  const [pChainTxId, setPChainTxId] = useState<string>("")

  // Form state
  const { walletEVMAddress } = useWalletStore()
  const { coreWalletClient } = useConnectedWallet()
  const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId)
  const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "")
  const [nodeId, setNodeId] = useState<string>("")
  const [validationId, setValidationId] = useState<string>("")
  const [resetInitiateForm, setResetInitiateForm] = useState<boolean>(false)
  const [resetKey, setResetKey] = useState<number>(0)

  const {
    validatorManagerAddress,
    error: validatorManagerError,
    isLoading: isLoadingVMCDetails,
    blockchainId,
    contractOwner,
    isOwnerContract,
    signingSubnetId,
    isLoadingOwnership,
    contractTotalWeight,
    l1WeightError,
    isLoadingL1Weight,
    ownershipError,
    ownerType,
    isDetectingOwnerType
  } = useValidatorManagerDetails({ subnetId: subnetIdL1 })

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
    setGlobalError(null)
    setGlobalSuccess(null)
    setInitiateRemovalTxHash("")
    setPChainTxId("")
    setSubnetIdL1("")
    setNodeId("")
    setValidationId("")
    setResetInitiateForm(true)
    setActiveStep(1)
    setResetKey(prev => prev + 1)
    setTimeout(() => setResetInitiateForm(false), 100)
  }

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
              Choose the L1 subnet where you want to remove the validator.
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
            <h2 className="text-lg font-semibold">Initiate Validator Removal</h2>
            <p className="text-sm text-gray-500 mb-4">
              Call <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">initiateValidatorRemoval</code> on the Validator Manager contract.
            </p>

            {/* Focus wrapper - switches code viewer to step 2 */}
            <div onFocus={() => setActiveStep(1)}>
              <InitiateValidatorRemoval
                subnetId={subnetIdL1}
                validatorManagerAddress={validatorManagerAddress}
                resetForm={resetInitiateForm}
                initialNodeId={nodeId}
                initialValidationId={validationId}
                ownershipState={ownershipState}
                onSuccess={(data) => {
                  setNodeId(data.nodeId)
                  setValidationId(data.validationId)
                  setInitiateRemovalTxHash(data.txHash)
                  setGlobalError(null)
                  setResetInitiateForm(false)
                  setActiveStep(2) // Advance to P-Chain step
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
              <SubmitPChainTxRemoval
                key={`submit-pchain-${resetKey}`}
                subnetIdL1={subnetIdL1}
                initialEvmTxHash={initiateRemovalTxHash}
                signingSubnetId={signingSubnetId}
                onSuccess={(pChainTxId) => {
                  setPChainTxId(pChainTxId)
                  setGlobalError(null)
                  setActiveStep(3) // Advance to complete step
                }}
                onError={(message) => setGlobalError(message)}
              />
            </div>
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Complete Removal</h2>
            <p className="text-sm text-gray-500 mb-4">
              Call <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">completeValidatorRemoval</code> on the Validator Manager contract.
            </p>

            {/* Focus wrapper - switches code viewer to step 4 */}
            <div onFocus={() => setActiveStep(3)}>
              <CompleteValidatorRemoval
                key={`complete-removal-${resetKey}`}
                subnetIdL1={subnetIdL1}
                validationId={validationId}
                pChainTxId={pChainTxId}
                eventData={null}
                isContractOwner={isContractOwner}
                validatorManagerAddress={validatorManagerAddress}
                signingSubnetId={signingSubnetId}
                contractOwner={contractOwner}
                isLoadingOwnership={isLoadingOwnership}
                ownerType={ownerType}
                onSuccess={(message) => {
                  setGlobalSuccess(message)
                  setGlobalError(null)
                  onSuccess?.()
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

        {(initiateRemovalTxHash || pChainTxId || globalError || globalSuccess) && (
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
  )
}

export default withConsoleToolMetadata(RemoveValidatorExpert, metadata)
