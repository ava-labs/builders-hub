"use client"

import { useState, useEffect } from "react"
import { useToolboxStore, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { Container } from "../components/Container"
import { cn } from "../../lib/utils"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { custom, fromBytes, createPublicClient, bytesToHex } from "viem";
import { pvm, utils, Context, networkIDs } from "@avalabs/avalanchejs";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { useErrorBoundary } from "react-error-boundary"

// Define interfaces for step status tracking
interface StepStatus {
  status: "pending" | "loading" | "success" | "error"
  error?: string
}

interface RemovalSteps {
  getValidationID: StepStatus
  initiateRemoval: StepStatus
  signMessage: StepStatus
  submitPChainTx: StepStatus
}

const parseNodeID = (nodeID: string) => {
  const nodeIDWithoutPrefix = nodeID.replace("NodeID-", "");
  const decodedID = utils.base58.decode(nodeIDWithoutPrefix)
  const nodeIDHex = fromBytes(decodedID, 'hex')
  const nodeIDHexTrimmed = nodeIDHex.slice(0, -8)
  return nodeIDHexTrimmed
}

export default function RemoveValidator() {
  const { showBoundary } = useErrorBoundary()
  const [nodeID, setNodeID] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { proxyAddress, subnetId } = useToolboxStore()
  const { coreWalletClient, pChainAddress, avalancheNetworkID } = useWalletStore()
  const viemChain = useViemChainStore()
  const [networkName, setNetworkName] = useState<"fuji" | "mainnet" | undefined>(undefined)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isProcessComplete, setIsProcessComplete] = useState(false)
  const [validationIDHex, setValidationIDHex] = useState("")
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState("")
  const [signedWarpMessage, setSignedWarpMessage] = useState("")
  
  // Track steps for removal process
  const [removalSteps, setRemovalSteps] = useState<RemovalSteps>({
    getValidationID: { status: "pending" },
    initiateRemoval: { status: "pending" },
    signMessage: { status: "pending" },
    submitPChainTx: { status: "pending" },
  })

  // For component-level variables that won't be affected by state update delays
  let lastValidationID = ""
  let lastUnsignedWarpMessage = ""
  let lastSignedWarpMessage = ""

  // Set the network endpoint based on network ID
  var platformEndpoint = "https://api.avax-test.network"
  useEffect(() => {
    if (avalancheNetworkID === networkIDs.MainnetID) {
      platformEndpoint = "https://api.avax.network"
      setNetworkName("mainnet")
    } else if (avalancheNetworkID === networkIDs.FujiID) {
      platformEndpoint = "https://api.avax-test.network"
      setNetworkName("fuji")
    } else {
      showBoundary(new Error("Unsupported network with ID " + avalancheNetworkID))
    }
  }, [avalancheNetworkID, showBoundary])

  const [publicClient, setPublicClient] = useState<any>(null)
  
  useEffect(() => {
    if (typeof window !== "undefined" && window.avalanche) {
      setPublicClient(createPublicClient({
        transport: custom(window.avalanche),
      }))
    }
  }, [])

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

  const fetchValidationID = async (nodeID: string) => {
    try {
      // Convert NodeID to bytes format
      const nodeIDBytes = parseNodeID(nodeID)

      if (!publicClient) {
        throw new Error("Wallet connection not initialized")
      }

      // Call the registeredValidators function
      const validationID = await publicClient.readContract({
        address: proxyAddress as `0x${string}`,
        abi: validatorManagerAbi.abi,
        functionName: "registeredValidators",
        args: [nodeIDBytes]
      })

      return validationID
    } catch (error: any) {
      throw new Error(`Failed to get validation ID: ${error.message}`)
    }
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

    try {
      setIsLoading(true)

      // Step 1: Get ValidationID
      if (!startFromStep || startFromStep === "getValidationID") {
        updateStepStatus("getValidationID", "loading")
        try {
          const validationID = await fetchValidationID(nodeID)
          setValidationIDHex(validationID as string)
          lastValidationID = validationID as string
          console.log("ValidationID:", validationID)
          updateStepStatus("getValidationID", "success")
        } catch (error: any) {
          updateStepStatus("getValidationID", "error", error.message)
          showBoundary(error)
          setIsLoading(false)
          return
        }
      }

      // Step 2: Initiate Validator Removal
      if (!startFromStep || startFromStep === "initiateRemoval") {
        updateStepStatus("initiateRemoval", "loading")
        try {
          const validationIDToUse = lastValidationID || validationIDHex
          
          const removeValidatorTx = await coreWalletClient.writeContract({
            address: proxyAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "initiateValidatorRemoval",
            args: [validationIDToUse],
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
          
          const warpMessage = receipt.logs[0].data || ""
          setUnsignedWarpMessage(warpMessage)
          lastUnsignedWarpMessage = warpMessage
          updateStepStatus("initiateRemoval", "success")
        } catch (error: any) {
          updateStepStatus("initiateRemoval", "error", error.message)
          showBoundary(error)
          setIsLoading(false)
          return
        }
      }

      // Step 3: Sign Warp Message
      if (!startFromStep || startFromStep === "signMessage") {
        updateStepStatus("signMessage", "loading")
        try {
          const messageToSign = lastUnsignedWarpMessage || unsignedWarpMessage
          
          if (!messageToSign || messageToSign.length === 0) {
            throw new Error("Warp message is empty. Please try again from the previous step.")
          }
          
          const { signedMessage } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: messageToSign,
              signingSubnetId: subnetId || "",
              quorumPercentage: 67,
            },
          })
          
          console.log("Signed message:", signedMessage)
          setSignedWarpMessage(signedMessage)
          lastSignedWarpMessage = signedMessage
          updateStepStatus("signMessage", "success")
        } catch (error: any) {
          updateStepStatus("signMessage", "error", error.message)
          showBoundary(error)
          setIsLoading(false)
          return
        }
      }

      // Step 4: Submit P-Chain Transaction
      if (!startFromStep || startFromStep === "submitPChainTx") {
        updateStepStatus("submitPChainTx", "loading")
        try {
          const signedMessage = lastSignedWarpMessage || signedWarpMessage
          
          if (!signedMessage || signedMessage.length === 0) {
            throw new Error("Signed message is empty. Please try again from the previous step.")
          }
          
          if (!publicClient) {
            throw new Error("Wallet connection not initialized")
          }
          
          const context = await Context.getContextFromURI(platformEndpoint)
          const pvmApi = new pvm.PVMApi(platformEndpoint)
          const feeState = await pvmApi.getFeeState();
          const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] });
          const pChainAddressBytes = utils.bech32ToBytes(pChainAddress)
          
          const changeValidatorWeightTx = pvm.e.newSetL1ValidatorWeightTx(
            {
              message: new Uint8Array(Buffer.from(signedMessage, 'hex')),
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
          setSuccess(`Validator ${nodeID} successfully removed.`)
          setIsProcessComplete(true)
        } catch (error: any) {
          updateStepStatus("submitPChainTx", "error", error.message)
          showBoundary(error)
          setIsLoading(false)
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

  // Step Indicator Component
  const StepIndicator = ({
    status,
    label,
    error,
    onRetry,
  }: {
    status: StepStatus["status"]
    label: string
    error?: string
    onRetry?: () => void
  }) => {
    return (
      <div className="flex flex-col space-y-1 my-2">
        <div className="flex items-center space-x-2">
          {status === "loading" && (
            <div className="h-5 w-5 flex-shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-red-500" />
            </div>
          )}
          {status === "success" && (
            <div className="h-5 w-5 flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-500 fill-green-100" />
            </div>
          )}
          {status === "error" && (
            <div className="h-5 w-5 flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-500 fill-red-100" />
            </div>
          )}
          {status === "pending" && <div className="h-5 w-5 rounded-full border-2 border-zinc-200 flex-shrink-0" />}

          <span
            className={`text-sm ${status === "error" ? "text-red-600 font-medium" : "text-zinc-700 dark:text-zinc-300"}`}
          >
            {label}
          </span>
        </div>

        {status === "error" && error && (
          <div className="ml-7 p-2 bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500 rounded text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {status === "error" && onRetry && (
          <div className="ml-7 mt-1">
            <button
              onClick={onRetry}
              className="text-xs px-2 py-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    )
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
              onRetry={() => retryStep("getValidationID")}
            />

            <StepIndicator
              status={removalSteps.initiateRemoval.status}
              label="Initiate Validator Removal"
              error={removalSteps.initiateRemoval.error}
              onRetry={() => retryStep("initiateRemoval")}
            />

            <StepIndicator
              status={removalSteps.signMessage.status}
              label="Aggregate Signatures for Warp Message"
              error={removalSteps.signMessage.error}
              onRetry={() => retryStep("signMessage")}
            />

            <StepIndicator
              status={removalSteps.submitPChainTx.status}
              label="Submit to P-Chain"
              error={removalSteps.submitPChainTx.error}
              onRetry={() => retryStep("submitPChainTx")}
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