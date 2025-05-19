"use client"

import { useState, useEffect } from "react"
import { useErrorBoundary } from "react-error-boundary"

import { useViemChainStore } from "../../stores/toolboxStore"
import { useWalletStore } from "../../stores/walletStore"
import { useCreateChainStore } from "../../stores/createChainStore"

import { Container } from "../../components/Container"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { StepIndicator } from "../../components/StepIndicator"
import { AlertCircle, CheckCircle } from "lucide-react"
import SelectSubnetId from "../../components/SelectSubnetId"
import { ValidatorManagerDetails } from "../../components/ValidatorManagerDetails"
import SelectValidationID, { ValidationSelection } from "../../components/SelectValidationID"

import { cn } from "../../lib/utils"
import { bytesToHex, hexToBytes } from "viem"
import { networkIDs } from "@avalabs/avalanchejs"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"

import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { GetRegistrationJustification } from "./justification"
import { packL1ValidatorWeightMessage } from "../../coreViem/utils/convertWarp"
import { packWarpIntoAccessList } from "./packWarp"
import { useStepProgress, StepsConfig } from "../hooks/useStepProgress"
import { setL1ValidatorWeight } from "../../coreViem/methods/setL1ValidatorWeight"
import { useValidatorManagerDetails } from "../hooks/useValidatorManagerDetails"
import { validateStakePercentage } from "../../coreViem/hooks/getTotalStake"
import { validateContractOwner } from "../../coreViem/hooks/validateContractOwner"
import { getValidatorWeight } from "../../coreViem/hooks/getValidatorWeight"

// Define step keys and configuration
type ChangeWeightStepKey =
  | "initiateChangeWeight"
  | "signMessage"
  | "submitPChainTx"
  | "pChainSignature"
  | "completeChangeWeight"

const changeWeightStepsConfig: StepsConfig<ChangeWeightStepKey> = {
  initiateChangeWeight: "Initiate Weight Change",
  signMessage: "Aggregate Signatures for Warp Message",
  submitPChainTx: "Change Validator Weight on P-Chain",
  pChainSignature: "Aggregate Signatures for P-Chain Warp Message",
  completeChangeWeight: "Complete Weight Change",
}

export default function ChangeWeight() {
  const { showBoundary } = useErrorBoundary()

  const { coreWalletClient, pChainAddress, avalancheNetworkID, publicClient } = useWalletStore()
  const viemChain = useViemChainStore()
  const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId)

  // --- Form Input State ---
  const [validation, setValidation] = useState<ValidationSelection>({ validationId: "", nodeId: "" })
  const [weight, setWeight] = useState("")
  const [subnetId, setSubnetId] = useState(createChainStoreSubnetId || "")
  const {
    validatorManagerAddress,
    signingSubnetId,
    error: validatorManagerError,
    isLoading: isLoadingVMCDetails,
    contractTotalWeight,
    blockchainId
  } = useValidatorManagerDetails({ subnetId });

  // Add isContractOwner state
  const [isContractOwner, setIsContractOwner] = useState<boolean | null>(null)

  // --- Intermediate Data State ---
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState("")
  const [signedWarpMessage, setSignedWarpMessage] = useState("")
  const [pChainSignature, setPChainSignature] = useState("")
  const [eventData, setEventData] = useState<{
    validationID: `0x${string}`;
    nonce: bigint;
    weight: bigint;
    messageID: `0x${string}`;
  } | null>(null)

  // Initialize the hook
  const {
    steps,
    stepKeys,
    stepsConfig: config,
    isProcessing,
    isProcessComplete,
    error,
    success,
    updateStepStatus,
    resetSteps,
    startProcessing,
    completeProcessing,
    handleRetry,
    setError,
  } = useStepProgress<ChangeWeightStepKey>(changeWeightStepsConfig)

  const networkName = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "fuji"

  // Check if the user is the contract owner when validatorManagerAddress changes
  useEffect(() => {
    const checkOwnership = async () => {
      if (validatorManagerAddress && publicClient && coreWalletClient) {
        try {
          const [account] = await coreWalletClient.requestAddresses()
          const ownershipValidated = await validateContractOwner(
            publicClient,
            validatorManagerAddress as `0x${string}`,
            account
          )
          setIsContractOwner(ownershipValidated)
        } catch (error) {
          setIsContractOwner(false)
        }
      }
    }

    checkOwnership()
  }, [validatorManagerAddress, publicClient, coreWalletClient])

  const [componentKey, setComponentKey] = useState<number>(0)

  const handleChangeWeight = async (startFromStep?: ChangeWeightStepKey) => {
    // Initial Form Validation
    if (!validation.validationId.trim()) {
      setError("Validation ID is required")
      return
    }
    if (!validation.nodeId.trim()) {
      setError("Node ID is required")
      return
    }
    if (!weight.trim()) {
      setError("Weight is required")
      return
    }
    const weightNum = Number(weight)
    if (isNaN(weightNum) || weightNum <= 0) {
      setError("Weight must be a positive number")
      return
    }
    if (!validatorManagerAddress) {
      setError("Validator Manager Address is required. Please select a valid L1 subnet.")
      return
    }

    // Check if user is contract owner
    if (isContractOwner === false) {
      setError("You are not the owner of this contract. Only the contract owner can change validator weights.")
      return
    }

    // Get the validation ID and current weight before validating the percentage
    let validatorCurrentWeight: bigint | null = null;

    try {
      // Only do this preflight check if we're starting fresh
      if (!startFromStep) {
        // Use the selected validation ID directly
        const validatorValidationID = validation.validationId;

        if (validatorValidationID) {
          validatorCurrentWeight = await getValidatorWeight(
            publicClient,
            validatorManagerAddress as `0x${string}`,
            validatorValidationID
          );

          // Log these values to understand what's happening
          console.log("Pre-flight Check: contractTotalWeight", contractTotalWeight);
          console.log("Pre-flight Check: validatorCurrentWeight", validatorCurrentWeight);
          console.log("Pre-flight Check: new weight (BigInt)", BigInt(weight));

          if (contractTotalWeight > 0n) {
            const weightBigInt = BigInt(weight)
            const validationDetails = validateStakePercentage(
              contractTotalWeight,
              weightBigInt,
              validatorCurrentWeight || 0n
            );

            // Log validationDetails
            console.log("Pre-flight Check: validationDetails", validationDetails);

            if (validationDetails.exceedsMaximum) {
              const weightAdjustment = weightBigInt > (validatorCurrentWeight || 0n)
                ? weightBigInt - (validatorCurrentWeight || 0n)
                : (validatorCurrentWeight || 0n) - weightBigInt;
              const currentWeightDisplay = validatorCurrentWeight?.toString() || "0";
              const errorMessage = `The proposed weight change from ${currentWeightDisplay} to ${weight} (an adjustment of ${weightAdjustment}) represents ${validationDetails.percentageChange.toFixed(2)}% of the current total L1 stake (${contractTotalWeight}). This adjustment percentage must be less than 20%.`;
              setError(errorMessage);
              return;
            }
          }
        }
      }
    } catch (error: any) {
      setError(`Validation pre-check failed: ${error.message || String(error)}`);
      return; // Stop processing if pre-flight check itself fails
    }

    // Start processing if it's a fresh run
    if (!startFromStep) {
      startProcessing()
    }

    // Local variables for synchronous data passing
    let localUnsignedWarpMessage = startFromStep ? unsignedWarpMessage : "";
    let localSignedMessage = startFromStep ? signedWarpMessage : "";
    let localPChainSignature = startFromStep ? pChainSignature : "";
    let localEventData = startFromStep ? eventData : null;

    try {
      // Step 1: Initiate Change Weight
      if (!startFromStep || startFromStep === "initiateChangeWeight") {
        updateStepStatus("initiateChangeWeight", "loading")
        try {
          const validationIDToUse = validation.validationId;
          if (!validationIDToUse) {
            throw new Error("Validation ID is missing.")
          }

          const weightBigInt = BigInt(weight)

          const changeWeightTx = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "initiateValidatorWeightUpdate",
            args: [validationIDToUse, weightBigInt],
            chain: viemChain,
            account: coreWalletClient.account,
          })

          if (!publicClient) {
            throw new Error("Wallet connection not initialized")
          }

          const receipt = await publicClient.waitForTransactionReceipt({ hash: changeWeightTx })

          // Update local and state
          const currentUnsignedWarpMessage = receipt.logs[0].data || ""
          setUnsignedWarpMessage(currentUnsignedWarpMessage)
          localUnsignedWarpMessage = currentUnsignedWarpMessage;

          try {
            const eventTopic = "0x6e350dd49b060d87f297206fd309234ed43156d890ced0f139ecf704310481d3"
            const eventLog = receipt.logs.find((log: unknown) => {
              const typedLog = log as { topics: string[] }
              return typedLog.topics[0].toLowerCase() === eventTopic.toLowerCase()
            })
            const typedEventLog = eventLog as { topics: string[]; data: string } | undefined

            if (typedEventLog) {
              const dataWithoutPrefix = typedEventLog.data.slice(2)
              try {
                const nonce = BigInt("0x" + dataWithoutPrefix.slice(0, 64))
                const messageID = "0x" + dataWithoutPrefix.slice(64, 128)
                const eventWeight = BigInt("0x" + dataWithoutPrefix.slice(128, 192)) || weightBigInt

                const eventDataObj = {
                  validationID: typedEventLog.topics[1] as `0x${string}`,
                  nonce,
                  messageID: messageID as `0x${string}`,
                  weight: eventWeight
                }
                // Update local and state
                setEventData(eventDataObj)
                localEventData = eventDataObj;
                console.log("Saved event data:", eventDataObj)
              } catch (parseError) {
                // Clear local and state
                setEventData(null)
                localEventData = null;
              }
            } else {
              console.warn("Could not find InitiatedValidatorWeightUpdate event log")
              // Clear local and state
              setEventData(null)
              localEventData = null;
            }
          } catch (decodeError) {
            console.warn("Error decoding event data:", decodeError)
            // Clear local and state
            setEventData(null)
            localEventData = null;
          }

          updateStepStatus("initiateChangeWeight", "success")
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error)
          updateStepStatus("initiateChangeWeight", "error", `Failed to initiate weight change: ${message}`)
          return
        }
      }

      // Step 2: Sign Warp Message
      if (!startFromStep || startFromStep === "signMessage") {
        updateStepStatus("signMessage", "loading")
        try {
          // Use local var first, fallback to state for retry
          const warpMessageToSign = localUnsignedWarpMessage || unsignedWarpMessage;
          if (!warpMessageToSign || warpMessageToSign.length === 0) {
            throw new Error("Warp message is empty. Retry step 1.")
          }

          const { signedMessage: signedMessageResult } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: warpMessageToSign,
              signingSubnetId: signingSubnetId || subnetId,
              quorumPercentage: 67,
            },
          })

          // Update local and state
          setSignedWarpMessage(signedMessageResult)
          localSignedMessage = signedMessageResult;
          console.log("Signed message:", signedMessageResult)
          updateStepStatus("signMessage", "success")
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error)
          updateStepStatus("signMessage", "error", `Failed to aggregate signatures: ${message}`)
          return
        }
      }

      // Step 3: Submit P-Chain Transaction
      if (!startFromStep || startFromStep === "submitPChainTx") {
        updateStepStatus("submitPChainTx", "loading")
        try {
          // Use local var first, fallback to state for retry
          const signedMessageToSubmit = localSignedMessage || signedWarpMessage;
          if (!signedMessageToSubmit || signedMessageToSubmit.length === 0) {
            throw new Error("Signed message is empty. Retry step 2.")
          }

          if (typeof window === "undefined" || !window.avalanche) {
            throw new Error("Core wallet not found")
          }

          // Call the new coreViem method to set validator weight on P-Chain
          const pChainTxId = await setL1ValidatorWeight(coreWalletClient, {
            pChainAddress: pChainAddress!,
            signedWarpMessage: signedMessageToSubmit,
          })

          console.log("P-Chain transaction ID:", pChainTxId)
          updateStepStatus("submitPChainTx", "success")
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error)
          updateStepStatus("submitPChainTx", "error", `Failed to submit P-Chain transaction: ${message}`)
          return
        }
      }

      // Step 4: pChainSignature (Prepare data for final step)
      if (!startFromStep || startFromStep === "pChainSignature") {
        updateStepStatus("pChainSignature", "loading")
        try {
          // Use local vars first, fallback to state for retry
          const eventDataForPacking = localEventData || eventData;

          if (!viemChain) throw new Error("Viem chain configuration is missing.")
          if (!validation.validationId) throw new Error("Validation ID is missing.")
          if (!subnetId) throw new Error("Subnet ID is missing.")
          if (!eventDataForPacking) throw new Error("Event data missing. Retry step 1.")

          const justification = await GetRegistrationJustification(
            validation.nodeId,
            validation.validationId,
            subnetId,
            publicClient
          )

          if (!justification) {
            throw new Error("No justification logs found for this validation ID")
          }

          console.log("Using event data:", eventDataForPacking)
          const warpValidationID = hexToBytes(eventDataForPacking.validationID)
          const warpNonce = eventDataForPacking.nonce
          const warpWeight = eventDataForPacking.weight

          const changeWeightMessage = packL1ValidatorWeightMessage({
            validationID: warpValidationID,
            nonce: warpNonce,
            weight: warpWeight,
          },
            avalancheNetworkID,
            "11111111111111111111111111111111LpoYY"
          )
          console.log("Change Weight Message Hex:", bytesToHex(changeWeightMessage))
          console.log("Justification:", justification)

          const signature = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: bytesToHex(changeWeightMessage),
              justification: bytesToHex(justification),
              signingSubnetId: signingSubnetId || subnetId,
              quorumPercentage: 67,
            },
          })

          // Update local and state
          setPChainSignature(signature.signedMessage)
          localPChainSignature = signature.signedMessage;
          console.log("Signature:", signature)
          updateStepStatus("pChainSignature", "success")

        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error)
          updateStepStatus("pChainSignature", "error", `Failed to get P-Chain warp signature: ${message}`)
          return
        }
      }

      // Step 5: completeChangeWeight
      if (!startFromStep || startFromStep === "completeChangeWeight") {
        updateStepStatus("completeChangeWeight", "loading")
        try {
          // Use local var first, fallback to state for retry
          const finalPChainSig = localPChainSignature || pChainSignature;
          if (!finalPChainSig) {
            throw new Error("P-Chain signature is missing. Retry the previous step before this one.")
          }

          const signedPChainWarpMsgBytes = hexToBytes(`0x${finalPChainSig}`) // Use potentially updated local sig
          const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes)

          if (!validatorManagerAddress) throw new Error("Validator Manager address is not set.")
          if (!coreWalletClient) throw new Error("Core wallet client is not initialized.")
          if (!publicClient) throw new Error("Public client is not initialized.")
          if (!viemChain) throw new Error("Viem chain is not configured.")


          const hash = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "completeValidatorWeightUpdate",
            args: [0],
            accessList,
            account: coreWalletClient.account,
            chain: viemChain
          })
          console.log("Transaction sent:", hash)

          let receipt
          try {
            receipt = await publicClient.waitForTransactionReceipt({ hash })
            console.log("Transaction receipt:", receipt)
            if (receipt.status !== 'success') {
              throw new Error(`Transaction failed with status: ${receipt.status}`)
            }
          } catch (receiptError: any) {
            throw new Error(`Failed waiting for transaction receipt: ${receiptError.message}`)
          }

          updateStepStatus("completeChangeWeight", "success")
          completeProcessing(`Validator ${validation.nodeId} weight changed to ${weight}.`)
          
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error)
          updateStepStatus("completeChangeWeight", "error", message)
          return
        }
      }

    } catch (err: any) {
      setError(`Failed to change validator weight: ${err.message}`)
      showBoundary(err)
    }
  }

  const handleReset = () => {
    resetSteps();
    setValidation({ validationId: "", nodeId: "" });
    setWeight("");
    setComponentKey(prevKey => prevKey + 1); // Keep the refresh on reset
  }

  const handleCancel = () => {
    resetSteps();
    setValidation({ validationId: "", nodeId: "" });
    setWeight("");
    // Don't increment componentKey here
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

        {isContractOwner === false && !error && !isProcessing && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
              <span>You are not the owner of this contract. Only the contract owner can change validator weights.</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <SelectSubnetId
            value={subnetId}
            onChange={setSubnetId}
            error={validatorManagerError}
            hidePrimaryNetwork={true}
          />
          <ValidatorManagerDetails
            validatorManagerAddress={validatorManagerAddress}
            blockchainId={blockchainId}
            subnetId={subnetId}
            isLoading={isLoadingVMCDetails}
          />
        </div>

        <div className="space-y-2">
          <SelectValidationID
            key={`validation-selector-${componentKey}-${subnetId}`}
            value={validation.validationId}
            onChange={setValidation}
            subnetId={subnetId}
            format="hex"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Select a validator from the list or enter a validation ID
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
            disabled={isProcessing || !validation.validationId || !validation.nodeId || !weight || !validatorManagerAddress || !!validatorManagerError || isLoadingVMCDetails || isContractOwner === false}
            error={validatorManagerError || (!validatorManagerAddress ? "Select a valid L1 subnet" : "") || (isContractOwner === false ? "Not the contract owner" : "")}
          >
            {"Change Weight"}
          </Button>
        )}

        {isProcessing && (
          <div className="mt-4 border border-zinc-200 dark:border-zinc-700 rounded-md p-4 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">Change Weight Progress</h3>
              {isProcessComplete && (
                <button
                  onClick={handleReset}
                  className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded transition-colors"
                >
                  Start New Change
                </button>
              )}
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 italic">Click on any step to retry from that point</p>

            {stepKeys.map((stepKey) => (
              <StepIndicator
                key={stepKey}
                status={steps[stepKey].status}
                label={config[stepKey]}
                error={steps[stepKey].error}
                onRetry={() => handleRetry(stepKey, handleChangeWeight)}
                stepKey={stepKey}
              />
            ))}

            {!isProcessComplete && (
              <Button
                onClick={handleCancel}
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

