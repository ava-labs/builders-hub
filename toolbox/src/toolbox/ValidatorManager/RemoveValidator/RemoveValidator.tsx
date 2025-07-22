"use client"
import React, { useState, useMemo } from 'react'
import { AlertCircle } from "lucide-react"
import { Container } from "../../../components/Container"
import { Button } from "../../../components/Button"
import SelectSubnetId from "../../../components/SelectSubnetId"
import { ValidatorManagerDetails } from "../../../components/ValidatorManagerDetails"
import { Success } from "../../../components/Success"

import { useCreateChainStore } from "../../../stores/createChainStore"
import { useWalletStore } from "../../../stores/walletStore"
import { useValidatorManagerDetails } from "../../hooks/useValidatorManagerDetails"

import InitiateValidatorRemoval from "./InitiateValidatorRemoval"
import CompleteValidatorRemoval from "./CompleteValidatorRemoval"
import SubmitPChainTxRemoval from "./SubmitPChainTxRemoval"
import { Step, Steps } from "fumadocs-ui/components/steps"

const RemoveValidatorExpert: React.FC = () => {
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null)
  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false)

  // State for passing data between components
  const [initiateRemovalTxHash, setInitiateRemovalTxHash] = useState<string>("")
  const [pChainTxId, setPChainTxId] = useState<string>("")

  // Form state
  const { walletEVMAddress } = useWalletStore()
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
    <Container 
      title="Remove Validator" 
      description="Remove a validator from an Avalanche L1 by following these steps in order."
    >
      <div className="space-y-6">
        {globalError && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
              <span>Error: {globalError}</span>
            </div>
          </div>
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
              Start the removal process by selecting the validator to remove.
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
            <h2 className="text-lg font-semibold">Sign Warp Message & Submit to P-Chain</h2>
            <p className="text-sm text-gray-500 mb-4">
              Sign the warp message and submit the removal transaction to the P-Chain.
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
            <h2 className="text-lg font-semibold">Sign P-Chain Warp Message & Complete Removal</h2>
            <p className="text-sm text-gray-500 mb-4">
              Complete the validator removal by signing the P-Chain warp message.
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
    </Container>
  )
}

export default RemoveValidatorExpert
