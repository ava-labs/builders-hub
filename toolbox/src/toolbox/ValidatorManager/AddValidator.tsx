"use client";

import { useState, useEffect } from "react"
import { useCreateChainStore } from "../../stores/createChainStore"
import { useViemChainStore } from "../../stores/toolboxStore"
import { useSelectedL1 } from "../../stores/l1ListStore"

import { useWalletStore } from "../../stores/walletStore"
import { useErrorBoundary } from "react-error-boundary"
import { fromBytes, bytesToHex, hexToBytes, Chain } from "viem"
import { pvm, utils, networkIDs } from "@avalabs/avalanchejs"
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { packWarpIntoAccessList } from "./packWarp"
import { packL1ValidatorRegistration } from "../L1/convertWarp"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import { AlertCircle, CheckCircle } from "lucide-react"
import { Container } from "../../components/Container"
import { Button } from "../../components/Button"
import { StepIndicator } from "../../components/StepIndicator"
import { parseNodeID } from "../../coreViem/utils/ids"
import { getRPCEndpoint } from "../../coreViem/utils/rpc"
import { useStepProgress, StepsConfig } from "../hooks/useStepProgress"
import { registerL1Validator } from "../../coreViem/methods/registerL1Validator"
import { ValidatorListInput, ConvertToL1Validator } from "../../components/ValidatorListInput"
import { getValidationIdHex } from "../../coreViem/hooks/getValidationID"
import { getPChainBalance } from "../../coreViem/methods/getPChainbalance"
import SelectSubnetId from "../../components/SelectSubnetId"
import {
    getBlockchainInfoForNetwork
} from "../../coreViem/utils/glacier"
import { formatAvaxBalance } from "../../coreViem/utils/format"
import { validateStakePercentage } from "../../coreViem/hooks/getTotalStake"
import { useValidatorManagerDetails } from "../hooks/useValidatorManagerDetails"
import { validateContractOwner } from "../../coreViem/hooks/validateContractOwner"
import { ValidatorManagerDetails } from "../../components/ValidatorManagerDetails"

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
    const selectedL1 = useSelectedL1()();
    const { avalancheNetworkID, coreWalletClient, pChainAddress, publicClient } = useWalletStore()
    const viemChain = useViemChainStore()
    // State variables 
    const [validators, setValidators] = useState<ConvertToL1Validator[]>([])
    const [balance, setBalance] = useState("0")
    const [rawPChainBalanceNavax, setRawPChainBalanceNavax] = useState<bigint | null>(null);
    const [totalStake, setTotalStake] = useState(BigInt(0))
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const [subnetId, setSubnetId] = useState(createChainStoreSubnetId || "")
    const [validationErrors, setValidationErrors] = useState<{
        insufficientBalance?: boolean,
        weightTooHigh?: boolean,
        notContractOwner?: boolean
    }>({})
    const [isContractOwner, setIsContractOwner] = useState<boolean | null>(null)

    const {
        validatorManagerAddress,
        blockchainId,
        signingSubnetId,
        error: validatorManagerError,
        isLoading: isLoadingVMCDetails,
        contractTotalWeight,
        l1WeightError,
    } = useValidatorManagerDetails({ subnetId });

    // State for warp messages
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
    const pvmApi: pvm.PVMApi = new pvm.PVMApi(platformEndpoint)

    // Fetch P-Chain balance and total stake when component mounts
    useEffect(() => {
        // Use a ref to track if the component is mounted
        const isMounted = { current: true };

        const fetchBalanceAndStake = async () => {
            if (!pChainAddress) return;

            try {
                // Fetch P-Chain balance using the utility function
                try {
                    const balanceValue = await getPChainBalance(coreWalletClient);

                    if (isMounted.current) {
                        const formattedBalance = formatAvaxBalance(balanceValue);
                        setBalance(formattedBalance);
                        setRawPChainBalanceNavax(balanceValue);
                    }
                } catch (balanceError) {
                    // Handle balance fetch error
                    console.error("Error fetching balance:", balanceError);
                }

                // Add a small delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

                // Fetch total stake only if subnet ID is available
                if (subnetId && subnetId !== "11111111111111111111111111111111LpoYY") {
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
                        }
                    } catch (stakeError) {
                        console.error("Error fetching stake:", stakeError);
                    }
                }
            } catch (error) {
                throw new Error("Error fetching balance or stake: " + error)
            }
        };

        // Initial fetch
        fetchBalanceAndStake();

        // Cleanup function to avoid updates after unmount
        return () => {
            isMounted.current = false;
        };
    }, [pChainAddress, subnetId, coreWalletClient, avalancheNetworkID]);

    // Calculate stake percentage when contractTotalWeight or validators change
    useEffect(() => {
        if (contractTotalWeight > 0n && validators.length > 0) {
            const validatorWeightBigInt = BigInt(validators[0].validatorWeight.toString());
            // For a new validator, currentWeight is 0n. validateStakePercentage will calculate
            // newValidatorWeight / totalL1StakeBeforeChange.
            const { percentageChange } = validateStakePercentage(contractTotalWeight, validatorWeightBigInt, 0n);
            console.log(`New validator's weight as percentage of current L1 stake: ${percentageChange.toFixed(2)}% (Contract total: ${contractTotalWeight}, New validator weight: ${validatorWeightBigInt})`);
        } else if (totalStake > 0n && validators.length > 0 && contractTotalWeight === 0n && !l1WeightError) {
            // Fallback to P-Chain totalStake for percentage calculation if contract weight is 0 and no specific L1 error
            const validatorWeightBigInt = BigInt(validators[0].validatorWeight.toString());
            // This fallback calculates newValidatorWeight / (PChainTotalStake + newValidatorWeight)
            // This is a different calculation than the primary one above.
            const weightPercentage = (Number(validatorWeightBigInt * 100n) / Number(totalStake + validatorWeightBigInt));
            console.log(`Calculated stake percentage using P-Chain total stake (fallback): ${weightPercentage.toFixed(2)}%`);
        }
    }, [contractTotalWeight, totalStake, validators, l1WeightError]);

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

                    if (!ownershipValidated) {
                        setValidationErrors(prev => ({ ...prev, notContractOwner: true }))
                    } else {
                        setValidationErrors(prev => ({ ...prev, notContractOwner: false }))
                    }
                } catch (error) {
                    setIsContractOwner(false)
                }
            }
        }

        checkOwnership()
    }, [validatorManagerAddress, publicClient, coreWalletClient])

    // Update the validation function to check contract ownership
    const validateInputs = (): boolean => {
        const errors: {
            insufficientBalance?: boolean,
            weightTooHigh?: boolean,
            notContractOwner?: boolean
        } = {}

        if (validators.length === 0) {
            hookSetError("Please add a validator to continue")
            return false
        }

        // Check if user is contract owner
        if (isContractOwner === false) {
            errors.notContractOwner = true
            hookSetError("You are not the owner of this contract. Only the contract owner can add validators.")
            setValidationErrors(errors)
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

            // For a new validator, its currentWeight is 0n.
            // percentageChange will be: newValidatorWeight / contractTotalWeight (current L1 total)
            const { percentageChange, exceedsMaximum } = validateStakePercentage(
                contractTotalWeight,
                validatorWeightBigInt,
                0n // currentWeightOfValidatorToChange is 0 for a new validator
            )

            if (exceedsMaximum) {
                errors.weightTooHigh = true
                hookSetError(`The new validator's proposed weight (${validator.validatorWeight}) represents ${percentageChange.toFixed(2)}% of the current total L1 stake (${contractTotalWeight}). This must be less than 20%.`)
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
                    // Build arguments for transaction
                    const args = [
                        parseNodeID(validator.nodeID),
                        validator.nodePOP.publicKey,
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
                        throw new Error("P-Chain warp message is empty. Retry the previous step before this one.")
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

                {isContractOwner === false && !hookError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
                        <div className="flex items-center">
                            <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                            <span>You are not the owner of this contract. Only the contract owner can add validators.</span>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <div className="space-y-1">
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

                    <div className="mt-4">
                        <ValidatorListInput
                            validators={validators}
                            onChange={setValidators}
                            defaultAddress={pChainAddress ? pChainAddress : ""}
                            label="Add New Validator"
                            description="Add a validator to your L1 by pasting the JSON response from your node"
                            l1TotalInitializedWeight={!l1WeightError && contractTotalWeight > 0n ? contractTotalWeight : null}
                            userPChainBalanceNavax={rawPChainBalanceNavax}
                            maxValidators={1}
                        />

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
                            disabled={!validatorManagerAddress || !subnetId || validators.length === 0 || !!validatorManagerError || isLoadingVMCDetails || isContractOwner === false}
                            error={validatorManagerError || (!validatorManagerAddress ? "Select a valid L1 subnet" : "") || (isContractOwner === false ? "Not the contract owner" : "")}
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
