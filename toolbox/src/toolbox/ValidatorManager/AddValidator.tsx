"use client"

import { useState, useEffect } from "react"
import { useToolboxStore, useViemChainStore } from "../../stores/toolboxStore"
import { useWalletStore } from "../../stores/walletStore"
import { useErrorBoundary } from "react-error-boundary"
import { createWalletClient, custom, createPublicClient, fromBytes, bytesToHex, hexToBytes } from "viem"
import { pvm, utils, Context, networkIDs } from "@avalabs/avalanchejs"
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { packWarpIntoAccessList } from "../InitializePoA/packWarp"
import { packL1ValidatorRegistration } from "../L1/convertWarp"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import { AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Container } from "../../components/Container"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
// Define interfaces for step status tracking
interface StepStatus {
  status: "pending" | "loading" | "success" | "error"
  error?: string
}

interface ValidationSteps {
  initializeRegistration: StepStatus
  signMessage: StepStatus
  registerOnPChain: StepStatus
  waitForPChain: StepStatus
  finalizeRegistration: StepStatus
}

// Parse a NodeID- string to a hex string without the prefix and last 8 bytes
const parseNodeID = (nodeID: string) => {
  const nodeIDWithoutPrefix = nodeID.replace("NodeID-", "")
  const decodedID = utils.base58.decode(nodeIDWithoutPrefix)
  const nodeIDHex = fromBytes(decodedID, "hex")
  const nodeIDHexTrimmed = nodeIDHex.slice(0, -8)
  return nodeIDHexTrimmed
}

export default function AddValidator() {
  const { showBoundary } = useErrorBoundary()
  const { subnetID, proxyAddress, evmChainRpcUrl, evmChainName, evmChainCoinName } = useToolboxStore()
  const { avalancheNetworkID, walletChainId, pChainAddress } = useWalletStore()

  // State variables for form inputs
  const [newNodeID, setNewNodeID] = useState("")
  const [newBlsPublicKey, setNewBlsPublicKey] = useState("")
  const [newBlsProofOfPossession, setNewBlsProofOfPossession] = useState("")
  const [newWeight, setNewWeight] = useState("")
  const [newBalance, setNewBalance] = useState("0.1")

  // State for managing the validation process
  const [isAddingValidator, setIsAddingValidator] = useState(false)
  const [isProcessComplete, setIsProcessComplete] = useState(false)
  const [validationSteps, setValidationSteps] = useState<ValidationSteps>({
    initializeRegistration: { status: "pending" },
    signMessage: { status: "pending" },
    registerOnPChain: { status: "pending" },
    waitForPChain: { status: "pending" },
    finalizeRegistration: { status: "pending" },
  })

  // State for temp account and warp messages
  const [registerL1ValidatorUnsignedWarpMsg, setRegisterL1ValidatorUnsignedWarpMsg] = useState("")
  const [validationID, setValidationID] = useState("")
  const [savedSignedMessage, setSavedSignedMessage] = useState("")
  const [savedPChainWarpMsg, setSavedPChainWarpMsg] = useState("")
  const [_, setSavedPChainResponse] = useState<string>("")
  const [networkName, setNetworkName] = useState<"fuji" | "mainnet" | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const viemChain = useViemChainStore()

  const pChainChainID = "11111111111111111111111111111111LpoYY"
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
  }, [avalancheNetworkID])
  const pvmApi = new pvm.PVMApi(platformEndpoint)

  // Update step status helper
  const updateStepStatus = (step: keyof ValidationSteps, status: StepStatus["status"], error?: string) => {
    setValidationSteps((prev) => ({
      ...prev,
      [step]: { status, error },
    }))
  }

  // Reset the validation process
  const resetValidation = () => {
    setIsAddingValidator(false)
    setIsProcessComplete(false)
    Object.keys(validationSteps).forEach((step) => {
      updateStepStatus(step as keyof ValidationSteps, "pending")
    })
  }

  // Handle retry of a specific step
  const retryStep = async (step: keyof ValidationSteps) => {
    // Reset status of current step and all following steps
    const steps = Object.keys(validationSteps) as Array<keyof ValidationSteps>
    const stepIndex = steps.indexOf(step)

    // Only reset the statuses from the failed step onwards
    steps.slice(stepIndex).forEach((currentStep) => {
      updateStepStatus(currentStep, "pending")
    })

    // Start the validation process from the failed step
    await addValidator(step)

    // If the retried step succeeds, continue with the next steps
    const nextStepIndex = stepIndex + 1
    if (nextStepIndex < steps.length && validationSteps[step].status === "success") {
      await addValidator(steps[nextStepIndex])
    }
  }

  // Main function to add a validator
  const addValidator = async (startFromStep?: keyof ValidationSteps) => {
    if (
      !newNodeID ||
      !newBlsPublicKey ||
      !newBlsProofOfPossession ||
      !pChainAddress ||
      !newWeight ||
      !proxyAddress
    ) {
      setError("Please fill all required fields to continue")
      return
    }

    setError(null)

    // Only reset steps and validation state if starting fresh
    if (!startFromStep) {
      setIsAddingValidator(true)
      setIsProcessComplete(false)
      Object.keys(validationSteps).forEach((step) => {
        updateStepStatus(step as keyof ValidationSteps, "pending")
      })
    }

    try {
      // Create wallet client using Core wallet
      const walletClient = createWalletClient({
        transport: custom(window.avalanche!),
      })

      const publicClient = createPublicClient({
        transport: custom(window.avalanche!),
      })

      const [account] = await walletClient.requestAddresses()

      // Step 1: Initialize Registration
      if (!startFromStep || startFromStep === "initializeRegistration") {
        updateStepStatus("initializeRegistration", "loading")
        try {
          // Process P-Chain Address
          const pChainAddressBytes = utils.bech32ToBytes(pChainAddress)
          const pChainAddressHex = fromBytes(pChainAddressBytes, "hex")
          const expiry = BigInt(Math.floor(Date.now() / 1000) + 43200) // 12 hours

          // Build arguments for `initializeValidatorRegistration`
          const args = [
            parseNodeID(newNodeID),
            newBlsPublicKey,
            expiry,
            {
              threshold: 1,
              addresses: [pChainAddressHex],
            },
            {
              threshold: 1,
              addresses: [pChainAddressHex],
            },
            BigInt(newWeight)
          ]

          // Submit transaction
          const hash = await walletClient.writeContract({
            address: proxyAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "initiateValidatorRegistration",
            args,
            account,
            chain: viemChain
          })

          // Get receipt to extract warp message and validation ID
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          const unsignedWarpMsg = receipt.logs[0].data ?? ""
          const validationIdHex = receipt.logs[1].topics[1] ?? ""

          // Save to state
          setRegisterL1ValidatorUnsignedWarpMsg(unsignedWarpMsg)
          setValidationID(validationIdHex)

          updateStepStatus("initializeRegistration", "success")
        } catch (error: any) {
          updateStepStatus("initializeRegistration", "error", error.message)
          showBoundary(error)
          return
        }
      }

      // Step 2: Sign Message
      if (!startFromStep || startFromStep === "signMessage") {
        updateStepStatus("signMessage", "loading")
        try {
          // Use stored message if retrying
          const messageToSign = startFromStep ? registerL1ValidatorUnsignedWarpMsg : registerL1ValidatorUnsignedWarpMsg

          // Sign the unsigned warp message with signature aggregator
          const { signedMessage } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: messageToSign,
              signingSubnetId: subnetID,
              quorumPercentage: 67, // Default threshold for subnet validation
            },
          })

          setSavedSignedMessage(signedMessage)
          updateStepStatus("signMessage", "success")

          if (startFromStep === "signMessage") {
            await addValidator("registerOnPChain")
            return
          }
        } catch (error: any) {
          updateStepStatus("signMessage", "error", error.message)
          showBoundary(error)
          return
        }
      }

      // Step 3: Register on P-Chain
      if (!startFromStep || startFromStep === "registerOnPChain") {
        updateStepStatus("registerOnPChain", "loading")
        try {
          if (!window.avalanche) throw new Error("Core wallet not found")

          // Use saved message if retrying
          const messageToUse = startFromStep ? savedSignedMessage : savedSignedMessage

          // Get fee state, context and utxos from P-Chain
          const feeState = await pvmApi.getFeeState()
          const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] })
          const context = await Context.getContextFromURI(platformEndpoint)

          // Convert balance from AVAX to nAVAX (1 AVAX = 1e9 nAVAX)
          const balanceInNanoAvax = BigInt(Number(newBalance) * 1e9)

          const unsignedRegisterValidatorTx = pvm.e.newRegisterL1ValidatorTx(
            {
              balance: balanceInNanoAvax,
              blsSignature: new Uint8Array(Buffer.from(newBlsProofOfPossession.slice(2), "hex")),
              message: new Uint8Array(Buffer.from(messageToUse, "hex")),
              feeState,
              fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
              utxos,
            },
            context,
          )

          const unsignedRegisterValidatorTxBytes = unsignedRegisterValidatorTx.toBytes()
          const unsignedRegisterValidatorTxHex = bytesToHex(unsignedRegisterValidatorTxBytes)

          // Submit the transaction to the P-Chain using Core Wallet
          const response = (await window.avalanche.request({
            method: "avalanche_sendTransaction",
            params: {
              transactionHex: unsignedRegisterValidatorTxHex,
              chainAlias: "P",
            },
          })) as string

          setSavedPChainResponse(response)
          // Wait for transaction to be confirmed
          while (true) {
            const status = await pvmApi.getTxStatus({ txID: response })
            if (status.status === "Committed") break
            await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second delay
          }
          updateStepStatus("registerOnPChain", "success")

          if (startFromStep === "registerOnPChain") {
            await addValidator("waitForPChain")
            return
          }
        } catch (error: any) {
          updateStepStatus("registerOnPChain", "error", error.message)
          showBoundary(error)
          return
        }
      }

      // Step 4: Wait for P-Chain txn and aggregate signatures
      if (!startFromStep || startFromStep === "waitForPChain") {
        updateStepStatus("waitForPChain", "loading")
        try {
          // Wait for transaction to be confirmed (mocked for demo)
          await new Promise((resolve) => setTimeout(resolve, 1000))

          // Create and sign P-Chain warp message
          const validationIDBytes = hexToBytes(validationID as `0x${string}`)
          const unsignedPChainWarpMsg = packL1ValidatorRegistration(
            validationIDBytes,
            true,
            avalancheNetworkID,
            pChainChainID,
          )
          const unsignedPChainWarpMsgHex = bytesToHex(unsignedPChainWarpMsg)

          // Simulate waiting period
          await new Promise((resolve) => setTimeout(resolve, 1000))

          // Aggregate signatures
          const signedMessage = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: unsignedPChainWarpMsgHex,
              justification: registerL1ValidatorUnsignedWarpMsg,
              signingSubnetId: subnetID,
              quorumPercentage: 67, // Default threshold for subnet validation
            },
          })

          setSavedPChainWarpMsg(signedMessage.signedMessage)
          updateStepStatus("waitForPChain", "success")
        } catch (error: any) {
          updateStepStatus("waitForPChain", "error", error.message)
          showBoundary(error)
          return
        }
      }

      // Step 6: Finalize Registration
      if (!startFromStep || startFromStep === "finalizeRegistration") {
        updateStepStatus("finalizeRegistration", "loading")
        try {
          // Use saved message if retrying
          const warpMsgToUse = startFromStep ? savedPChainWarpMsg : savedPChainWarpMsg

          // Convert to bytes and pack into access list
          const signedPChainWarpMsgBytes = hexToBytes(`0x${warpMsgToUse}`)
          const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes)

          // Submit the transaction to the EVM using Core Wallet
          const response = await walletClient.writeContract({
            address: proxyAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "completeValidatorRegistration",
            args: [0],
            accessList,
            account,
            chain: {
              id: walletChainId,
              name: evmChainName,
              rpcUrls: {
                default: { http: [evmChainRpcUrl] },
              },
              nativeCurrency: {
                name: evmChainCoinName,
                symbol: evmChainCoinName,
                decimals: 18,
              },
            },
          })

          const receipt = await publicClient.waitForTransactionReceipt({ hash: response })
          console.log("Receipt: ", receipt)
          updateStepStatus("finalizeRegistration", "success")
        } catch (error: any) {
          updateStepStatus("finalizeRegistration", "error", error.message)
          showBoundary(error)
          return
        }
      }
    } catch (error: any) {
      setError(error.message)
      showBoundary(error)
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

    <Container title="Add New Validator" description="Add a validator to your L1 by providing the required details">
      {/* Background gradient effect */}
      {/* <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/10 dark:to-transparent pointer-events-none"></div> */}

      <div className="relative">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="bg-zinc-50 dark:bg-zinc-800/70 rounded-md p-3 border border-zinc-200 dark:border-zinc-700">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Your P-Chain Address</div>
            <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate">{pChainAddress}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Node ID <span className="text-red-500">*</span>
              </label>
              <Input
                label=""
                type="text"
                value={newNodeID}
                onChange={setNewNodeID}
                placeholder="Enter validator NodeID-"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
                required
              />
              {!newNodeID && error && <p className="text-xs text-red-500">Node ID is required</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Weight <span className="text-red-500">*</span>
              </label>
              <Input
                label=""
                type="text"
                value={newWeight}
                onChange={setNewWeight}
                placeholder="Enter validator weight in consensus"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
                required
              />
              {!newWeight && error && <p className="text-xs text-red-500">Weight is required</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              BLS Public Key <span className="text-red-500">*</span>
            </label>
            <Input
              label=""
              type="text"
              value={newBlsPublicKey}
              onChange={setNewBlsPublicKey}
              placeholder="Enter BLS public key (0x...)"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
              required
            />
            {!newBlsPublicKey && error && <p className="text-xs text-red-500">BLS public key is required</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              BLS Proof of Possession <span className="text-red-500">*</span>
            </label>
            <Input
              label=""
              type="text"
              value={newBlsProofOfPossession}
              onChange={setNewBlsProofOfPossession}
              placeholder="Enter BLS proof of possession (0x...)"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
              required
            />
            {!newBlsProofOfPossession && error && (
              <p className="text-xs text-red-500">BLS proof of possession is required</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Initial Balance (AVAX) <span className="text-red-500">*</span>
            </label>
            <Input
              label=""
              type="text"
              value={newBalance}
              onChange={setNewBalance}
              placeholder="Enter initial balance"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
              required
            />
            <div className="grid grid-cols-4 gap-3 mt-2">
              <Button
                onClick={() => setNewBalance("0.01")}
                className="px-2 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                0.01 AVAX
              </Button>
              <Button
                onClick={() => setNewBalance("0.1")}
                className="px-2 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                0.1 AVAX
              </Button>
              <Button
                onClick={() => setNewBalance("1")}
                className="px-2 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                1 AVAX
              </Button>
              <Button
                onClick={() => setNewBalance("5")}
                className="px-2 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                5 AVAX
              </Button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Initial 'Pay As You Go' Balance (1.33 AVAX/month/validator)
            </p>
          </div>
        </div>

        {!isAddingValidator && (
          <Button
            onClick={() => addValidator()}
            disabled={!proxyAddress}
          >
            {!proxyAddress ? "Set Proxy Address First" : "Add Validator"}
          </Button>
        )}

        {isAddingValidator && (
          <div className="mt-4 border border-zinc-200 dark:border-zinc-700 rounded-md p-4 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">Validation Progress</h3>
              {isProcessComplete && (
                <button
                  onClick={resetValidation}
                  className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded transition-colors"
                >
                  Start New Validation
                </button>
              )}
            </div>

            <StepIndicator
              status={validationSteps.initializeRegistration.status}
              label="Initialize Validator Registration"
              error={validationSteps.initializeRegistration.error}
              onRetry={() => retryStep("initializeRegistration")}
            />

            <StepIndicator
              status={validationSteps.signMessage.status}
              label="Aggregate Signatures for Warp Message"
              error={validationSteps.signMessage.error}
              onRetry={() => retryStep("signMessage")}
            />

            <StepIndicator
              status={validationSteps.registerOnPChain.status}
              label="Register Validator on P-Chain"
              error={validationSteps.registerOnPChain.error}
              onRetry={() => retryStep("registerOnPChain")}
            />

            <StepIndicator
              status={validationSteps.waitForPChain.status}
              label="Wait for P-Chain Confirmation"
              error={validationSteps.waitForPChain.error}
              onRetry={() => retryStep("waitForPChain")}
            />

            <StepIndicator
              status={validationSteps.finalizeRegistration.status}
              label="Finalize Validator Registration"
              error={validationSteps.finalizeRegistration.error}
              onRetry={() => retryStep("finalizeRegistration")}
            />

            {!isProcessComplete && (
              <Button
                onClick={resetValidation}
                className="mt-4 w-full py-2 px-4 rounded-md text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel Validation
              </Button>
            )}
          </div>
        )}

        {isProcessComplete && (
          <div className="flex items-center mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-200">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Validator Added Successfully</p>
              <p className="text-xs text-green-700 dark:text-green-300">
                The validator has been registered on the network
              </p>
            </div>
          </div>
        )}
      </div>
    </Container>
  )
}

