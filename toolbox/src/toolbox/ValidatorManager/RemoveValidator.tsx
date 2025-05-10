"use client"

import { AlertCircle, CheckCircle } from "lucide-react"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import { bytesToHex, hexToBytes } from "viem"
import { networkIDs } from "@avalabs/avalanchejs"
import { useErrorBoundary } from "react-error-boundary"
import { useState, useEffect, useRef } from "react"

import { Button } from "../../components/Button"
import { Container } from "../components/Container"
import { GetRegistrationJustification } from "./justification"
import { Input } from "../../components/Input"
import { cn } from "../../lib/utils"
import { packL1ValidatorRegistration } from "../../coreViem/utils/convertWarp"
import { packWarpIntoAccessList } from "./packWarp"
import { StepIndicator } from "../components/StepIndicator"
import { useSelectedL1, useViemChainStore } from "../toolboxStore"
import { useWalletStore } from "../../lib/walletStore"
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { getValidationIdHex } from "../../coreViem/hooks/getValidationID"
import { useStepProgress, StepsConfig } from "../hooks/useStepProgress"
import { setL1ValidatorWeight } from "../../coreViem/methods/setL1ValidatorWeight"
import SelectSubnetId from "../components/SelectSubnetId"
import { getSubnetInfoForNetwork, getBlockchainInfoForNetwork } from "../../coreViem/utils/glacier"

// Define step keys and configuration
type RemovalStepKey =
  | "getValidationID"
  | "initiateRemoval"
  | "signMessage"
  | "submitPChainTx"
  | "pChainSignature"
  | "completeRemoval";

const removalStepsConfig: StepsConfig<RemovalStepKey> = {
  getValidationID: "Get Validation ID",
  initiateRemoval: "Initiate Validator Removal",
  signMessage: "Aggregate Signatures for Warp Message",
  submitPChainTx: "Remove Validator from P-Chain",
  pChainSignature: "Aggregate Signatures for P-Chain Warp Message",
  completeRemoval: "Complete Removal",
};

export default function RemoveValidator() {
  const { showBoundary } = useErrorBoundary()
  const { coreWalletClient, pChainAddress, avalancheNetworkID, publicClient } = useWalletStore()
  const selectedL1 = useSelectedL1()();
  const viemChain = useViemChainStore()

  // Add a ref to track which subnet IDs we've already fetched
  const subnetCache = useRef<Record<string, {
    validatorManagerAddress: string;
    blockchainId: string;
    signingSubnetId: string;
  }>>({});

  const [nodeID, setNodeID] = useState("")
  const [subnetId, setSubnetId] = useState(selectedL1?.subnetId || "")
  const [validatorManagerAddress, setValidatorManagerAddress] = useState("")
  const [validatorManagerError, setValidatorManagerError] = useState<string | null>(null)
  const [validationIDHex, setValidationIDHex] = useState("")
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState("")
  const [signedWarpMessage, setSignedWarpMessage] = useState("")
  const [pChainSignature, setPChainSignature] = useState("")
  const [signingSubnetId, setSigningSubnetId] = useState("")

  const networkName = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "fuji"

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
  } = useStepProgress<RemovalStepKey>(removalStepsConfig);

  // Update the useEffect to check viemChain compatibility
  useEffect(() => {
    const fetchVMCDetails = async () => {
      if (!subnetId || subnetId === "11111111111111111111111111111111LpoYY") {
        setValidatorManagerAddress("")
        setValidatorManagerError("Please select a valid subnet ID")
        return
      }

      // Skip API calls if we've already fetched this subnet ID
      const cacheKey = `${avalancheNetworkID}-${subnetId}`;
      if (subnetCache.current[cacheKey]) {
        console.log(`Skipping API call for already processed subnet: ${subnetId}`);
        // Restore cached values
        const cachedValues = subnetCache.current[cacheKey];
        setValidatorManagerAddress(cachedValues.validatorManagerAddress);
        setSigningSubnetId(cachedValues.signingSubnetId);
        setValidatorManagerError(null); // Clear any previous errors
        return;
      }

      try {
        // Determine network based on avalancheNetworkID
        const network = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "testnet"
        console.log(`Using Glacier API with network: ${network}`)
        
        const subnetInfo = await getSubnetInfoForNetwork(network, subnetId)
        
        // Check if subnet is an L1
        if (!subnetInfo.isL1 || !subnetInfo.l1ValidatorManagerDetails) {
          setValidatorManagerAddress("")
          setValidatorManagerError("Selected subnet is not an L1 or doesn't have a Validator Manager Contract")
          return
        }
        
        // Get VMC details
        const vmcAddress = subnetInfo.l1ValidatorManagerDetails.contractAddress
        const vmcBlockchainId = subnetInfo.l1ValidatorManagerDetails.blockchainId
        
        // Fetch chain details to get EVM chain ID - use the same network
        try {
          const blockchainInfoForVMC: { evmChainId: number } = await getBlockchainInfoForNetwork(
            network, 
            vmcBlockchainId
          )
          const expectedChainIdForVMC = blockchainInfoForVMC.evmChainId
          
          // Check viemChain compatibility
          if (viemChain && viemChain.id !== expectedChainIdForVMC) {
            setValidatorManagerError(`Please use chain ID ${expectedChainIdForVMC} in your wallet. Current selected chain ID: ${viemChain.id}`)
            console.warn(`Chain ID mismatch: viemChain.id (${viemChain.id}) doesn't match expected EVM chain ID (${expectedChainIdForVMC})`)
            return
          }
          
          // Check connected chain via publicClient
          if (!publicClient) {
            throw new Error("No public client available")
          }
          
          const connectedChainId = await publicClient.getChainId()
          
          if (connectedChainId !== expectedChainIdForVMC) {
            setValidatorManagerError(`Please connect to chain ID ${expectedChainIdForVMC} to use this L1's Validator Manager`)
            return
          }
          
          // If we get here, both checks passed
          setValidatorManagerError(null)
          setValidatorManagerAddress(vmcAddress)
          
          // Fetch the signing subnet ID - the useEffect dependency on subnetId 
          // ensures this only runs when subnet changes
          try {
            const blockchainInfo = await getBlockchainInfoForNetwork(network, vmcBlockchainId)
            setSigningSubnetId(blockchainInfo.subnetId)
          } catch (subnetIdError) {
            console.error("Error getting subnet ID from blockchain ID:", subnetIdError)
            // Fall back to regular subnetId if we can't get it from blockchain ID
            setSigningSubnetId(subnetId)
          }
          
          // Mark this subnet ID as fetched to avoid redundant API calls
          subnetCache.current[cacheKey] = {
            validatorManagerAddress: vmcAddress,
            blockchainId: vmcBlockchainId,
            signingSubnetId: signingSubnetId,
          };
          
        } catch (chainError) {
          console.error("Error checking chain compatibility:", chainError)
          setValidatorManagerError("Failed to verify chain compatibility. Please ensure your wallet is connected.")
          return
        }
        
      } catch (error) {
        console.error("Error fetching Validator Manager details:", error)
        setValidatorManagerAddress("")
        setValidatorManagerError("Failed to fetch Validator Manager information for this subnet")
      }
    }
    
    fetchVMCDetails()
  }, [subnetId, publicClient, viemChain, avalancheNetworkID])

  const handleRemove = async (startFromStep?: RemovalStepKey) => {
    if (!nodeID) {
      setError("Node ID is required")
      return
    }

    if (!validatorManagerAddress) {
      setError("Validator Manager Address is required. Please select a valid L1 subnet.")
      return
    }

    if (!startFromStep) {
      startProcessing();
    }

    let currentValidationID = startFromStep ? validationIDHex : "";
    let currentUnsignedWarpMessage = startFromStep ? unsignedWarpMessage : "";
    let currentSignedWarpMessage = startFromStep ? signedWarpMessage : "";
    let currentPChainSignature = startFromStep ? pChainSignature : "";

    try {
      // Step 1: Get ValidationID
      if (!startFromStep || startFromStep === "getValidationID") {
        updateStepStatus("getValidationID", "loading")
        try {
          const validationIDResult = await getValidationIdHex(publicClient, validatorManagerAddress as `0x${string}`, nodeID)
          setValidationIDHex(validationIDResult as string)
          currentValidationID = validationIDResult as string;
          console.log("ValidationID:", validationIDResult)
          updateStepStatus("getValidationID", "success")
        } catch (error: any) {
          updateStepStatus("getValidationID", "error", error.message)
          return
        }
      }

      // Step 2: Initiate Validator Removal
      if (!startFromStep || startFromStep === "initiateRemoval") {
        updateStepStatus("initiateRemoval", "loading")
        try {
          if (!currentValidationID) {
            throw new Error("Validation ID is missing. Retrying might be needed.")
          }

          const removeValidatorTx = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "initiateValidatorRemoval",
            args: [currentValidationID],
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

          const warpMessageResult = receipt.logs[0].data || ""
          setUnsignedWarpMessage(warpMessageResult)
          currentUnsignedWarpMessage = warpMessageResult;
          updateStepStatus("initiateRemoval", "success")
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("initiateRemoval", "error", `Failed to initiate removal: ${message}`)
          return
        }
      }

      // Step 3: Sign Warp Message
      if (!startFromStep || startFromStep === "signMessage") {
        updateStepStatus("signMessage", "loading")
        try {
          if (!currentUnsignedWarpMessage || currentUnsignedWarpMessage.length === 0) {
            throw new Error("Warp message is empty. Retrying might be needed.")
          }

          const { signedMessage: signedMessageResult } = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: currentUnsignedWarpMessage,
              signingSubnetId: signingSubnetId || subnetId,
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
          return
        }
      }

      // Step 4: Submit P-Chain Transaction
      if (!startFromStep || startFromStep === "submitPChainTx") {
        updateStepStatus("submitPChainTx", "loading")
        try {
          if (!currentSignedWarpMessage || currentSignedWarpMessage.length === 0) {
            throw new Error("Signed message is empty. Retrying might be needed.")
          }

          if (typeof window === "undefined" || !window.avalanche) {
            throw new Error("Core wallet not found")
          }

          const pChainTxId = await setL1ValidatorWeight(coreWalletClient, {
            pChainAddress: pChainAddress!,
            signedWarpMessage: currentSignedWarpMessage,
          })

          console.log("P-Chain transaction ID:", pChainTxId)
          updateStepStatus("submitPChainTx", "success")
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("submitPChainTx", "error", `Failed to submit P-Chain transaction: ${message}`)
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
            throw new Error("Validation ID is missing. Retrying might be needed.")
          }

          const justification = await GetRegistrationJustification(
            nodeID,
            currentValidationID,
            signingSubnetId || subnetId,
            publicClient
          )

          if (!justification) {
            throw new Error("No justification logs found for this validation ID")
          }

          const validationIDBytes = hexToBytes(currentValidationID as `0x${string}`)
          const removeValidatorMessage = packL1ValidatorRegistration(
            validationIDBytes,
            false,
            avalancheNetworkID,
            "11111111111111111111111111111111LpoYY"
          )
          console.log("Remove Validator Message:", removeValidatorMessage)
          console.log("Remove Validator Message Hex:", bytesToHex(removeValidatorMessage))
          console.log("Justification:", justification)

          const signature = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
            network: networkName,
            signatureAggregatorRequest: {
              message: bytesToHex(removeValidatorMessage),
              justification: bytesToHex(justification),
              signingSubnetId: signingSubnetId || subnetId,
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
          return
        }
      }

      // Step 6: completeRemoval
      if (!startFromStep || startFromStep === "completeRemoval") {
        updateStepStatus("completeRemoval", "loading")
        try {
          if (!currentPChainSignature) {
            throw new Error("P-Chain signature is missing. Retrying might be needed.")
          }
          const signedPChainWarpMsgBytes = hexToBytes(`0x${currentPChainSignature}`)
          const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes)

          if (!validatorManagerAddress) throw new Error("Proxy address is not set.");
          if (!coreWalletClient) throw new Error("Core wallet client is not initialized.");
          if (!publicClient) throw new Error("Public client is not initialized.");
          if (!viemChain) throw new Error("Viem chain is not configured.");

          const hash = await coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "completeValidatorRemoval",
            args: [0],
            accessList,
            account: coreWalletClient.account,
            chain: viemChain
          })
          console.log("Transaction sent:", hash)
          let receipt;
          try {
            receipt = await publicClient.waitForTransactionReceipt({ hash })
            console.log("Transaction receipt:", receipt)
            if (receipt.status !== 'success') {
              throw new Error(`Transaction failed with status: ${receipt.status}`);
            }
          } catch (receiptError: any) {
            console.error("Failed to get transaction receipt:", receiptError);
            throw new Error(`Failed waiting for transaction receipt: ${receiptError.message}`);
          }

          updateStepStatus("completeRemoval", "success")
          completeProcessing(`Validator ${nodeID} removal process completed successfully.`)
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          updateStepStatus("completeRemoval", "error", message)
          return
        }
      }

    } catch (err: any) {
      setError(`Failed to remove validator: ${err.message}`)
      console.error(err)
      showBoundary(err)
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

        <div className="space-y-2">
          <SelectSubnetId
            value={subnetId}
            onChange={setSubnetId}
            error={validatorManagerError}
          />
          {validatorManagerAddress && (
            <div className="mt-2">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Validator Manager Address</div>
              <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate">{validatorManagerAddress}</div>
            </div>
          )}
        </div>

        {!isProcessing && (
          <Button
            onClick={() => handleRemove()}
            disabled={!nodeID || !validatorManagerAddress || isProcessing || !!validatorManagerError}
            error={validatorManagerError || (!validatorManagerAddress ? "Select a valid L1 subnet" : "")}
          >
            {"Remove Validator"}
          </Button>
        )}

        {isProcessing && (
          <div className="mt-4 border border-zinc-200 dark:border-zinc-700 rounded-md p-4 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">Removal Progress</h3>
              {isProcessComplete && (
                <button
                  onClick={resetSteps}
                  className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded transition-colors"
                >
                  Start New Removal
                </button>
              )}
            </div>

            {stepKeys.map((stepKey) => (
              <StepIndicator
                key={stepKey}
                status={steps[stepKey].status}
                label={config[stepKey]}
                error={steps[stepKey].error}
                onRetry={() => handleRetry(stepKey, handleRemove)}
                stepKey={stepKey}
              />
            ))}

            {!isProcessComplete && (
              <Button
                onClick={resetSteps}
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
