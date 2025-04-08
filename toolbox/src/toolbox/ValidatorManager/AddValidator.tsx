"use client";

import { useState, useEffect } from "react"
import { useToolboxStore, useViemChainStore } from "../toolboxStore"
import { useWalletStore } from "../../lib/walletStore"
import { useErrorBoundary } from "react-error-boundary"
import { custom, createPublicClient, fromBytes, bytesToHex, hexToBytes } from "viem"
import { pvm, utils, Context, networkIDs } from "@avalabs/avalanchejs"
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { packWarpIntoAccessList } from "../InitializePoA/packWarp"
import { packL1ValidatorRegistration } from "../L1/convertWarp"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import { AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Container } from "../components/Container"
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
  const { subnetId, proxyAddress, setProxyAddress } = useToolboxStore()
  const { avalancheNetworkID, coreWalletClient, pChainAddress } = useWalletStore()

  // State variables for form inputs
  const [newNodeID, setNewNodeID] = useState("")
  const [newBlsPublicKey, setNewBlsPublicKey] = useState("")
  const [newBlsProofOfPossession, setNewBlsProofOfPossession] = useState("")
  const [newWeight, setNewWeight] = useState("")
  const [newBalance, setNewBalance] = useState("0.1")
  const [validatorManagerAddress, setValidatorManagerAddress] = useState(proxyAddress || "")
  const [inputSubnetID, setInputSubnetID] = useState(subnetId || "")

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
  
  // Create a component variable to store the most recent warp message
  // This won't be affected by state update delays
  let lastWarpMessage = "";
  let lastSignedMessage = ""; // Add a variable for signed message
  let lastValidationID = ""; // Add a variable for validationID
  let lastPChainWarpMsg = ""; // Add a variable for P-Chain warp message

  // needs to be refactored
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

    // Reset the statuses from the selected step onwards
    steps.slice(stepIndex).forEach((currentStep) => {
      updateStepStatus(currentStep, "pending")
    })

    // Start the validation process from the selected step
    await addValidator(step)
  }

  // Update proxyAddress in the store when validatorManagerAddress changes
  useEffect(() => {
    if (validatorManagerAddress) {
      setProxyAddress(validatorManagerAddress)
    }
  }, [validatorManagerAddress, setProxyAddress])

  // Main function to add a validator
  const addValidator = async (startFromStep?: keyof ValidationSteps) => {
    if (
      !newNodeID ||
      !newBlsPublicKey ||
      !newBlsProofOfPossession ||
      !pChainAddress ||
      !newWeight ||
      !validatorManagerAddress ||
      !inputSubnetID
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
    } else {
      // If we're retrying from a specific step, make sure we're in validation mode
      setIsAddingValidator(true)
      setIsProcessComplete(false)
    }

    try {
      const publicClient = createPublicClient({
        transport: custom(window.avalanche!),
      })
      console.log(await publicClient.getChainId())

      const [account] = await coreWalletClient.requestAddresses()

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
          const hash = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "initiateValidatorRegistration",
            args,
            account,
            chain: viemChain
          })

          // Get receipt to extract warp message and validation ID
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          console.log("Receipt: ", receipt)
          const unsignedWarpMsg = receipt.logs[0].data ?? ""
          const validationIdHex = receipt.logs[1].topics[1] ?? ""

          console.log("Setting warp message:", unsignedWarpMsg.substring(0, 20) + "...")
          console.log("Setting validationID:", validationIdHex)
          
          // Save to state and component variable
          setRegisterL1ValidatorUnsignedWarpMsg(unsignedWarpMsg)
          lastWarpMessage = unsignedWarpMsg; // Store in component variable
          
          setValidationID(validationIdHex)
          lastValidationID = validationIdHex; // Store in component variable

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
          // Use component variable first, fall back to state if needed
          const messageToSign = lastWarpMessage || registerL1ValidatorUnsignedWarpMsg

          console.log("Message to sign (length):", messageToSign.length)
          console.log("Message to sign (first 20 chars):", messageToSign.substring(0, 20))
          
          if (!messageToSign || messageToSign.length === 0) {
            throw new Error("Warp message is empty. Please try again from step 1.")
          }

          console.log("Subnet ID: ", inputSubnetID)
          console.log("Network name: ", networkName)
          // Sign the unsigned warp message with signature aggregator
          const response = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: messageToSign,
              signingSubnetId: inputSubnetID, // Use inputSubnetID instead of subnetId
              quorumPercentage: 67, // Default threshold for subnet validation
            },
          })

          // Ensure we have a valid signedMessage and it's not just zeros
          const signedMessage = response.signedMessage;
          if (!signedMessage || signedMessage.length === 0 || /^0*$/.test(signedMessage)) {
            throw new Error("Received invalid signed message from the signature aggregator. Please try again.");
          }

          console.log("Signed message: ", signedMessage.substring(0, 20) + "...")
          setSavedSignedMessage(signedMessage)
          lastSignedMessage = signedMessage // Store in component variable
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

          // Use component variable first, then fall back to state
          const messageToUse = lastSignedMessage || savedSignedMessage

          console.log("Message to use for P-Chain (length):", messageToUse.length)
          console.log("Message to use for P-Chain (first 20 chars):", messageToUse.substring(0, 20))
          
          if (!messageToUse || messageToUse.length === 0) {
            throw new Error("Signed message is empty. Please try again from the sign message step.")
          }

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
          const validationIDToUse = lastValidationID || validationID;
          
          if (!validationIDToUse || validationIDToUse.length === 0) {
            throw new Error("ValidationID is empty. Please try again from step 1.");
          }
          
          console.log("Using validationID:", validationIDToUse);
          const validationIDBytes = hexToBytes(validationIDToUse as `0x${string}`)
          
          const unsignedPChainWarpMsg = packL1ValidatorRegistration(
            validationIDBytes,
            true,
            avalancheNetworkID,
            pChainChainID,
          )
          const unsignedPChainWarpMsgHex = bytesToHex(unsignedPChainWarpMsg)

          // Simulate waiting period, 15 seconds
          // await new Promise((resolve) => setTimeout(resolve, 15000))

          // Ensure we have a valid justification (signed message from previous step)
          const justification = lastWarpMessage || registerL1ValidatorUnsignedWarpMsg
          console.log("Justification for signature aggregation:", justification ? justification.substring(0, 20) + "..." : "None");
          
          if (!justification || justification.length === 0 || /^0*$/.test(justification)) {
            throw new Error("Invalid justification: The signed message from the previous step is empty or only contains zeros. Please retry the signature step.");
          }
          
          // Make sure justification is a proper hex string (add 0x prefix if needed)
          const formattedJustification = justification.startsWith("0x") ? justification : `0x${justification}`;

          // Aggregate signatures
          const response = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: unsignedPChainWarpMsgHex,
              justification: formattedJustification,
              signingSubnetId: inputSubnetID, // Use inputSubnetID instead of subnetId
              quorumPercentage: 67, // Default threshold for subnet validation
            },
          });
          
          if (!response.signedMessage || response.signedMessage.length === 0 || /^0*$/.test(response.signedMessage)) {
            throw new Error("Received invalid P-Chain signed message from the signature aggregator. Please try again.");
          }

          console.log("P-Chain signed message received:", response.signedMessage.substring(0, 20) + "...");
          setSavedPChainWarpMsg(response.signedMessage)
          lastPChainWarpMsg = response.signedMessage; // Store in component variable
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
          // Use component variable first, then fall back to state
          const warpMsgToUse = lastPChainWarpMsg || savedPChainWarpMsg

          console.log(warpMsgToUse)
          if (!warpMsgToUse || warpMsgToUse.length === 0) {
            throw new Error("P-Chain warp message is empty. Please try again from the previous step.")
          }

          // Convert to bytes and pack into access list
          const signedPChainWarpMsgBytes = hexToBytes(`0x${warpMsgToUse}`)
          const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes)

          // Submit the transaction to the EVM using Core Wallet
          console.log(accessList)
          const response = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "completeValidatorRegistration",
            args: [0],
            accessList,
            account,
            chain: viemChain
          })

          const receipt = await publicClient.waitForTransactionReceipt({ hash: response })
          console.log("Receipt: ", receipt)
          if (receipt.status === "success") {
            updateStepStatus("finalizeRegistration", "success")
            setIsProcessComplete(true)
          } else {
            updateStepStatus("finalizeRegistration", "error", "Transaction failed")
          }
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

  // Custom error message or suggestion based on which step failed
  const getStepSuggestion = (step: keyof ValidationSteps): string | null => {
    if (step === "finalizeRegistration" && validationSteps[step].status === "error") {
      return "If finalization fails, try retrying the 'Aggregate Signatures for P-Chain Warp Message' step first."
    }
    return null;
  }

  // Step Indicator Component, should be refactored to another component
  const StepIndicator = ({
    status,
    label,
    error,
    onRetry,
    step,
  }: {
    status: StepStatus["status"]
    label: string
    error?: string
    onRetry?: () => void
    step?: keyof ValidationSteps
  }) => {
    // Get any suggestion for this step
    const suggestion = step ? getStepSuggestion(step) : null;
    
    return (
      <div className="flex flex-col space-y-1 my-2">
        <div 
          className={`flex items-center space-x-2 ${onRetry ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700/50 p-1 -m-1 rounded-md transition-colors' : ''}`}
          onClick={onRetry}
        >
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
        
        {suggestion && status === "error" && (
          <div className="ml-7 mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 rounded text-xs text-blue-700 dark:text-blue-300">
            <span className="font-medium">Suggestion:</span> {suggestion}
          </div>
        )}
      </div>
    )
  }

  return (

    <Container title="Add New Validator" description="Add a validator to your L1 by providing the required details">
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

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Validator Manager Address <span className="text-red-500">*</span>
            </label>
            <Input
              label=""
              type="text"
              value={validatorManagerAddress}
              onChange={setValidatorManagerAddress}
              placeholder="Enter Validator Manager contract address (0x...)"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
              required
            />
            {!validatorManagerAddress && error && <p className="text-xs text-red-500">Validator Manager Address is required</p>}
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

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Signing Subnet ID <span className="text-red-500">*</span>
            </label>
            <Input
              label=""
              type="text"
              value={inputSubnetID}
              onChange={setInputSubnetID}
              placeholder="Enter subnet ID"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
              required
            />
            {!inputSubnetID && error && <p className="text-xs text-red-500">Subnet ID is required</p>}
          </div>
        </div>

        {!isAddingValidator && (
          <Button
            onClick={() => addValidator()}
            disabled={!validatorManagerAddress || !inputSubnetID}
          >
            {!validatorManagerAddress || !inputSubnetID ? "Set Required Fields First" : "Add Validator"}
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
            
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 italic">Click on any step to retry from that point</p>

            <StepIndicator
              status={validationSteps.initializeRegistration.status}
              label="Initialize Validator Registration"
              error={validationSteps.initializeRegistration.error}
              onRetry={() => retryStep("initializeRegistration")}
              step="initializeRegistration"
            />

            <StepIndicator
              status={validationSteps.signMessage.status}
              label="Aggregate Signatures for Warp Message"
              error={validationSteps.signMessage.error}
              onRetry={() => retryStep("signMessage")}
              step="signMessage"
            />

            <StepIndicator
              status={validationSteps.registerOnPChain.status}
              label="Register Validator on P-Chain"
              error={validationSteps.registerOnPChain.error}
              onRetry={() => retryStep("registerOnPChain")}
              step="registerOnPChain"
            />

            <StepIndicator
              status={validationSteps.waitForPChain.status}
              label="Aggregate Signatures for P-Chain Warp Message"
              error={validationSteps.waitForPChain.error}
              onRetry={() => retryStep("waitForPChain")}
              step="waitForPChain"
            />

            <StepIndicator
              status={validationSteps.finalizeRegistration.status}
              label="Finalize Validator Registration"
              error={validationSteps.finalizeRegistration.error}
              onRetry={() => retryStep("finalizeRegistration")}
              step="finalizeRegistration"
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