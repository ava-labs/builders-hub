import { useState, useEffect, useCallback } from "react";
import { Address } from "viem";
import { generateGenesis } from "../genGenesis";
import {
    AllocationEntry,
    AllowlistPrecompileConfig,
    FeeConfigType,
    PreinstallConfig
} from "../types";
import { calculateGenesisSize, formatBytes, getGenesisSizeStatus } from "../utils";

interface UseGenesisGenerationProps {
    shouldGenerateGenesis: boolean;
    evmChainId: number;
    gasLimit: number;
    targetBlockRate: number;
    tokenAllocations: AllocationEntry[];
    contractDeployerAllowListConfig: AllowlistPrecompileConfig;
    contractNativeMinterConfig: AllowlistPrecompileConfig;
    txAllowListConfig: AllowlistPrecompileConfig;
    feeManagerEnabled: boolean;
    feeManagerAdmins: Address[];
    rewardManagerEnabled: boolean;
    rewardManagerAdmins: Address[];
    feeConfig: FeeConfigType;
    warpConfig: {
        enabled: boolean;
        quorumNumerator: number;
        requirePrimaryNetworkSigners: boolean;
    };
    preinstallConfig: PreinstallConfig;
}

export function useGenesisGeneration({
    shouldGenerateGenesis,
    evmChainId,
    gasLimit,
    targetBlockRate,
    tokenAllocations,
    contractDeployerAllowListConfig,
    contractNativeMinterConfig,
    txAllowListConfig,
    feeManagerEnabled,
    feeManagerAdmins,
    rewardManagerEnabled,
    rewardManagerAdmins,
    feeConfig,
    warpConfig,
    preinstallConfig
}: UseGenesisGenerationProps) {
    const [genesisData, setGenesisData] = useState<string>("");
    const [isEditingGenesis, setIsEditingGenesis] = useState(false);
    const [editedGenesisData, setEditedGenesisData] = useState<string>("");
    const [copied, setCopied] = useState(false);
    
    // Calculate genesis size
    const genesisSizeBytes = genesisData ? calculateGenesisSize(genesisData) : 0;
    const genesisSizeFormatted = formatBytes(genesisSizeBytes);
    const genesisSizeStatus = getGenesisSizeStatus(genesisSizeBytes);

    // Generate genesis file only when shouldGenerateGenesis is true
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            if (!shouldGenerateGenesis) {
                setGenesisData("");
                return;
            }

            try {
                if (tokenAllocations.length === 0 || !tokenAllocations[0].address) {
                    setGenesisData("Error: Valid first allocation address needed for ownership.");
                    return;
                }
                const ownerAddressForProxy = tokenAllocations[0].address;

                // Clone the data to avoid potential mutation issues
                const tokenAllocationsCopy = [...tokenAllocations];
                const txAllowListCopy = { ...txAllowListConfig };
                const contractDeployerAllowListCopy = { ...contractDeployerAllowListConfig };
                const contractNativeMinterCopy = { ...contractNativeMinterConfig };
                const feeConfigCopy = { ...feeConfig };

                const baseGenesis = generateGenesis({
                    evmChainId: evmChainId,
                    tokenAllocations: tokenAllocationsCopy,
                    txAllowlistConfig: txAllowListCopy,
                    contractDeployerAllowlistConfig: contractDeployerAllowListCopy,
                    nativeMinterAllowlistConfig: contractNativeMinterCopy,
                    poaOwnerAddress: ownerAddressForProxy as Address,
                    preinstalls: preinstallConfig
                });

                // Override feeConfig, gasLimit, targetBlockRate, warpConfig in the base genesis
                const finalGenesisConfig = {
                    ...baseGenesis,
                    gasLimit: `0x${gasLimit.toString(16)}`,
                    config: {
                        ...baseGenesis.config,
                        feeConfig: {
                            ...feeConfigCopy,
                            gasLimit: gasLimit,
                            targetBlockRate: targetBlockRate,
                        },
                        warpConfig: {
                            blockTimestamp: Math.floor(Date.now() / 1000),
                            quorumNumerator: warpConfig.quorumNumerator,
                            requirePrimaryNetworkSigners: warpConfig.requirePrimaryNetworkSigners,
                        },
                        ...(feeManagerEnabled && {
                            feeManagerConfig: {
                                adminAddresses: [...feeManagerAdmins],
                                blockTimestamp: Math.floor(Date.now() / 1000)
                            }
                        }),
                        ...(rewardManagerEnabled && {
                            rewardManagerConfig: {
                                adminAddresses: [...rewardManagerAdmins],
                                blockTimestamp: Math.floor(Date.now() / 1000)
                            }
                        }),
                    },
                    timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`
                };
                
                console.log("settingGenesis");
                setGenesisData(JSON.stringify(finalGenesisConfig, null, 2));
            } catch (error) {
                console.error("Error generating genesis data:", error);
                setGenesisData(`Error generating genesis: ${error instanceof Error ? error.message : String(error)}`);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(debounceTimer);
    }, [
        shouldGenerateGenesis, evmChainId, gasLimit, targetBlockRate, tokenAllocations,
        contractDeployerAllowListConfig, contractNativeMinterConfig, txAllowListConfig,
        feeManagerEnabled, feeManagerAdmins, rewardManagerEnabled, rewardManagerAdmins,
        feeConfig, warpConfig, preinstallConfig
    ]);

    const handleCopyToClipboard = useCallback(async () => {
        if (!genesisData) return;
        try {
            await navigator.clipboard.writeText(genesisData);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy genesis data:", err);
        }
    }, [genesisData]);

    const handleDownloadGenesis = useCallback(() => {
        if (!genesisData) return;
        const blob = new Blob([genesisData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `genesis-${evmChainId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [genesisData, evmChainId]);

    const handleEditGenesis = useCallback(() => {
        setEditedGenesisData(genesisData);
        setIsEditingGenesis(true);
    }, [genesisData]);

    const handleSaveGenesis = useCallback(() => {
        try {
            JSON.parse(editedGenesisData);
            setGenesisData(editedGenesisData);
            setIsEditingGenesis(false);
        } catch (error) {
            alert("Invalid JSON format. Please fix the syntax errors and try again.");
        }
    }, [editedGenesisData]);

    const handleCancelEdit = useCallback(() => {
        setIsEditingGenesis(false);
        setEditedGenesisData("");
    }, []);

    return {
        genesisData,
        isEditingGenesis,
        editedGenesisData,
        copied,
        genesisSizeBytes,
        genesisSizeFormatted,
        genesisSizeStatus,
        setGenesisData,
        setEditedGenesisData,
        handleCopyToClipboard,
        handleDownloadGenesis,
        handleEditGenesis,
        handleSaveGenesis,
        handleCancelEdit
    };
} 