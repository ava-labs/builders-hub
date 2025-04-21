"use client";

import { useState, useEffect } from "react"
import { useToolboxStore, useViemChainStore } from "../toolboxStore"
import { useWalletStore } from "../../lib/walletStore"
import { useErrorBoundary } from "react-error-boundary"
import { custom, createPublicClient, fromBytes, bytesToHex, hexToBytes } from "viem"
import { pvm, utils, networkIDs } from "@avalabs/avalanchejs"
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { packWarpIntoAccessList } from "./packWarp"
import { packL1ValidatorRegistration } from "../L1/convertWarp"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import { AlertCircle, CheckCircle } from "lucide-react"
import { Container } from "../components/Container"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { StepIndicator } from "../components/StepIndicator"
import { parseNodeID } from "../../coreViem/utils/ids"
import { getRPCEndpoint } from "../../coreViem/utils/rpc"
import { useStepProgress, StepsConfig } from "../hooks/useStepProgress"
import { registerL1Validator } from "../../coreViem/methods/registerL1Validator"

// Define step keys and configuration for AddValidator
type AddValidationStepKey =
  | "initializeRegistration"
  | "signMessage"
  | "registerOnPChain"
  | "waitForPChain"
  | "finalizeRegistration";

const addValidationStepsConfig: StepsConfig<AddValidationStepKey> = {
  initializeRegistration: "Initialize Validator Registration",
  signMessage: "Aggregate Signatures for Warp Message",
  registerOnPChain: "Register Validator on P-Chain",
  waitForPChain: "Aggregate Signatures for P-Chain Warp Message",
  finalizeRegistration: "Finalize Validator Registration",
};

export default function AddValidator() {
  const { showBoundary } = useErrorBoundary()
  const { subnetId, proxyAddress, setProxyAddress } = useToolboxStore()
  const { avalancheNetworkID, coreWalletClient, pChainAddress } = useWalletStore()
  const viemChain = useViemChainStore()

  // State variables for form inputs
  const [newNodeID, setNewNodeID] = useState("")
  const [newBlsPublicKey, setNewBlsPublicKey] = useState("")
  const [newBlsProofOfPossession, setNewBlsProofOfPossession] = useState("")
  const [newWeight, setNewWeight] = useState("")
  const [newBalance, setNewBalance] = useState("0.1")
  const [validatorManagerAddress, setValidatorManagerAddress] = useState(proxyAddress || "")
  const [inputSubnetID, setInputSubnetID] = useState(subnetId || "")

  // State for temp account and warp messages
  const [registerL1ValidatorUnsignedWarpMsg, setRegisterL1ValidatorUnsignedWarpMsg] = useState("")
  const [validationID, setValidationID] = useState("")
  const [savedSignedMessage, setSavedSignedMessage] = useState("")
  const [savedPChainWarpMsg, setSavedPChainWarpMsg] = useState("")

  // Initialize the step progress hook
  const {
    steps,
    stepKeys,
    stepsConfig: config,
    isProcessing,
    isProcessComplete: hookIsProcessComplete,
    error: hookError,
    success,
    updateStepStatus,
    resetSteps,
    startProcessing,
    completeProcessing,
    handleRetry,
    setError: hookSetError,
  } = useStepProgress<AddValidationStepKey>(addValidationStepsConfig);

  const platformEndpoint = getRPCEndpoint(avalancheNetworkID !== networkIDs.MainnetID)
  const networkName = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "fuji"
  const pvmApi = new pvm.PVMApi(platformEndpoint)

  // Update proxyAddress in the store when validatorManagerAddress changes
  useEffect(() => {
    if (validatorManagerAddress) {
      setProxyAddress(validatorManagerAddress)
    }
  }, [validatorManagerAddress, setProxyAddress])

  // Main function to add a validator
  const addValidator = async (startFromStep?: AddValidationStepKey) => {
    if (
      !newNodeID ||
      !newBlsPublicKey ||
      !newBlsProofOfPossession ||
      !pChainAddress ||
      !newWeight ||
      !validatorManagerAddress ||
      !inputSubnetID
    ) {
      hookSetError("Please fill all required fields to continue")
      return
    }

    startProcessing();

    try {
      const publicClient = createPublicClient({
        transport: custom(window.avalanche!),
      })
      console.log(await publicClient.getChainId())

      const [account] = await coreWalletClient.requestAddresses()

      // Local variables to pass data synchronously within one run
      // Initialize from state if retrying, otherwise empty
      let localUnsignedWarpMsg = startFromStep ? registerL1ValidatorUnsignedWarpMsg : "";
      let localValidationIdHex = startFromStep ? validationID : "";
      let localSignedMessage = startFromStep ? savedSignedMessage : "";
      let localPChainWarpMsg = startFromStep ? savedPChainWarpMsg : "";

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

          // Update local var and state
          localUnsignedWarpMsg = receipt.logs[0].data ?? "";
          localValidationIdHex = receipt.logs[1].topics[1] ?? "";
          console.log("Setting warp message:", localUnsignedWarpMsg.substring(0, 20) + "...")
          console.log("Setting validationID:", localValidationIdHex)

          // Save to state for potential retries later
          setRegisterL1ValidatorUnsignedWarpMsg(localUnsignedWarpMsg)
          setValidationID(localValidationIdHex)

          updateStepStatus("initializeRegistration", "success")
        } catch (error: any) {
          updateStepStatus("initializeRegistration", "error", error.message)
          return
        }
      }

      // Step 2: Sign Message
      if (!startFromStep || startFromStep === "signMessage") {
        updateStepStatus("signMessage", "loading")
        try {
          // Always read from state for retries
          const messageToSign = localUnsignedWarpMsg || registerL1ValidatorUnsignedWarpMsg;
          if (!messageToSign || messageToSign.length === 0) {
            throw new Error("Warp message is empty. Retry from step 1.")
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

          // Update local var and state
          localSignedMessage = response.signedMessage;
          if (!localSignedMessage || localSignedMessage.length === 0 || /^0*$/.test(localSignedMessage)) {
            throw new Error("Received invalid signed message. Retry signing.");
          }

          console.log("Signed message: ", localSignedMessage.substring(0, 20) + "...")
          setSavedSignedMessage(localSignedMessage)
          updateStepStatus("signMessage", "success")

          if (startFromStep === "signMessage") {
            await addValidator("registerOnPChain")
            return
          }
        } catch (error: any) {
          updateStepStatus("signMessage", "error", error.message)
          return
        }
      }

      // Step 3: Register on P-Chain
      if (!startFromStep || startFromStep === "registerOnPChain") {
        updateStepStatus("registerOnPChain", "loading")
        try {
          if (!window.avalanche) throw new Error("Core wallet not found")

          // Use local var for current run, state is fallback for retry
          const messageToUse = localSignedMessage || savedSignedMessage;
          if (!messageToUse || messageToUse.length === 0) {
            throw new Error("Signed message is empty. Retry the sign message step.")
          }

          // Call the new coreViem method to register the validator on P-Chain
          const pChainTxId = await registerL1Validator(coreWalletClient, {
            pChainAddress: pChainAddress!,
            balance: newBalance,
            blsProofOfPossession: newBlsProofOfPossession,
            signedWarpMessage: messageToUse,
          });

          // Wait for transaction to be confirmed
          while (true) {
            const status = await pvmApi.getTxStatus({ txID: pChainTxId })
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
          const validationIDToUse = localValidationIdHex || validationID;
          
          if (!validationIDToUse || validationIDToUse.length === 0) {
            throw new Error("ValidationID is empty. Retry from step 1.");
          }
          
          console.log("Using validationID:", validationIDToUse);
          const validationIDBytes = hexToBytes(validationIDToUse as `0x${string}`)
          
          const unsignedPChainWarpMsg = packL1ValidatorRegistration(
            validationIDBytes,
            true,
            avalancheNetworkID,
            "11111111111111111111111111111111LpoYY" //always from P-Chain (same on fuji and mainnet)
          )
          const unsignedPChainWarpMsgHex = bytesToHex(unsignedPChainWarpMsg)

          // Simulate waiting period, 15 seconds
          // await new Promise((resolve) => setTimeout(resolve, 15000))

          // Use local var for current run, state is fallback for retry
          const justification = localUnsignedWarpMsg || registerL1ValidatorUnsignedWarpMsg;
          console.log("Justification for signature aggregation:", justification ? justification.substring(0, 20) + "..." : "None");
          
          if (!justification || justification.length === 0 || /^0*$/.test(justification)) {
            throw new Error("Invalid justification for P-Chain warp message. Retry Step 1.");
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
          
          // Update local var and state
          localPChainWarpMsg = response.signedMessage;
          if (!localPChainWarpMsg || localPChainWarpMsg.length === 0 || /^0*$/.test(localPChainWarpMsg)) {
            throw new Error("Received invalid P-Chain signed message. Retry this step.");
          }

          console.log("P-Chain signed message received:", localPChainWarpMsg.substring(0, 20) + "...");
          setSavedPChainWarpMsg(localPChainWarpMsg)
          updateStepStatus("waitForPChain", "success")
        } catch (error: any) {
          updateStepStatus("waitForPChain", "error", error.message)
          return
        }
      }

      // Step 6: Finalize Registration
      if (!startFromStep || startFromStep === "finalizeRegistration") {
        updateStepStatus("finalizeRegistration", "loading")
        try {
          // Use local var for current run, state is fallback for retry
          const warpMsgToUse = localPChainWarpMsg || savedPChainWarpMsg;
          if (!warpMsgToUse || warpMsgToUse.length === 0) {
            throw new Error("P-Chain warp message is empty. Retry the previous step.")
          }

          // Convert to bytes and pack into access list
          const signedPChainWarpMsgBytes = hexToBytes(`0x${warpMsgToUse}`)
          const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes)

          // Submit the transaction to the EVM using Core Wallet
          console.log(accessList)
          const finalizeHash = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "completeValidatorRegistration",
            args: [0],
            accessList,
            account,
            chain: viemChain
          })

          const receipt = await publicClient.waitForTransactionReceipt({ hash: finalizeHash })
          console.log("Receipt: ", receipt)
          if (receipt.status === "success") {
            updateStepStatus("finalizeRegistration", "success")
            completeProcessing("Validator Added Successfully")
          } else {
            updateStepStatus("finalizeRegistration", "error", "Transaction failed")
          }
        } catch (error: any) {
          updateStepStatus("finalizeRegistration", "error", error.message)
          return
        }
      }
    } catch (error: any) {
      hookSetError(error.message)
      showBoundary(error)
    }
  }

  return (
    <Container title="Add New Validator" description="Add a validator to your L1 by providing the required details">
      <div className="relative">
        {hookError && !isProcessing && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
              <span>{hookError}</span>
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
            {!validatorManagerAddress && hookError && <p className="text-xs text-red-500">Validator Manager Address is required</p>}
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
              {!newNodeID && hookError && <p className="text-xs text-red-500">Node ID is required</p>}
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
              {!newWeight && hookError && <p className="text-xs text-red-500">Weight is required</p>}
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
            {!newBlsPublicKey && hookError && <p className="text-xs text-red-500">BLS public key is required</p>}
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
            {!newBlsProofOfPossession && hookError && (
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
            {!inputSubnetID && hookError && <p className="text-xs text-red-500">Subnet ID is required</p>}
          </div>
        </div>

        {!isProcessing && (
          <Button
            onClick={() => addValidator()}
            disabled={!validatorManagerAddress || !inputSubnetID}
          >
            {!validatorManagerAddress || !inputSubnetID ? "Set Required Fields First" : "Add Validator"}
          </Button>
        )}

        {isProcessing && (
          <div className="mt-4 border border-zinc-200 dark:border-zinc-700 rounded-md p-4 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">Validation Progress</h3>
              {hookIsProcessComplete && (
                <button
                  onClick={resetSteps}
                  className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded transition-colors"
                >
                  Start New Validation
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
                onRetry={() => handleRetry(stepKey, addValidator)}
                stepKey={stepKey}
              />
            ))}

            {!hookIsProcessComplete && (
              <Button
                onClick={resetSteps}
                className="mt-4 w-full py-2 px-4 rounded-md text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel Validation
              </Button>
            )}
          </div>
        )}

        {hookIsProcessComplete && success && (
          <div className="flex items-center mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-200">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">{success}</p>
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