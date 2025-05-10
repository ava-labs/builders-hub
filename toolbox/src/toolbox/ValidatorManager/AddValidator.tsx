"use client";

import { useState, useEffect, useRef } from "react"
import { useSelectedL1, useViemChainStore } from "../toolboxStore"
import { useWalletStore } from "../../lib/walletStore"
import { useErrorBoundary } from "react-error-boundary"
import { fromBytes, bytesToHex, hexToBytes, Chain } from "viem"
import { pvm, utils, networkIDs } from "@avalabs/avalanchejs"
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { packWarpIntoAccessList } from "./packWarp"
import { packL1ValidatorRegistration } from "../L1/convertWarp"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import { AlertCircle, CheckCircle } from "lucide-react"
import { Container } from "../components/Container"
import { Button } from "../../components/Button"
import { StepIndicator } from "../components/StepIndicator"
import { parseNodeID } from "../../coreViem/utils/ids"
import { getRPCEndpoint } from "../../coreViem/utils/rpc"
import { useStepProgress, StepsConfig } from "../hooks/useStepProgress"
import { registerL1Validator } from "../../coreViem/methods/registerL1Validator"
import { ValidatorListInput, ConvertToL1Validator } from "../../components/ValidatorListInput"
import { getValidationIdHex } from "../../coreViem/hooks/getValidationID"
import { getPChainBalance } from "../../coreViem/methods/getPChainbalance"
import SelectSubnetId from "../components/SelectSubnetId"
import { 
    getSubnetInfoForNetwork, 
    getBlockchainInfoForNetwork 
} from "../../coreViem/utils/glacier"
import { getTotalStake, validateStakePercentage } from "../../coreViem/hooks/getTotalStake"

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

// Helper function to format AVAX amounts
function formatAvaxBalance(balance: number | bigint): string {
    const balanceNum = typeof balance === 'bigint' ? Number(balance) : balance;
    return (
        (balanceNum / 1_000_000_000).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) + " AVAX"
    );
}

export default function AddValidator() {
    const { showBoundary } = useErrorBoundary()
    const selectedL1 = useSelectedL1()();
    const { avalancheNetworkID, coreWalletClient, pChainAddress, publicClient } = useWalletStore()
    const viemChain = useViemChainStore()

    // Add a ref to track which subnet IDs we've already fetched
    const subnetCache = useRef<Record<string, {
      validatorManagerAddress: string;
      blockchainId: string;
      signingSubnetId: string;
    }>>({});

    // State variables 
    const [validators, setValidators] = useState<ConvertToL1Validator[]>([])
    const [balance, setBalance] = useState("0")
    const [totalStake, setTotalStake] = useState(BigInt(0))
    const [subnetId, setSubnetId] = useState(selectedL1?.subnetId || "")
    const [validatorManagerAddress, setValidatorManagerAddress] = useState("")
    const [blockchainId, setBlockchainId] = useState("")
    const [signingSubnetId, setSigningSubnetId] = useState("")
    const [validatorManagerError, setValidatorManagerError] = useState<string | null>(null)
    const [validationErrors, setValidationErrors] = useState<{
        insufficientBalance?: boolean,
        weightTooHigh?: boolean
    }>({})

    // State for temp account and warp messages
    const [registerL1ValidatorUnsignedWarpMsg, setRegisterL1ValidatorUnsignedWarpMsg] = useState("")
    const [validationID, setValidationID] = useState("")
    const [savedSignedMessage, setSavedSignedMessage] = useState("")
    const [savedPChainWarpMsg, setSavedPChainWarpMsg] = useState("")

    // Add state for contract total weight
    const [contractTotalWeight, setContractTotalWeight] = useState<bigint>(0n)
    const [stakePercentage, setStakePercentage] = useState<number | null>(null)

    // Add loading state for weight information
    const [isLoadingWeight, setIsLoadingWeight] = useState(false)

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
    const pvmApi: pvm.PVMApi = new pvm.PVMApi(platformEndpoint)

    // Fetch P-Chain balance and total stake when component mounts
    useEffect(() => {
        // Use a ref to track if the component is mounted
        const isMounted = { current: true };
        // Simple cache to store recent API results
        const cache: {
            balance?: { timestamp: number; value: string };
            stake?: { timestamp: number; value: bigint };
        } = {};
        
        const fetchBalanceAndStake = async () => {
            if (!pChainAddress) return;
            
            try {
                // Check if we have cached data and it's recent (less than 10 seconds old)
                const now = Date.now();
                let shouldFetchBalance = !cache.balance || (now - cache.balance.timestamp > 10000);
                let shouldFetchStake = !cache.stake || (now - cache.stake.timestamp > 10000);
                
                // Fetch P-Chain balance using the utility function
                if (shouldFetchBalance) {
                    try {
                        const balanceValue = await getPChainBalance(coreWalletClient);
                        
                        if (isMounted.current) {
                            const formattedBalance = formatAvaxBalance(balanceValue);
                            setBalance(formattedBalance);
                            // Cache the result
                            cache.balance = { timestamp: now, value: formattedBalance };
                        }
                    } catch (balanceError) {
                        console.error("Error fetching balance:", balanceError);
                        // If we get a rate limit error, use cached data if available
                        if (cache.balance) {
                            setBalance(cache.balance.value);
                        }
                    }
                    
                    // Add a small delay between requests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else if (cache.balance) {
                    setBalance(cache.balance.value);
                }
                
                // Fetch total stake only if needed and if subnet ID is available
                if (shouldFetchStake && subnetId && subnetId !== "11111111111111111111111111111111LpoYY") {
                    try {
                        // Use a longer timeout for stake-related requests
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
                        
                        const rpcEndpoint = getRPCEndpoint(avalancheNetworkID !== networkIDs.MainnetID);
                        const pvmApi = new pvm.PVMApi(rpcEndpoint);
                        
                        const subnetInfo = await pvmApi.getCurrentValidators({
                            subnetID: subnetId
                        });
                        
                        clearTimeout(timeoutId);
                        
                        if (isMounted.current) {
                            const total = subnetInfo.validators?.reduce(
                                (sum, val) => sum + BigInt(val.weight || 0), 
                                BigInt(0)
                            ) || BigInt(0);
                            
                            setTotalStake(total);
                            // Cache the result
                            cache.stake = { timestamp: now, value: total };
                        }
                    } catch (stakeError) {
                        console.error("Error fetching stake:", stakeError);
                        // If we get a rate limit error, use cached data if available
                        if (cache.stake) {
                            setTotalStake(cache.stake.value);
                        }
                    }
                } else if (cache.stake) {
                    setTotalStake(cache.stake.value);
                }
            } catch (error) {
                console.error("Error in fetchBalanceAndStake:", error);
            }
        };
        
        // Initial fetch
        fetchBalanceAndStake();
        
        // Cleanup function to avoid updates after unmount
        return () => {
            isMounted.current = false;
        };
    }, [pChainAddress, subnetId, coreWalletClient, avalancheNetworkID]);

    // Update the useEffect to check viemChain compatibility
    useEffect(() => {
        const fetchVMCDetails = async () => {
            if (!subnetId || subnetId === "11111111111111111111111111111111LpoYY") {
                setValidatorManagerAddress("")
                setBlockchainId("")
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
                setBlockchainId(cachedValues.blockchainId);
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
                    setBlockchainId("")
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
                    setBlockchainId(vmcBlockchainId)
                    
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
                        signingSubnetId: signingSubnetId
                    };
                    
                } catch (chainError) {
                    console.error("Error checking chain compatibility:", chainError)
                    setValidatorManagerError("Failed to verify chain compatibility. Please ensure your wallet is connected.")
                    return
                }
                
            } catch (error) {
                console.error("Error fetching Validator Manager details:", error)
                setValidatorManagerAddress("")
                setBlockchainId("")
                setValidatorManagerError("Failed to fetch Validator Manager information for this subnet")
            }
        }
        
        fetchVMCDetails()
    }, [subnetId, publicClient, viemChain, avalancheNetworkID])

    // Enhance the fetchTotalWeight function with better logging and loading state
    useEffect(() => {
        // Add explicit type for console log
        console.log(`Validator manager address: ${String(validatorManagerAddress || "None")}`)
        
        const fetchTotalWeight = async () => {
            // Check prerequisites
            if (!validatorManagerAddress) {
                console.log("Cannot fetch weight: No validator manager address")
                return
            }
            
            if (!publicClient) {
                console.log("Cannot fetch weight: No public client")
                return
            }
            
            // Set loading state and log attempt
            setIsLoadingWeight(true)
            console.log(`Attempting to fetch total L1 weight from contract at: ${validatorManagerAddress}`)
            
            try {
                // Ensure the address is properly formatted as a hex string with 0x prefix
                const formattedAddress = validatorManagerAddress.startsWith('0x') 
                    ? validatorManagerAddress as `0x${string}` 
                    : `0x${validatorManagerAddress}` as `0x${string}`
                    
                console.log(`Using formatted address: ${formattedAddress}`)
                
                // Use the existing getTotalStake function
                const totalWeight = await getTotalStake(
                    publicClient, 
                    formattedAddress
                )
                
                // Log success and update state
                console.log(`Successfully fetched total L1 weight: ${totalWeight.toString()}`)
                setContractTotalWeight(totalWeight)
                
                // Update stake percentage if we have a validator weight
                if (validators.length > 0) {
                    // Ensure validator weight is treated as BigInt
                    const validatorWeightBigInt = BigInt(validators[0].validatorWeight.toString())
                    
                    const { percentage } = validateStakePercentage(
                        totalWeight,
                        validatorWeightBigInt
                    )
                    setStakePercentage(percentage)
                    console.log(`Calculated stake percentage: ${percentage.toFixed(2)}%`)
                } else {
                    console.log("No validators to calculate percentage for")
                    setStakePercentage(null)
                }
            } catch (error) {
                console.error("Error fetching total L1 weight from contract:", error)
                
                // More detailed error logging
                if (error instanceof Error) {
                    console.error(`Error name: ${error.name}, Message: ${error.message}`)
                    console.error(`Stack trace: ${error.stack}`)
                }
                
                // Reset to ensure we don't use stale data
                setContractTotalWeight(0n)
            } finally {
                setIsLoadingWeight(false)
            }
        }
        
        fetchTotalWeight()
    }, [validatorManagerAddress, publicClient, validators.length > 0 ? String(validators[0]?.validatorWeight || "") : ""]);

    // Update the validation function to use the contractTotalWeight
    const validateInputs = (): boolean => {
        const errors: {
            insufficientBalance?: boolean,
            weightTooHigh?: boolean
        } = {}
        
        if (validators.length === 0) {
            hookSetError("Please add a validator to continue")
            return false
        }
        
        const validator = validators[0]
        
        // Skip balance check if we couldn't fetch the balance
        if (balance) {
            // Extract numerical value from balance string (remove " AVAX" and commas)
            const balanceValue = parseFloat(balance.replace(" AVAX", "").replace(/,/g, ""));
            const requiredBalance = Number(validator.validatorBalance) / 1000000000;
            
            if (balanceValue < requiredBalance) {
                errors.insufficientBalance = true;
                hookSetError(`Insufficient P-Chain balance. You need at least ${requiredBalance.toFixed(2)} AVAX.`);
                setValidationErrors(errors);
                return false;
            }
        }
        
        // Use contract total weight for validation if available
        if (contractTotalWeight > 0n) {
            // Ensure validator weight is treated as BigInt
            const validatorWeightBigInt = BigInt(validator.validatorWeight.toString())
            
            const { percentage, exceedsMaximum } = validateStakePercentage(
                contractTotalWeight,
                validatorWeightBigInt
            )
            
            setStakePercentage(percentage)
            
            if (exceedsMaximum) {
                errors.weightTooHigh = true
                hookSetError(`Validator weight must be less than 20% of total L1 weight (currently ${percentage.toFixed(2)}%).`)
                setValidationErrors(errors)
                return false
            }
        } else if (totalStake > 0n) {
            // Fall back to P-Chain totalStake if contract weight is not available
            // Ensure validator weight is converted to BigInt
            const validatorWeightBigInt = BigInt(validator.validatorWeight.toString())
            const weightPercentage = (Number(validatorWeightBigInt * 100n) / 
                Number(totalStake + validatorWeightBigInt))
                
            if (weightPercentage >= 20) {
                errors.weightTooHigh = true
                hookSetError(`Validator weight must be less than 20% of total stake (currently ${weightPercentage.toFixed(2)}%).`)
                setValidationErrors(errors)
                return false
            }
        }
        
        setValidationErrors({})
        return true
    }

    // Main function to add a validator
    const addValidator = async (startFromStep?: AddValidationStepKey) => {
        if (!validateInputs() && !startFromStep) {
            return
        }

        if (!validators.length || !pChainAddress || !validatorManagerAddress) {
            hookSetError("Please fill all required fields to continue")
            return
        }

        startProcessing();

        try {
            // Use the existing public client from wallet store
            if (!publicClient) {
                throw new Error("Public client not initialized. Please ensure your wallet is connected.")
            }
            console.log(await publicClient.getChainId())

            const [account] = await coreWalletClient.requestAddresses()
            const validator = validators[0]

            // Local variables to pass data synchronously within one run
            // Initialize from state if retrying, otherwise empty
            let localUnsignedWarpMsg = startFromStep ? registerL1ValidatorUnsignedWarpMsg : "";
            let localValidationIdHex = startFromStep ? validationID : "";
            let localSignedMessage = startFromStep ? savedSignedMessage : "";
            let localPChainWarpMsg = startFromStep ? savedPChainWarpMsg : "";
            
            // Check signature aggregation parameters
            if (!subnetId) {
                throw new Error("Subnet ID is required for signature aggregation")
            }
            
            // Verify that we're on the correct blockchain
            if (blockchainId) {
                try {
                    // Use the correct network based on avalancheNetworkID
                    const network = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "testnet"
                    const blockchainInfoForValidator: { evmChainId: number } = await getBlockchainInfoForNetwork(
                        network, 
                        blockchainId
                    )
                    const expectedChainIdForValidator = blockchainInfoForValidator.evmChainId
                    
                    // Check viemChain compatibility
                    if (viemChain && viemChain.id !== expectedChainIdForValidator) {
                        throw new Error(`Please use chain ID ${expectedChainIdForValidator} in your wallet. Current selected chain: ${viemChain.name || viemChain.id}`)
                    }
                    
                    // Check connected chain via publicClient
                    const connectedChainId = await publicClient.getChainId()
                    if (connectedChainId !== expectedChainIdForValidator) {
                        throw new Error(`Please connect to chain ID ${expectedChainIdForValidator} to use this L1's Validator Manager`)
                    }
                } catch (chainError) {
                    console.error("Chain verification error:", chainError)
                    throw new Error("Failed to verify connected chain. Please ensure your wallet is connected to the correct network.")
                }
            }

            // Step 1: Initialize Registration
            if (!startFromStep || startFromStep === "initializeRegistration") {
                updateStepStatus("initializeRegistration", "loading")
                try {
                    // Process P-Chain Address
                    const pChainAddressBytes = utils.bech32ToBytes(pChainAddress)
                    const pChainAddressHex = fromBytes(pChainAddressBytes, "hex")
                    const expiry = BigInt(Math.floor(Date.now() / 1000) + 43200) // 12 hours

                    // Build arguments for transaction
                    const args = [
                        parseNodeID(validator.nodeID),
                        validator.nodePOP.publicKey,
                        expiry,
                        {
                            threshold: 1,
                            addresses: [pChainAddressHex],
                        },
                        {
                            threshold: 1,
                            addresses: [pChainAddressHex],
                        },
                        validator.validatorWeight
                    ]
                    
                    // Direct transaction attempt instead of simulation first
                    let hash
                    let receipt
                    
                    try {
                        // Try initiateValidatorRegistration directly
                        hash = await coreWalletClient.writeContract({
                            address: validatorManagerAddress as `0x${string}`,
                            abi: validatorManagerAbi.abi,
                            functionName: "initiateValidatorRegistration",
                            args,
                            account,
                            chain: viemChain as Chain
                        })
                        
                        // Get receipt to extract warp message and validation ID
                        receipt = await publicClient.waitForTransactionReceipt({ hash })
                        console.log("Receipt from initiateValidatorRegistration:", receipt)
                            
                        // Update local var and state
                        localUnsignedWarpMsg = receipt.logs[0].data ?? "";
                        localValidationIdHex = receipt.logs[1].topics[1] ?? "";
                        console.log("Setting warp message:", localUnsignedWarpMsg.substring(0, 20) + "...")
                        console.log("Setting validationID:", localValidationIdHex)
                    } catch (txError) {
                        console.error("Transaction failed:", txError)
                        
                        // Attempt to get existing validation ID
                        try {
                            const validationIDResult = await getValidationIdHex(
                                publicClient,
                                validatorManagerAddress as `0x${string}`,
                                validator.nodeID
                            )
                            
                            if (!validationIDResult) {
                                throw new Error("Transaction failed and no existing validation ID found: " + 
                                    (txError instanceof Error ? txError.message : String(txError)))
                            }
                            
                            // Set validation ID for later use with resendRegisterValidatorMessage
                            localValidationIdHex = validationIDResult as string
                            setValidationID(localValidationIdHex)
                            console.log("Retrieved existing validation ID:", localValidationIdHex)
                            
                            // Use resendRegisterValidatorMessage as fallback
                            console.log("Using resendRegisterValidatorMessage with validation ID:", localValidationIdHex)
                            
                            hash = await coreWalletClient.writeContract({
                                address: validatorManagerAddress as `0x${string}`,
                                abi: validatorManagerAbi.abi,
                                functionName: "resendRegisterValidatorMessage",
                                args: [localValidationIdHex],
                                account,
                                chain: viemChain as Chain
                            })
                            
                            // Get receipt to extract warp message
                            receipt = await publicClient.waitForTransactionReceipt({ hash })
                            console.log("Receipt from resendRegisterValidatorMessage:", receipt)
                            
                            if (!receipt.logs || receipt.logs.length === 0) {
                                throw new Error("No logs found in resendRegisterValidatorMessage receipt")
                            }
                            
                            // Update warp message from receipt
                            localUnsignedWarpMsg = receipt.logs[0].data ?? "";
                            console.log("Setting warp message from resend:", localUnsignedWarpMsg.substring(0, 20) + "...")
                        } catch (validationError) {
                            // If we can't get validation ID or resend fails, report errors
                            throw new Error("Transaction failed and fallback method also failed: " + 
                                (txError instanceof Error ? txError.message : String(txError)))
                        }
                    }
                    
                    // Save to state for potential retries later
                    setRegisterL1ValidatorUnsignedWarpMsg(localUnsignedWarpMsg)
                    setValidationID(localValidationIdHex)
                    
                    updateStepStatus("initializeRegistration", "success")
                } catch (error: any) {
                    console.error("Error during validation initialization:", error)
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

                    console.log("Subnet ID: ", selectedL1?.subnetId)
                    console.log("Network name: ", networkName)
                    console.log("Signing Subnet ID: ", signingSubnetId || subnetId)
                    // Sign the unsigned warp message with signature aggregator
                    const response = await new AvaCloudSDK().data.signatureAggregator.aggregateSignatures({
                        network: networkName,
                        signatureAggregatorRequest: {
                            message: messageToSign,
                            signingSubnetId: signingSubnetId || subnetId,
                            quorumPercentage: 67,
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
                        balance: Number(validator.validatorBalance) / 1000000000 + "",
                        blsProofOfPossession: validator.nodePOP.proofOfPossession,
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
                            signingSubnetId: signingSubnetId || subnetId,
                            quorumPercentage: 67,
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
                        chain: viemChain as Chain
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
                    <div className="space-y-1">
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

                    <div className="mt-4">
                        <ValidatorListInput
                            validators={validators}
                            onChange={setValidators}
                            defaultAddress={pChainAddress ? pChainAddress : ""}
                            label="Add New Validator"
                            description="Add a validator to your L1 by pasting the JSON response from your node"
                        />
                        
                        {validators.length > 0 && (
                            <div className="mt-3 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-md">
                                <p className="text-sm font-medium mb-1 text-zinc-800 dark:text-zinc-200">Validator Weight Information</p>
                                
                                {isLoadingWeight ? (
                                    <p className="text-xs text-blue-600 dark:text-blue-400">
                                        Loading weight information from contract...
                                    </p>
                                ) : contractTotalWeight > 0n ? (
                                    <>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                            Current total L1 weight: <span className="font-mono">{contractTotalWeight.toString()}</span>
                                        </p>
                                        {stakePercentage !== null && (
                                            <p className={`text-xs mt-1 ${stakePercentage >= 20 ? 'text-red-500 font-medium' : 'text-green-500'}`}>
                                                This validator's weight (<span className="font-mono">{BigInt(validators[0].validatorWeight.toString()).toString()}</span>) 
                                                would represent <span className="font-medium">{stakePercentage.toFixed(2)}%</span> of the total L1 weight
                                                {stakePercentage >= 20 && " (must be less than 20%)"}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            Could not load L1 weight data from contract.
                                        </p>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                            Validator Manager: <span className="font-mono">{validatorManagerAddress ? 
                                                (validatorManagerAddress.startsWith('0x') ? validatorManagerAddress : '0x' + validatorManagerAddress).substring(0, 10) + "..." 
                                                : "None"}</span>
                                        </p>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                            Client connected: {publicClient ? "Yes" : "No"}
                                        </p>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                            Using P-Chain total stake as fallback: <span className="font-mono">{totalStake.toString()}</span>
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                        
                        {validationErrors.insufficientBalance && (
                            <p className="text-xs text-red-500 mt-2">
                                Your P-Chain balance is too low for the specified validator balance
                            </p>
                        )}
                        
                        {validationErrors.weightTooHigh && (
                            <p className="text-xs text-red-500 mt-2">
                                Validator weight exceeds 20% of total L1 weight
                            </p>
                        )}
                    </div>
                    
                    {!isProcessing && (
                        <Button
                            onClick={() => addValidator()}
                            disabled={!validatorManagerAddress || !subnetId || validators.length === 0 || !!validatorManagerError}
                            error={validatorManagerError || (!validatorManagerAddress ? "Select a valid L1 subnet" : "")}
                            className="mt-4"
                        >
                            Add Validator
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
            </div>
        </Container>
    )
}
