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
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
  title: "Remove Validator",
  description: "Remove a validator from an Avalanche L1 by following these steps in order",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance,
    WalletRequirementsConfigKey.PChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
}

const RemoveValidatorExpert: React.FC<BaseConsoleToolProps> = ({ onSuccess }) => {
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null)
  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false)

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
    setGlobalError(null)
    setGlobalSuccess(null)
    setInitiateRemovalTxHash("")
    setPChainTxId("")
    setSubnetIdL1("")
    setNodeId("")
    setValidationId("")
    setResetInitiateForm(true)
    setResetKey(prev => prev + 1) // Force re-render of all child components
    // Reset the flag after a brief delay to allow the child component to process it
    setTimeout(() => setResetInitiateForm(false), 100)
  }

  return (
    <>
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
                Start the removal process by selecting the validator to remove and calling the <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/ValidatorManager.sol#L508" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">initiateValidatorRemoval</a> function on the Validator Manager contract. This transaction will emit a <a href="/docs/acps/77-reinventing-subnets#l1validatorweightmessage" className="text-blue-600 hover:text-blue-800 underline">L1ValidatorWeightMessage</a> warp message.
              </p>
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
                }}
                onError={(message) => setGlobalError(message)}
              />
            </Step>

            <Step>
              <h2 className="text-lg font-semibold">Sign L1ValidatorWeightMessage & Submit SetL1ValidatorWeightTx P-Chain</h2>
              <p className="text-sm text-gray-500 mb-4">
                Sign the <a href="/docs/acps/77-reinventing-subnets#l1validatorweightmessage" className="text-blue-600 hover:text-blue-800 underline">L1ValidatorWeightMessage</a> and submit the <a href="/docs/acps/77-reinventing-subnets#setl1validatorweighttx" className="text-blue-600 hover:text-blue-800 underline">SetL1ValidatorWeightTx</a> to the P-Chain. This transaction will emit a <a href="/docs/acps/77-reinventing-subnets#l1validatorregistrationmessage" className="text-blue-600 hover:text-blue-800 underline">L1ValidatorRegistrationMessage</a> warp message.
              </p>
              <SubmitPChainTxRemoval
                key={`submit-pchain-${resetKey}`}
                subnetIdL1={subnetIdL1}
                initialEvmTxHash={initiateRemovalTxHash}
                signingSubnetId={signingSubnetId}
                onSuccess={(pChainTxId) => {
                  setPChainTxId(pChainTxId)
                  setGlobalError(null)
                }}
                onError={(message) => setGlobalError(message)}
              />
            </Step>

            <Step>
              <h2 className="text-lg font-semibold">Sign P-Chain L1ValidatorRegistrationMessage & Submit completeValidatorRemoval on Validator Manager contract</h2>
              <p className="text-sm text-gray-500 mb-4">
                Complete the validator removal by signing the P-Chain <a href="/docs/acps/77-reinventing-subnets#l1validatorregistrationmessage" className="text-blue-600 hover:text-blue-800 underline">L1ValidatorRegistrationMessage</a> and calling the <a href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/ValidatorManager.sol#L573" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">completeValidatorRemoval</a> function on the Validator Manager contract.
              </p>
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
    </>
  )
}

export default withConsoleToolMetadata(RemoveValidatorExpert, metadata)
