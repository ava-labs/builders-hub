import { useState, useEffect, useRef } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { getSubnetInfoForNetwork, getBlockchainInfoForNetwork } from "../coreViem/utils/glacier";
import { useWalletStore } from "../stores/walletStore";
import { useViemChainStore } from "../stores/toolboxStore";
import { useValidatorManager } from "./contracts/core/useValidatorManager";
import { usePoAManager } from "./contracts/governance/usePoAManager";
import { useChainPublicClient } from "./useChainPublicClient";

interface ValidatorManagerDetails {
    validatorManagerAddress: string;
    blockchainId: string;
    signingSubnetId: string;
    error: string | null;
    isLoading: boolean;
    contractTotalWeight: bigint;
    l1WeightError: string | null;
    isLoadingL1Weight: boolean;
    contractOwner: string | null;
    ownershipError: string | null;
    isLoadingOwnership: boolean;
    isOwnerContract: boolean;
    ownerType: 'PoAManager' | 'StakingManager' | 'EOA' | null;
    isDetectingOwnerType: boolean;
}

interface UseValidatorManagerDetailsProps {
    subnetId: string;
}

export function useValidatorManagerDetails({ subnetId }: UseValidatorManagerDetailsProps): ValidatorManagerDetails {
    const { avalancheNetworkID } = useWalletStore();
    const viemChain = useViemChainStore();
    const chainPublicClient = useChainPublicClient();

    const [validatorManagerAddress, setValidatorManagerAddress] = useState("");
    const [blockchainId, setBlockchainId] = useState("");
    const [signingSubnetId, setSigningSubnetId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [contractTotalWeight, setContractTotalWeight] = useState<bigint>(0n);
    const [l1WeightError, setL1WeightError] = useState<string | null>(null);
    const [isLoadingL1Weight, setIsLoadingL1Weight] = useState(false);

    // Contract owner states (no ownership verification, just the address)
    const [contractOwner, setContractOwner] = useState<string | null>(null);

    // Initialize hooks for contract interactions (after state declarations)
    const validatorManager = useValidatorManager(validatorManagerAddress || null);
    // Initialize PoA Manager hook with owner address (will be null initially)
    const poaManager = usePoAManager(contractOwner);
    const [ownershipError, setOwnershipError] = useState<string | null>(null);
    const [isLoadingOwnership, setIsLoadingOwnership] = useState(false);
    const [isOwnerContract, setIsOwnerContract] = useState(false);

    // Owner contract type detection states
    const [ownerType, setOwnerType] = useState<'PoAManager' | 'StakingManager' | 'EOA' | null>(null);
    const [isDetectingOwnerType, setIsDetectingOwnerType] = useState(false);

    // Cache to store fetched details for each subnetId to avoid redundant API calls
    const subnetCache = useRef<Record<string, {
        validatorManagerAddress: string;
        blockchainId: string;
        signingSubnetId: string;
    }>>({});

    useEffect(() => {
        const fetchDetails = async () => {
            if (!subnetId || subnetId === "11111111111111111111111111111111LpoYY") {
                setValidatorManagerAddress("");
                setBlockchainId("");
                setSigningSubnetId("");
                setError("Please select a valid subnet ID.");
                setIsLoading(false);
                setContractTotalWeight(0n);
                setL1WeightError(null);
                setContractOwner(null);
                setOwnershipError(null);
                setIsOwnerContract(false);
                setOwnerType(null);
                setIsDetectingOwnerType(false);
                return;
            }

            setIsLoading(true);
            setError(null);
            setContractTotalWeight(0n);
            setL1WeightError(null);
            setContractOwner(null);
            setOwnershipError(null);
            setIsOwnerContract(false);
            setOwnerType(null);
            setIsDetectingOwnerType(false);

            const cacheKey = `${avalancheNetworkID}-${subnetId}`;
            if (subnetCache.current[cacheKey]) {
                const cached = subnetCache.current[cacheKey];
                setValidatorManagerAddress(cached.validatorManagerAddress);
                setBlockchainId(cached.blockchainId);
                setSigningSubnetId(cached.signingSubnetId);
                setIsLoading(false);
                return;
            }

            try {
                const network = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "testnet";

                const subnetInfo = await getSubnetInfoForNetwork(network, subnetId);

                if (!subnetInfo.isL1 || !subnetInfo.l1ValidatorManagerDetails) {
                    setValidatorManagerAddress("");
                    setBlockchainId("");
                    setSigningSubnetId("");
                    setError("Selected subnet is not an L1 or doesn\'t have a Validator Manager Contract.");
                    setIsLoading(false);
                    return;
                }

                const vmcAddress = subnetInfo.l1ValidatorManagerDetails.contractAddress;
                const vmcBlockchainId = subnetInfo.l1ValidatorManagerDetails.blockchainId;

                const blockchainInfoForVMC = await getBlockchainInfoForNetwork(network, vmcBlockchainId);
                const expectedChainIdForVMC = blockchainInfoForVMC.evmChainId;

                if (viemChain && viemChain.id !== expectedChainIdForVMC) {
                    setError(`Please switch to chain ID ${expectedChainIdForVMC} to use this L1's Validator Manager. Current: ${viemChain.id}`);
                    setIsLoading(false);
                    return;
                }

                // Successfully fetched VMC address and blockchain ID, now get signing subnet ID
                const blockchainInfoForSigning = await getBlockchainInfoForNetwork(network, vmcBlockchainId);
                const fetchedSigningSubnetId = blockchainInfoForSigning.subnetId;

                setValidatorManagerAddress(vmcAddress);
                setBlockchainId(vmcBlockchainId);
                setSigningSubnetId(fetchedSigningSubnetId || subnetId); // Fallback to initial subnetId if specific signing one isn\'t found

                // Cache the fetched details
                subnetCache.current[cacheKey] = {
                    validatorManagerAddress: vmcAddress,
                    blockchainId: vmcBlockchainId,
                    signingSubnetId: fetchedSigningSubnetId || subnetId,
                };
                setError(null);

            } catch (e: any) {
                setValidatorManagerAddress("");
                setBlockchainId("");
                setSigningSubnetId("");
                setError(e.message || "Failed to fetch Validator Manager information for this subnet.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [subnetId, viemChain?.id, avalancheNetworkID]);

    // Fetch L1 total weight
    useEffect(() => {
        const fetchL1TotalWeight = async () => {
            if (!chainPublicClient) {
                setContractTotalWeight(0n);
                setL1WeightError(null);
                setIsLoadingL1Weight(false);
                return;
            }

            if (!validatorManagerAddress) { // If no VMC address yet, don't attempt to fetch
                setContractTotalWeight(0n);
                setL1WeightError(null);
                setIsLoadingL1Weight(false);
                return;
            }

            setIsLoadingL1Weight(true);
            setL1WeightError(null); // Clear previous errors before fetching

            try {
                if (!validatorManager.isReady) {
                    throw new Error('Validator manager not ready');
                }

                const totalWeight = await validatorManager.l1TotalWeight();
                setContractTotalWeight(totalWeight);

                if (totalWeight === 0n) {
                    // If totalWeight is 0, it strongly suggests the VMC is not initialized or has no stake.
                    setL1WeightError("VMC potentially uninitialized: L1 Total Weight is 0. Please verify the Validator Manager Contract setup.");
                } else {
                    setL1WeightError(null); // Clear error if weight is successfully fetched and non-zero
                }
            } catch (e: any) {
                setContractTotalWeight(0n); // Reset on error
                // Check for specific error messages indicating VMC issues
                if (e.message?.includes('returned no data ("0x")') ||
                    e.message?.includes('The contract function "l1TotalWeight" returned no data')) {
                    setL1WeightError("Validator Manager contract weight is 0, is the contract initialized?"); // User's requested message for "0x" error
                } else if (e.message?.includes('address is not a contract')) {
                    setL1WeightError("VMC Address Error: The provided address is not a contract. Please check the VMC address.");
                } else {
                    // Generic error for other issues
                    setL1WeightError("Failed to load L1 weight data from contract. Check network or VMC address.");
                }
            } finally {
                setIsLoadingL1Weight(false);
            }
        };

        fetchL1TotalWeight();
    }, [validatorManagerAddress, chainPublicClient]);

    // Fetch contract owner (no ownership verification, just fetch the owner address)
    useEffect(() => {
        const fetchContractOwner = async () => {
            if (!chainPublicClient || !validatorManagerAddress) {
                setContractOwner(null);
                setOwnershipError(null);
                setIsLoadingOwnership(false);
                setIsOwnerContract(false);
                return;
            }

            setIsLoadingOwnership(true);
            setOwnershipError(null);
            setIsOwnerContract(false);
            setOwnerType(null);

            try {
                if (!validatorManager.isReady) {
                    throw new Error('Validator manager not ready');
                }

                // Fetch contract owner address using the hook
                const owner = await validatorManager.owner() as `0x${string}`;

                setContractOwner(owner);

                // Check if the owner is a contract by checking if it has bytecode
                if (owner) {
                    try {
                        const bytecode = await chainPublicClient!.getBytecode({ address: owner });
                        const isContract = !!bytecode && bytecode !== '0x';
                        setIsOwnerContract(isContract);

                        // If it's not a contract, set it as EOA immediately
                        if (!isContract) {
                            setOwnerType('EOA');
                        }
                    } catch (e) {
                        console.warn("Could not check if owner is a contract:", e);
                        setIsOwnerContract(false);
                        setOwnerType('EOA'); // Default to EOA if we can't determine
                    }
                }

            } catch (e: any) {
                setContractOwner(null);
                setOwnershipError(e.message || "Failed to fetch contract owner information.");
                setIsOwnerContract(false);
            } finally {
                setIsLoadingOwnership(false);
            }
        };

        fetchContractOwner();
    }, [validatorManagerAddress, chainPublicClient]);

    // Detect owner contract type when owner is a contract
    useEffect(() => {
        const detectOwnerType = async () => {
            if (!isOwnerContract || !contractOwner || !chainPublicClient) {
                setIsDetectingOwnerType(false);
                return;
            }

            setIsDetectingOwnerType(true);
            try {
                if (!poaManager.isReady) {
                    // If PoA Manager hook is not ready, can't detect
                    setOwnerType('StakingManager');
                    return;
                }

                // Try to call owner() function using PoAManager hook to detect if it's a PoAManager
                const ownerAddress = await poaManager.owner();

                // If we can successfully call owner() with PoAManager ABI, it's a PoAManager
                if (ownerAddress) {
                    setOwnerType('PoAManager');
                } else {
                    setOwnerType('StakingManager');
                }
            } catch (error) {
                console.log('Owner contract does not have PoAManager ABI structure, likely StakingManager');
                setOwnerType('StakingManager');
            } finally {
                setIsDetectingOwnerType(false);
            }
        };

        detectOwnerType();
    }, [isOwnerContract, contractOwner, chainPublicClient]);

    return {
        validatorManagerAddress,
        blockchainId,
        signingSubnetId,
        error,
        isLoading,
        contractTotalWeight,
        l1WeightError,
        isLoadingL1Weight,
        contractOwner,
        ownershipError,
        isLoadingOwnership,
        isOwnerContract,
        ownerType,
        isDetectingOwnerType
    };
} 
