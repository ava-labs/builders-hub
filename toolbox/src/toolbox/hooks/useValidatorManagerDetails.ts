import { useState, useEffect, useRef } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { getTotalStake } from "../../coreViem/hooks/getTotalStake";
import { getSubnetInfoForNetwork, getBlockchainInfoForNetwork } from "../../coreViem/utils/glacier";
import { useWalletStore } from "../../stores/walletStore";
import { useViemChainStore } from "../../stores/toolboxStore";

interface ValidatorManagerDetails {
    validatorManagerAddress: string;
    blockchainId: string;
    signingSubnetId: string;
    error: string | null;
    isLoading: boolean;
    contractTotalWeight: bigint;
    l1WeightError: string | null;
    isLoadingL1Weight: boolean;
}

interface UseValidatorManagerDetailsProps {
    subnetId: string;
}

export function useValidatorManagerDetails({ subnetId }: UseValidatorManagerDetailsProps): ValidatorManagerDetails {
    const { avalancheNetworkID, publicClient } = useWalletStore();
    const viemChain = useViemChainStore();
    const getChainIdFn = publicClient?.getChainId;

    const [validatorManagerAddress, setValidatorManagerAddress] = useState("");
    const [blockchainId, setBlockchainId] = useState("");
    const [signingSubnetId, setSigningSubnetId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [contractTotalWeight, setContractTotalWeight] = useState<bigint>(0n);
    const [l1WeightError, setL1WeightError] = useState<string | null>(null);
    const [isLoadingL1Weight, setIsLoadingL1Weight] = useState(false);

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
                return;
            }

            setIsLoading(true);
            setError(null);
            setContractTotalWeight(0n);
            setL1WeightError(null);

            const cacheKey = `${avalancheNetworkID}-${subnetId}`;
            if (subnetCache.current[cacheKey]) {
                console.log(`Using cached Validator Manager details for subnet: ${subnetId}`);
                const cached = subnetCache.current[cacheKey];
                setValidatorManagerAddress(cached.validatorManagerAddress);
                setBlockchainId(cached.blockchainId);
                setSigningSubnetId(cached.signingSubnetId);
                setIsLoading(false);
                return;
            }

            try {
                const network = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "testnet";
                console.log(`Fetching Validator Manager details for subnet: ${subnetId} on network: ${network}`);

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
                    setError(`Please use chain ID ${expectedChainIdForVMC} in your wallet. Current selected chain ID: ${viemChain.id}`);
                    setIsLoading(false);
                    return;
                }

                if (!publicClient) {
                    setError("Public client not available. Please ensure your wallet is connected.");
                    setIsLoading(false);
                    return;
                }

                const connectedChainId = await publicClient.getChainId();
                if (connectedChainId !== expectedChainIdForVMC) {
                    setError(`Please connect to chain ID ${expectedChainIdForVMC} to use this L1\'s Validator Manager. Connected: ${connectedChainId}`);
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
                console.error("Error fetching Validator Manager details:", e);
                setValidatorManagerAddress("");
                setBlockchainId("");
                setSigningSubnetId("");
                setError(e.message || "Failed to fetch Validator Manager information for this subnet.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [subnetId, getChainIdFn, viemChain?.id, avalancheNetworkID]);

    // New useEffect for fetching L1 total weight
    useEffect(() => {
        const fetchL1TotalWeight = async () => {
            if (!publicClient) {
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
                const formattedAddress = validatorManagerAddress.startsWith('0x')
                    ? validatorManagerAddress as `0x${string}`
                    : `0x${validatorManagerAddress}` as `0x${string}`;

                const totalWeight = await getTotalStake(publicClient, formattedAddress);
                setContractTotalWeight(totalWeight);

                if (totalWeight === 0n) {
                    // If totalWeight is 0, it strongly suggests the VMC is not initialized or has no stake.
                    setL1WeightError("VMC potentially uninitialized: L1 Total Weight is 0. Please verify the Validator Manager Contract setup.");
                } else {
                    setL1WeightError(null); // Clear error if weight is successfully fetched and non-zero
                }
            } catch (e: any) {
                console.error("Error fetching total L1 weight from contract:", e);
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
    }, [validatorManagerAddress, publicClient]); // Re-run if VMC address or publicClient changes

    return {
        validatorManagerAddress,
        blockchainId,
        signingSubnetId,
        error,
        isLoading,
        contractTotalWeight,
        l1WeightError,
        isLoadingL1Weight
    };
} 
