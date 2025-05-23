"use client"

import React, { useState } from 'react'
import { AlertCircle } from "lucide-react"
import { Container } from "../../../components/Container"
import { Button } from "../../../components/Button"
import SelectSubnetId from "../../../components/SelectSubnetId"
import { ValidatorManagerDetails } from "../../../components/ValidatorManagerDetails"
import { ValidationSelection } from "../../../components/SelectValidationID"
import { Success } from "../../../components/Success"

import { useCreateChainStore } from "../../../stores/createChainStore"
import { useValidatorManagerDetails } from "../../hooks/useValidatorManagerDetails"

import InitiateValidatorRemoval from "./InitiateValidatorRemoval"
import CompleteValidatorRemoval from "./CompleteValidatorRemoval"
import SubmitPChainTxRemoval from "./SubmitPChainTxRemoval"
import { Step, Steps } from "fumadocs-ui/components/steps"

type RemovalStep = "initiate" | "pchain" | "complete"

const RemoveValidatorExpert: React.FC = () => {
  
  const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId)
  const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "")
  
  const [validationSelection, setValidationSelection] = useState<ValidationSelection>({
    validationId: "",
    nodeId: ""
  })

  const [pChainTxId, setPChainTxId] = useState<string>("")
  const [initiateRemovalTxHash, setInitiateRemovalTxHash] = useState<string>("")
  
  const [currentStep, setCurrentStep] = useState<RemovalStep>("initiate")
  const [componentKey, setComponentKey] = useState<number>(0)
  
  // Data passed between steps
  
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null)

  const {
    validatorManagerAddress,
    error: validatorManagerError,
    isLoading: isLoadingVMCDetails,
    blockchainId,
  } = useValidatorManagerDetails({ subnetId: subnetIdL1 })

  const handleInitiateError = (message: string) => {
    setGlobalError(message)
  }

  const handlePChainError = (message: string) => {
    setGlobalError(message)
  }

  const handleCompleteSuccess = (message: string) => {
    setGlobalSuccess(message)
    setGlobalError(null)
  }

  const handleCompleteError = (message: string) => {
    setGlobalError(message)
  }

  const handleReset = () => {
    setCurrentStep("initiate")
    setValidationSelection({ validationId: "", nodeId: "" })
    setInitiateRemovalTxHash("")
    setPChainTxId("")
    setGlobalError(null)
    setGlobalSuccess(null)
    setComponentKey(prevKey => prevKey + 1)
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
              resetForm={currentStep === "initiate"}
              initialNodeId={validationSelection.nodeId}
              initialValidationId={validationSelection.validationId}
              onSuccess={(data) => {
                setValidationSelection(data)
                setInitiateRemovalTxHash(data.txHash)
                setCurrentStep("pchain")
                setGlobalError(null)
              }}
              onError={handleInitiateError}
            />
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Sign Warp Message & Submit to P-Chain</h2>
            <p className="text-sm text-gray-500 mb-4">
              Sign the warp message and submit the removal transaction to the P-Chain.
            </p>
            <SubmitPChainTxRemoval
              key={`submit-pchain-${componentKey}`}
              subnetIdL1={subnetIdL1}
              initialEvmTxHash={initiateRemovalTxHash}
              onSuccess={(pChainTxId) => {
                setPChainTxId(pChainTxId)
                setCurrentStep("complete")
                setGlobalError(null)
              }}
              onError={handlePChainError}
            />
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Sign P-Chain Warp Message & Complete Removal</h2>
            <p className="text-sm text-gray-500 mb-4">
              Complete the validator removal by signing the P-Chain warp message.
            </p>
            <CompleteValidatorRemoval
              key={`complete-removal-${componentKey}`}
              subnetIdL1={subnetIdL1}
              validationId={validationSelection.validationId}
              pChainTxId={pChainTxId}
              eventData={null}
              onSuccess={handleCompleteSuccess}
              onError={handleCompleteError}
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
          <Button onClick={handleReset} className="mt-6">
            Reset All Steps
          </Button>
        )}
      </div>
    </Container>
  )
}

export default RemoveValidatorExpert
