"use client"

import { AlertCircle, CheckCircle } from "lucide-react"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import { bytesToHex, hexToBytes } from "viem"
import { Context, networkIDs, pvm, utils } from "@avalabs/avalanchejs"
import { useErrorBoundary } from "react-error-boundary"
import { useState } from "react"

import { Button } from "../../components/Button"
import { Container } from "../components/Container"
import { GetRegistrationJustification } from "./justification"
import { Input } from "../../components/Input"
import { cn } from "../../lib/utils"
import { getRPCEndpoint } from "../../coreViem/utils/rpc"
import { packL1ValidatorRegistration } from "../../coreViem/utils/convertWarp"
import { packWarpIntoAccessList } from "../InitializePoA/packWarp"
import { StepIndicator, StepStatus } from "../components/StepIndicator"
import { useToolboxStore, useViemChainStore } from "../toolboxStore"
import { useWalletStore } from "../../lib/walletStore"
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { getValidationIdHex } from "../../coreViem/hooks/getValidationID"
// Define interfaces for step status tracking
interface RemovalSteps {
  getValidationID: StepStatus
  initiateRemoval: StepStatus
  signMessage: StepStatus
  submitPChainTx: StepStatus
  pChainSignature: StepStatus
  completeRemoval: StepStatus
}

export default function RemoveValidator() {
  const { showBoundary } = useErrorBoundary()
  const { proxyAddress, subnetId } = useToolboxStore()
  const { coreWalletClient, pChainAddress, avalancheNetworkID, publicClient } = useWalletStore()
  const viemChain = useViemChainStore()

  const [nodeID, setNodeID] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isProcessComplete, setIsProcessComplete] = useState(false)
  const [validationIDHex, setValidationIDHex] = useState("")
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState("")
  const [signedWarpMessage, setSignedWarpMessage] = useState("")
  const [pChainSignature, setPChainSignature] = useState("")

  const platformEndpoint = getRPCEndpoint(avalancheNetworkID !== networkIDs.MainnetID)
  const networkName = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "fuji"
  const pvmApi = new pvm.PVMApi(platformEndpoint)

  
  // Track steps for removal process
  const [removalSteps, setRemovalSteps] = useState<RemovalSteps>({
    getValidationID: { status: "pending" },
    initiateRemoval: { status: "pending" },
    signMessage: { status: "pending" },
    submitPChainTx: { status: "pending" },
    pChainSignature: { status: "pending" },
    completeRemoval: { status: "pending" },
  })


  // Update step status helper
  const updateStepStatus = (step: keyof RemovalSteps, status: StepStatus["status"], error?: string) => {
    setRemovalSteps((prev) => ({
      ...prev,
      [step]: { status, error },
    }))
  }

  // Reset the removal process
  const resetRemoval = () => {
    setIsProcessing(false)
    setIsProcessComplete(false)
    setError(null)
    setSuccess(null)
    Object.keys(removalSteps).forEach((step) => {
      updateStepStatus(step as keyof RemovalSteps, "pending")
    })
  }
  // Handle retry of a specific step
  const retryStep = async (step: keyof RemovalSteps) => {
    // Reset status of current step and all following steps
    const steps = Object.keys(removalSteps) as Array<keyof RemovalSteps>
    const stepIndex = steps.indexOf(step)

    // Only reset the statuses from the failed step onwards
    steps.slice(stepIndex).forEach((currentStep) => {
      updateStepStatus(currentStep, "pending")
    })

    // Start the removal process from the failed step
    await handleRemove(step)
  }

  const handleRemove = async (startFromStep?: keyof RemovalSteps) => {
    if (!nodeID) {
      setError("Node ID is required")
      return
    }

    if (!startFromStep) {
      setIsProcessing(true)
      setIsProcessComplete(false)
      setError(null)
      setSuccess(null)
      Object.keys(removalSteps).forEach((step) => {
        updateStepStatus(step as keyof RemovalSteps, "pending")
      })
    }

    // --- Local variables to pass results synchronously during initial run --- 
    let currentValidationID = validationIDHex; // Initialize with state for retries
    let currentUnsignedWarpMessage = unsignedWarpMessage; // Initialize with state for retries
    let currentSignedWarpMessage = signedWarpMessage; // Initialize with state for retries
    let currentPChainSignature = pChainSignature; // Initialize with state for retries
    // --- End local variables --- 

    try {
      setIsLoading(true)

      // Step 1: Get ValidationID
      if (!startFromStep || startFromStep === "getValidationID") {
        updateStepStatus("getValidationID", "loading")
        try {
          const validationIDResult = await getValidationIdHex(publicClient, proxyAddress as `0x${string}`, nodeID) // Changed variable name
          setValidationIDHex(validationIDResult as string) // Update state
          currentValidationID = validationIDResult as string; // Use immediately
          console.log("ValidationID:", validationIDResult)
          updateStepStatus("getValidationID", "success")
        } catch (error: any) {
          updateStepStatus("getValidationID", "error", error.message)
          setIsLoading(false)
          showBoundary(error)
          return
        }
      }

      // Step 2: Initiate Validator Removal
      if (!startFromStep || startFromStep === "initiateRemoval") {
        updateStepStatus("initiateRemoval", "loading")
        try {
          // Use currentValidationID for initial run, or state (already in currentValidationID) for retry
          if (!currentValidationID) { 
            throw new Error("Validation ID is missing. Please ensure the previous step succeeded.")
          }
          
          const removeValidatorTx = await coreWalletClient.writeContract({
            address: proxyAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "initiateValidatorRemoval",
            args: [currentValidationID], // Use local variable
            chain: viemChain
          })
          
          console.log("Removal transaction:", removeValidatorTx)
          
          if (!publicClient) {
            throw new Error("Wallet connection not initialized")
          }
          
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: removeValidatorTx
          })
          
          console.log("Receipt:", receipt)
          
          const warpMessageResult = receipt.logs[0].data || "" // Changed variable name
          setUnsignedWarpMessage(warpMessageResult) // Update state
          currentUnsignedWarpMessage = warpMessageResult; // Use immediately
          updateStepStatus("initiateRemoval", "success")
        } catch (error: any) {
          // Extract base error message if available
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("initiateRemoval", "error", `Failed to initiate removal: ${message}`)
          setIsLoading(false)
          showBoundary(error)
          return
        }
      }

      // Step 3: Sign Warp Message
      if (!startFromStep || startFromStep === "signMessage") {
        updateStepStatus("signMessage", "loading")
        try {
          // Use currentUnsignedWarpMessage for initial run, or state for retry
          if (!currentUnsignedWarpMessage || currentUnsignedWarpMessage.length === 0) { 
            throw new Error("Warp message is empty. Please try again from the previous step.")
          }
          
          const { signedMessage: signedMessageResult } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({ // Changed variable name
            network: networkName,
            signatureAggregatorRequest: {
              message: currentUnsignedWarpMessage, // Use local variable
              signingSubnetId: subnetId || "",
              quorumPercentage: 67,
            },
          })
          
          console.log("Signed message:", signedMessageResult)
          setSignedWarpMessage(signedMessageResult) // Update state
          currentSignedWarpMessage = signedMessageResult; // Use immediately
          updateStepStatus("signMessage", "success")
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("signMessage", "error", `Failed to aggregate signatures: ${message}`)
          setIsLoading(false)
          showBoundary(error)
          return
        }
      }

      // Step 4: Submit P-Chain Transaction
      if (!startFromStep || startFromStep === "submitPChainTx") {
        updateStepStatus("submitPChainTx", "loading")
        try {
          // Use currentSignedWarpMessage for initial run, or state for retry
          if (!currentSignedWarpMessage || currentSignedWarpMessage.length === 0) { 
            throw new Error("Signed message is empty. Please try again from the previous step.")
          }
          
          if (!publicClient) {
            throw new Error("Wallet connection not initialized")
          }
          
          const context = await Context.getContextFromURI(platformEndpoint)
          const feeState = await pvmApi.getFeeState();
          const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] });
          const pChainAddressBytes = utils.bech32ToBytes(pChainAddress)
          
          const changeValidatorWeightTx = pvm.e.newSetL1ValidatorWeightTx(
            {
              message: new Uint8Array(Buffer.from(currentSignedWarpMessage, 'hex')), // Use local variable
              feeState,
              fromAddressesBytes: [pChainAddressBytes],
              utxos,
            },
            context,
          )
          
          const changeValidatorWeightTxBytes = changeValidatorWeightTx.toBytes()
          const changeValidatorWeightTxHex = bytesToHex(changeValidatorWeightTxBytes)
          console.log("P-Chain transaction:", changeValidatorWeightTxHex)

          if (typeof window === "undefined" || !window.avalanche) {
            throw new Error("Core wallet not found")
          }

          const coreTx = await window.avalanche.request({
            method: "avalanche_sendTransaction",
            params: {
              transactionHex: changeValidatorWeightTxHex,
              chainAlias: "P"  
            }
          })
          
          console.log("Core transaction:", coreTx)
          updateStepStatus("submitPChainTx", "success")
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("submitPChainTx", "error", `Failed to submit P-Chain transaction: ${message}`)
          setIsLoading(false)
          showBoundary(error)
          return
        }
      }

      // Step 5: pChainSignature (Prepare data for final step)
      if (!startFromStep || startFromStep === "pChainSignature") {
        updateStepStatus("pChainSignature", "loading")
        try {
          if (!viemChain) {
            throw new Error("Viem chain configuration is missing.")
          }
          // Use currentValidationID for initial run, or state for retry
          if (!currentValidationID) { 
             throw new Error("Validation ID is missing. Please ensure the first step succeeded.")
          }
          if (!subnetId) {
            throw new Error("Subnet ID is missing. Please ensure the first step succeeded.")
          }
          const justification = await GetRegistrationJustification(
            nodeID,
            currentValidationID,
            subnetId,
            publicClient
          )

          if (!justification) {
            throw new Error("No justification logs found for this validation ID")
          }

          const validationIDBytes = hexToBytes(currentValidationID as `0x${string}`) // Use local variable
          const removeValidatorMessage = packL1ValidatorRegistration(
            validationIDBytes,
            false,
            avalancheNetworkID,
            "11111111111111111111111111111111LpoYY" //always from P-Chain (same on fuji and mainnet)
          )
          console.log("Remove Validator Message:", removeValidatorMessage)
          console.log("Remove Validator Message Hex:", bytesToHex(removeValidatorMessage))
          console.log("Justification:", justification)
          
          const signature = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: bytesToHex(removeValidatorMessage),
              justification: bytesToHex(justification),
              signingSubnetId: subnetId || "",
              quorumPercentage: 67,
            },
          })
          console.log("Signature:", signature)
          setPChainSignature(signature.signedMessage) // Update state
          currentPChainSignature = signature.signedMessage; // Use immediately
          updateStepStatus("pChainSignature", "success")

        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("pChainSignature", "error", `Failed to get P-Chain warp signature: ${message}`)
          setIsLoading(false)
          showBoundary(error)
          return
        }
      }

      // Step 6: completeRemoval
      if (!startFromStep || startFromStep === "completeRemoval") {
        updateStepStatus("completeRemoval", "loading")
        try {
          // Use currentPChainSignature for initial run, or state for retry
          if (!currentPChainSignature) { 
            throw new Error("P-Chain signature is missing. Please ensure the previous step succeeded.")
          }
          const signedPChainWarpMsgBytes = hexToBytes(`0x${currentPChainSignature}`)
          const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes)
          
          if (!proxyAddress) throw new Error("Proxy address is not set.");
          if (!coreWalletClient) throw new Error("Core wallet client is not initialized.");
          if (!publicClient) throw new Error("Public client is not initialized.");
          if (!viemChain) throw new Error("Viem chain is not configured.");

          let simulationResult;
          try {
            simulationResult = await publicClient.simulateContract({
              address: proxyAddress as `0x${string}`,
              abi: validatorManagerAbi.abi,
              functionName: "completeValidatorRemoval",
              args: [0],
              accessList,
              account: coreWalletClient.account, // Required for simulation with account context
              chain: viemChain
            })
            console.log("Simulation successful:", simulationResult)
          } catch (simError: any) {
            console.error("Contract simulation failed:", simError);
            // Try to extract a more specific revert reason
            const baseError = simError.cause || simError;
            const reason = baseError?.shortMessage || simError.message || "Simulation failed, reason unknown.";
            throw new Error(`Contract simulation failed: ${reason}`);
          }
          
          console.log("Simulation request:", simulationResult.request)

          let txHash;
          try {
             txHash = await coreWalletClient.writeContract(simulationResult.request)
             console.log("Transaction sent:", txHash)
          } catch (writeError: any) {
             console.error("Contract write failed:", writeError);
             const baseError = writeError.cause || writeError;
             const reason = baseError?.shortMessage || writeError.message || "Transaction submission failed, reason unknown.";
             throw new Error(`Submitting transaction failed: ${reason}`);
          }

          let receipt;
          try {
            receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
            console.log("Transaction receipt:", receipt)
            if (receipt.status !== 'success') {
               throw new Error(`Transaction failed with status: ${receipt.status}`);
            }
          } catch (receiptError: any) {
             console.error("Failed to get transaction receipt:", receiptError);
             throw new Error(`Failed waiting for transaction receipt: ${receiptError.message}`);
          }

          updateStepStatus("completeRemoval", "success")
          setSuccess(`Validator ${nodeID} removal process completed successfully.`)
          setIsProcessComplete(true) // Mark process complete here
        } catch (error: any) {
           const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("completeRemoval", "error", message) // Use the detailed error message
          setIsLoading(false)
          // showBoundary(error) // Decide if every error here should break the app or just show in the step
          return
        }
      }
        
    } catch (err: any) {
      setError(`Failed to remove validator: ${err.message}`)
      console.error(err)
      showBoundary(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container
      title="Remove Validator"
      description="Remove a validator from an Avalanche L1"
    >
      <div className="space-y-4">
        {typeof window === "undefined" && (
          <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-amber-500 mr-2 flex-shrink-0" />
              <span>This component requires a browser environment with Core wallet extension.</span>
            </div>
          </div>
        )}

        {error && !isProcessing && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Input
            id="nodeID"
            type="text"
            value={nodeID}
            onChange={(e) => setNodeID(e)}
            placeholder="Enter validator Node ID"
            className={cn(
              "w-full px-3 py-2 border rounded-md",
              "text-zinc-900 dark:text-zinc-100",
              "bg-white dark:bg-zinc-800",
              "border-zinc-300 dark:border-zinc-700",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
            )}
            label="Node ID"
            disabled={isProcessing}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Enter the Node ID of the validator you want to remove
          </p>
        </div>

        {!isProcessing && (
          <Button
            onClick={() => handleRemove()}
            disabled={isLoading || !nodeID}
          >
            {isLoading ? "Removing..." : "Remove Validator"}
          </Button>
        )}

        {isProcessing && (
          <div className="mt-4 border border-zinc-200 dark:border-zinc-700 rounded-md p-4 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">Removal Progress</h3>
              {isProcessComplete && (
                <button
                  onClick={resetRemoval}
                  className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded transition-colors"
                >
                  Start New Removal
                </button>
              )}
            </div>

            <StepIndicator
              status={removalSteps.getValidationID.status}
              label="Get Validation ID"
              error={removalSteps.getValidationID.error}
              onRetry={retryStep}
              stepKey="getValidationID"
            />

            <StepIndicator
              status={removalSteps.initiateRemoval.status}
              label="Initiate Validator Removal"
              error={removalSteps.initiateRemoval.error}
              onRetry={retryStep}
              stepKey="initiateRemoval"
            />

            <StepIndicator
              status={removalSteps.signMessage.status}
              label="Aggregate Signatures for Warp Message"
              error={removalSteps.signMessage.error}
              onRetry={retryStep}
              stepKey="signMessage"
            />

            <StepIndicator
              status={removalSteps.submitPChainTx.status}
              label="Remove Validator from P-Chain"
              error={removalSteps.submitPChainTx.error}
              onRetry={retryStep}
              stepKey="submitPChainTx"
            />

            <StepIndicator
              status={removalSteps.pChainSignature.status}
              label="Aggregate Signatures for P-Chain Warp Message"
              error={removalSteps.pChainSignature.error}
              onRetry={retryStep}
              stepKey="pChainSignature"
            />

            <StepIndicator
              status={removalSteps.completeRemoval.status}
              label="Complete Removal"
              error={removalSteps.completeRemoval.error}
              onRetry={retryStep}
              stepKey="completeRemoval"
            />

            {!isProcessComplete && (
              <Button
                onClick={resetRemoval}
                className="mt-4 w-full py-2 px-4 rounded-md text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel Removal
              </Button>
            )}
          </div>
        )}

        {isProcessComplete && success && (
          <div className="flex items-center mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-200">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Validator Removed Successfully</p>
              <p className="text-xs text-green-700 dark:text-green-300">
                {success}
              </p>
            </div>
          </div>
        )}
      </div>
    </Container>
  )
}