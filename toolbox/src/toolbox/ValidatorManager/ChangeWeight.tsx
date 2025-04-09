"use client"

import { useState } from "react"
import { useErrorBoundary } from "react-error-boundary"

import { useToolboxStore, useViemChainStore } from "../toolboxStore"
import { useWalletStore } from "../../lib/walletStore"

import { Container } from "../components/Container"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { StepIndicator, StepStatus } from "../components/StepIndicator"
import { AlertCircle, CheckCircle } from "lucide-react"

import { cn } from "../../lib/utils"
import { bytesToHex, hexToBytes } from "viem"
import { pvm, utils, Context, networkIDs } from "@avalabs/avalanchejs"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import { getRPCEndpoint } from "../../coreViem/utils/rpc"

import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { GetRegistrationJustification } from "./justification"
import { packL1ValidatorWeightMessage } from "../../coreViem/utils/convertWarp"
import { packWarpIntoAccessList } from "../InitializePoA/packWarp"
import { getValidationIdHex } from "../../coreViem/hooks/getValidationID"

interface ChangeWeightSteps {
  getValidationID: StepStatus
  initiateChangeWeight: StepStatus
  signMessage: StepStatus
  submitPChainTx: StepStatus
  pChainSignature: StepStatus
  completeChangeWeight: StepStatus
}

export default function ChangeWeight() {
  const { showBoundary } = useErrorBoundary()

  const { proxyAddress, subnetId } = useToolboxStore()
  const { coreWalletClient, pChainAddress, avalancheNetworkID, publicClient } = useWalletStore() 
  const viemChain = useViemChainStore()

  const [nodeID, setNodeID] = useState("")
  const [weight, setWeight] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isProcessComplete, setIsProcessComplete] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [validationIDHex, setValidationIDHex] = useState("")
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState("")
  const [signedWarpMessage, setSignedWarpMessage] = useState("")
  const [pChainSignature, setPChainSignature] = useState("")

  const platformEndpoint = getRPCEndpoint(avalancheNetworkID !== networkIDs.MainnetID)
  const networkName = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "fuji"
  const pvmApi = new pvm.PVMApi(platformEndpoint)

  // Add state variables for event data
  const [eventData, setEventData] = useState<{
    validationID: `0x${string}`;
    nonce: bigint;
    weight: bigint;
    messageID: `0x${string}`;
  } | null>(null)
  
  // Track steps for change weight process
  const [changeWeightSteps, setChangeWeightSteps] = useState<ChangeWeightSteps>({
    getValidationID: { status: "pending" },
    initiateChangeWeight: { status: "pending" },
    signMessage: { status: "pending" },
    submitPChainTx: { status: "pending" },
    pChainSignature: { status: "pending" },
    completeChangeWeight: { status: "pending" },
  })

  // Update step status helper
  const updateStepStatus = (step: keyof ChangeWeightSteps, status: StepStatus["status"], error?: string) => {
    setChangeWeightSteps((prev) => ({
      ...prev,
      [step]: { status, error },
    }))
  }

  // Reset the change weight process
  const resetChangeWeight = () => {
    setIsProcessing(false)
    setIsProcessComplete(false)
    setError(null)
    setSuccess(null)
    Object.keys(changeWeightSteps).forEach((step) => {
      updateStepStatus(step as keyof ChangeWeightSteps, "pending")
    })
  }
  // Handle retry of a specific step
  const retryStep = async (step: keyof ChangeWeightSteps) => {
    // Reset status of current step and all following steps
    const steps = Object.keys(changeWeightSteps) as Array<keyof ChangeWeightSteps>
    const stepIndex = steps.indexOf(step)

    // Only reset the statuses from the failed step onwards
    steps.slice(stepIndex).forEach((currentStep) => {
      updateStepStatus(currentStep, "pending")
    })

    // Start the change weight process from the failed step
    await handleChangeWeight(step)
  }

  const handleChangeWeight = async (startFromStep?: keyof ChangeWeightSteps) => {
    if (!nodeID.trim()) {
      setError("Node ID is required")
      return
    }

    if (!weight.trim()) {
      setError("Weight is required")
      return
    }

    // Validate weight is a number
    const weightNum = Number(weight)
    if (isNaN(weightNum) || weightNum <= 0) {
      setError("Weight must be a positive number")
      return
    }

    if (!startFromStep) {
      setIsProcessing(true)
      setIsProcessComplete(false)
      setError(null)
      setSuccess(null)
      Object.keys(changeWeightSteps).forEach((step) => {
        updateStepStatus(step as keyof ChangeWeightSteps, "pending")
      })
    }

    // --- Local variables to pass results synchronously during initial run --- 
    let currentValidationID = validationIDHex; // Initialize with state for retries
    let currentUnsignedWarpMessage = unsignedWarpMessage; // Initialize with state for retries
    let currentSignedWarpMessage = signedWarpMessage; // Initialize with state for retries
    let currentPChainSignature = pChainSignature; // Initialize with state for retries
    let currentEventData = eventData; // Initialize with state for retries
    // --- End local variables --- 

    try {
      setIsLoading(true)

      // Step 1: Get ValidationID
      if (!startFromStep || startFromStep === "getValidationID") {
        updateStepStatus("getValidationID", "loading")
        try {
          const validationIDResult = await getValidationIdHex(publicClient, proxyAddress as `0x${string}`, nodeID)
          setValidationIDHex(validationIDResult as string)
          currentValidationID = validationIDResult as string;
          console.log("ValidationID:", validationIDResult)
          updateStepStatus("getValidationID", "success")
        } catch (error: any) {
          updateStepStatus("getValidationID", "error", error.message)
          setIsLoading(false)
          showBoundary(error)
          return
        }
      }

      // Step 2: Initiate Change Weight
      if (!startFromStep || startFromStep === "initiateChangeWeight") {
        updateStepStatus("initiateChangeWeight", "loading")
        try {
          if (!currentValidationID) { 
            throw new Error("Validation ID is missing. Please ensure the previous step succeeded.")
          }
          
          // Convert weight to uint64 (BigInt) for Solidity
          const weightBigInt = BigInt(weight);
          
          const changeWeightTx = await coreWalletClient.writeContract({
            address: proxyAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "initiateValidatorWeightUpdate",
            args: [currentValidationID, weightBigInt], // Use validation ID and weight as BigInt
            chain: viemChain,
            account: coreWalletClient.account,
          })
          
          console.log("Change weight transaction:", changeWeightTx)
          
          if (!publicClient) {
            throw new Error("Wallet connection not initialized")
          }
          
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: changeWeightTx
          })
          
          console.log("Receipt:", receipt)
          
          const warpMessageResult = receipt.logs[0].data || ""
          setUnsignedWarpMessage(warpMessageResult)
          currentUnsignedWarpMessage = warpMessageResult;
          
          // Decode event data from logs
          try {
            // The correct event topic hash for InitiatedValidatorWeightUpdate
            const eventTopic = "0x6e350dd49b060d87f297206fd309234ed43156d890ced0f139ecf704310481d3"
            const eventLog = receipt.logs.find((log: unknown) => {
              // Type assertion inside the function body
              const typedLog = log as { topics: string[] };
              return typedLog.topics[0].toLowerCase() === eventTopic.toLowerCase();
            })
            
            // Type assertion for eventLog
            const typedEventLog = eventLog as { topics: string[]; data: string } | undefined;
            
            if (typedEventLog) {
              console.log("Found event log:", typedEventLog);
              
              // Extract data from the event
              // InitiatedValidatorWeightUpdate(bytes32 indexed validationID, uint64 nonce, bytes32 weightUpdateMessageID, uint64 weight)
              // Topics[0] is the event signature
              // Topics[1] is the indexed validationID
              const validationID = typedEventLog.topics[1];
              
              // Data contains nonce, messageID, and weight (non-indexed parameters)
              // Parse the data - remove '0x' prefix and convert to a readable format
              const dataWithoutPrefix = typedEventLog.data.slice(2);
              
              try {
                // Each parameter is 32 bytes (64 hex chars)
                // Using BigInt for proper parsing of uint64 values
                const nonce = BigInt("0x" + dataWithoutPrefix.slice(0, 64));
                const messageID = "0x" + dataWithoutPrefix.slice(64, 128);
                const weight = BigInt("0x" + dataWithoutPrefix.slice(128, 192)) || weightBigInt; // Fallback to input weight if needed
                
                const eventDataObj = {
                  validationID: validationID as `0x${string}`,
                  nonce,
                  messageID: messageID as `0x${string}`,
                  weight
                }
                console.log("Extracted event data:", eventDataObj)
                setEventData(eventDataObj)
                currentEventData = eventDataObj; // Store in local variable
              } catch (parseError) {
                console.error("Error parsing event data:", parseError, {
                  dataWithoutPrefix,
                  dataLength: dataWithoutPrefix.length
                });
                // Don't set eventData if parsing fails
                currentEventData = null; // Also ensure local variable is marked as null
              }
            } else {
              console.warn("Could not find event log with topic:", eventTopic);
              
              // Check all logs for debugging
              receipt.logs.forEach((log: unknown, index: number) => {
                console.log(`Log ${index} topics:`, (log as any).topics);
              });
            }
          } catch (decodeError) {
            console.warn("Error decoding event data:", decodeError)
            // Continue anyway as we'll fall back to unpacking method if needed
          }
          
          updateStepStatus("initiateChangeWeight", "success")
        } catch (error: any) {
          // Extract base error message if available
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("initiateChangeWeight", "error", `Failed to initiate weight change: ${message}`)
          setIsLoading(false)
          showBoundary(error)
          return
        }
      }

      // Step 3: Sign Warp Message
      if (!startFromStep || startFromStep === "signMessage") {
        updateStepStatus("signMessage", "loading")
        try {
          if (!currentUnsignedWarpMessage || currentUnsignedWarpMessage.length === 0) { 
            throw new Error("Warp message is empty. Please try again from the previous step.")
          }
          
          const { signedMessage: signedMessageResult } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: currentUnsignedWarpMessage,
              signingSubnetId: subnetId || "",
              quorumPercentage: 67,
            },
          })
          
          console.log("Signed message:", signedMessageResult)
          setSignedWarpMessage(signedMessageResult)
          currentSignedWarpMessage = signedMessageResult;
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
          if (!currentSignedWarpMessage || currentSignedWarpMessage.length === 0) { 
            throw new Error("Signed message is empty. Please try again from the previous step.")
          }
          
          if (!publicClient) {
            throw new Error("Wallet connection not initialized")
          }
          
          const feeState = await pvmApi.getFeeState();
          const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] });
          const pChainAddressBytes = utils.bech32ToBytes(pChainAddress)
          
          const changeValidatorWeightTx = pvm.e.newSetL1ValidatorWeightTx(
            {
              message: new Uint8Array(Buffer.from(currentSignedWarpMessage, 'hex')),
              feeState,
              fromAddressesBytes: [pChainAddressBytes],
              utxos,
            },
            await Context.getContextFromURI(platformEndpoint),
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

          // Simply check if event data exists
          if (!currentEventData) {
            throw new Error("Event data could not be extracted from transaction logs. Please restart the process.")
          }
          
          console.log("Using event data from logs:", currentEventData)
          // Convert hex validationID to Uint8Array for packing
          const warpValidationID = hexToBytes(currentEventData.validationID);
          const warpNonce = currentEventData.nonce;
          const warpWeight = currentEventData.weight;
          
          const changeWeightMessage = packL1ValidatorWeightMessage({
            validationID: warpValidationID,
            nonce: warpNonce,
            weight: warpWeight,
          },
            avalancheNetworkID,
            "11111111111111111111111111111111LpoYY" //always from P-Chain (same on fuji and mainnet)
          )
          console.log("Change Weight Message:", changeWeightMessage)
          console.log("Change Weight Message Hex:", bytesToHex(changeWeightMessage))
          console.log("Justification:", justification)
          
          const signature = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: bytesToHex(changeWeightMessage),
              justification: bytesToHex(justification),
              signingSubnetId: subnetId || "",
              quorumPercentage: 67,
            },
          })
          console.log("Signature:", signature)
          setPChainSignature(signature.signedMessage)
          currentPChainSignature = signature.signedMessage;
          updateStepStatus("pChainSignature", "success")

        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("pChainSignature", "error", `Failed to get P-Chain warp signature: ${message}`)
          setIsLoading(false)
          showBoundary(error)
          return
        }
      }

      // Step 6: completeChangeWeight
      if (!startFromStep || startFromStep === "completeChangeWeight") {
        updateStepStatus("completeChangeWeight", "loading")
        try {
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
              functionName: "completeValidatorWeightUpdate",
              args: [0],
              accessList,
              account: coreWalletClient.account,
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
          
          updateStepStatus("completeChangeWeight", "success")
          setSuccess(`Validator ${nodeID} weight has been changed to ${weight} successfully.`)
          setIsProcessComplete(true)
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("completeChangeWeight", "error", message)
          setIsLoading(false)
          return
        }
      }
        
    } catch (err: any) {
      setError(`Failed to change validator weight: ${err.message}`)
      console.error(err)
      showBoundary(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container title="Change Validator Weight" description="Modify a validator's weight on an Avalanche L1">
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
            Enter the Node ID of the validator you want to modify
          </p>
        </div>

        <div className="space-y-2">
          <Input
            id="weight"
            type="text"
            value={weight}
            onChange={(e) => setWeight(e)}
            placeholder="Enter new weight"
            className={cn(
              "w-full px-3 py-2 border rounded-md",
              "text-zinc-900 dark:text-zinc-100",
              "bg-white dark:bg-zinc-800",
              "border-zinc-300 dark:border-zinc-700",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
            )}
            label="Weight"
            disabled={isProcessing}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Enter the new weight for this validator</p>
        </div>

        {!isProcessing && (
          <Button
            onClick={() => handleChangeWeight()}
            disabled={isLoading || !nodeID || !weight}
          >
            {isLoading ? "Changing Weight..." : "Change Weight"}
          </Button>
        )}

        {isProcessing && (
          <div className="mt-4 border border-zinc-200 dark:border-zinc-700 rounded-md p-4 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">Change Weight Progress</h3>
              {isProcessComplete && (
                <button
                  onClick={resetChangeWeight}
                  className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded transition-colors"
                >
                  Start New Change
                </button>
              )}
            </div>

            <StepIndicator
              status={changeWeightSteps.getValidationID.status}
              label="Get Validation ID"
              error={changeWeightSteps.getValidationID.error}
              onRetry={retryStep}
              stepKey="getValidationID"
            />

            <StepIndicator
              status={changeWeightSteps.initiateChangeWeight.status}
              label="Initiate Weight Change"
              error={changeWeightSteps.initiateChangeWeight.error}
              onRetry={retryStep}
              stepKey="initiateChangeWeight"
            />

            <StepIndicator
              status={changeWeightSteps.signMessage.status}
              label="Aggregate Signatures for Warp Message"
              error={changeWeightSteps.signMessage.error}
              onRetry={retryStep}
              stepKey="signMessage"
            />

            <StepIndicator
              status={changeWeightSteps.submitPChainTx.status}
              label="Change Validator Weight on P-Chain"
              error={changeWeightSteps.submitPChainTx.error}
              onRetry={retryStep}
              stepKey="submitPChainTx"
            />

            <StepIndicator
              status={changeWeightSteps.pChainSignature.status}
              label="Aggregate Signatures for P-Chain Warp Message"
              error={changeWeightSteps.pChainSignature.error}
              onRetry={retryStep}
              stepKey="pChainSignature"
            />

            <StepIndicator
              status={changeWeightSteps.completeChangeWeight.status}
              label="Complete Weight Change"
              error={changeWeightSteps.completeChangeWeight.error}
              onRetry={retryStep}
              stepKey="completeChangeWeight"
            />

            {!isProcessComplete && (
              <Button
                onClick={resetChangeWeight}
                className="mt-4 w-full py-2 px-4 rounded-md text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel Weight Change
              </Button>
            )}
          </div>
        )}

        {isProcessComplete && success && (
          <div className="flex items-center mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-200">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Validator Weight Changed Successfully</p>
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

