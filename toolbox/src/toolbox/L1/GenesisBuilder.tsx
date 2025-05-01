"use client";

// FIXME: This is a quick implementation and will be replaced with a genesis builder component later on.

import TransparentUpgradableProxy from "../../../contracts/openzeppelin-4.9/compiled/TransparentUpgradeableProxy.json"
import ProxyAdmin from "../../../contracts/openzeppelin-4.9/compiled/ProxyAdmin.json"
export const quickAndDirtyGenesisBuilder = (
    ownerAddress: `${string}`,
    chainID: number,
    gasLimit: number,
    targetBlockRate: number,
    ownerBalanceDecimal: string,
    precompileConfigs: {
        contractDeployerAllowList: {
            enabled: boolean;
            adminAddresses: string[];
            enabledAddresses: string[];
        };
        contractNativeMinter: {
            enabled: boolean;
            adminAddresses: string[];
            enabledAddresses: string[];
        };
        txAllowList: {
            enabled: boolean;
            adminAddresses: string[];
            enabledAddresses: string[];
        };
        feeManager: {
            enabled: boolean;
            adminAddresses: string[];
        };
        rewardManager: {
            enabled: boolean;
            adminAddresses: string[];
        };
        warpMessenger: {
            enabled: boolean;
            quorumNumerator: number;
            requirePrimaryNetworkSigners: boolean;
        };
    }
) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
        throw new Error("Invalid ownerAddress format. It should be '0x' followed by 20 hex bytes (40 characters).");
    }
    const ownerAddressNo0x = ownerAddress.replace("0x", "");
    const now = Math.floor(Date.now() / 1000);
    const genesis = {
        "airdropAmount": null,
        "airdropHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "alloc": {
            "facade0000000000000000000000000000000000": {
                "balance": "0x0",
                "code": TransparentUpgradableProxy.deployedBytecode.object
                ,
                "storage": {
                    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc": "0x0000000000000000000000001212121212121212121212121212121212121212",
                    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103": "0x000000000000000000000000dad0000000000000000000000000000000000000"
                },
                "nonce": "0x1"
            },
            "dad0000000000000000000000000000000000000": {
                "balance": "0x0",
                "code": ProxyAdmin.deployedBytecode.object,
                "nonce": "0x1",
                "storage": {
                    "0x0000000000000000000000000000000000000000000000000000000000000000": "0x000000000000000000000000" + ownerAddressNo0x
                }
            },
        },
        "baseFeePerGas": null,
        "blobGasUsed": null,
        "coinbase": "0x0000000000000000000000000000000000000000",
        "config": {
            "berlinBlock": 0,
            "byzantiumBlock": 0,
            "chainId": chainID,
            "constantinopleBlock": 0,
            "eip150Block": 0,
            "eip155Block": 0,
            "eip158Block": 0,
            "feeConfig": {
                "baseFeeChangeDenominator": 36,
                "blockGasCostStep": 200000,
                "gasLimit": gasLimit,
                "maxBlockGasCost": 1000000,
                "minBaseFee": 25000000000,
                "minBlockGasCost": 0,
                "targetBlockRate": targetBlockRate,
                "targetGas": 60000000
            },
            "homesteadBlock": 0,
            "istanbulBlock": 0,
            "londonBlock": 0,
            "muirGlacierBlock": 0,
            "petersburgBlock": 0,
            "warpConfig": {
                "blockTimestamp": now,
                "quorumNumerator": precompileConfigs.warpMessenger.enabled ? precompileConfigs.warpMessenger.quorumNumerator : 67,
                "requirePrimaryNetworkSigners": precompileConfigs.warpMessenger.enabled ? precompileConfigs.warpMessenger.requirePrimaryNetworkSigners : true
            }
        },
        "difficulty": "0x0",
        "excessBlobGas": null,
        "extraData": "0x",
        "gasLimit": `0x${gasLimit.toString(16)}`,
        "gasUsed": "0x0",
        "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "nonce": "0x0",
        "number": "0x0",
        "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "timestamp": `0x${now.toString(16)}`
    } as (Record<string, unknown> & { alloc: Record<string, unknown>, config: Record<string, unknown> })

    // Add precompile configs if enabled
    if (precompileConfigs.contractDeployerAllowList.enabled) {
        genesis.config["contractDeployerAllowListConfig"] = {
            adminAddresses: precompileConfigs.contractDeployerAllowList.adminAddresses,
            blockTimestamp: 0,
            enabledAddresses: precompileConfigs.contractDeployerAllowList.enabledAddresses
        };
    }

    if (precompileConfigs.contractNativeMinter.enabled) {
        genesis.config["contractNativeMinterConfig"] = {
            adminAddresses: precompileConfigs.contractNativeMinter.adminAddresses,
            blockTimestamp: 0,
            enabledAddresses: precompileConfigs.contractNativeMinter.enabledAddresses
        };
    }

    if (precompileConfigs.txAllowList.enabled) {
        genesis.config["txAllowListConfig"] = {
            adminAddresses: precompileConfigs.txAllowList.adminAddresses,
            blockTimestamp: 0,
            enabledAddresses: precompileConfigs.txAllowList.enabledAddresses
        };
    }

    if (precompileConfigs.feeManager.enabled) {
        genesis.config["feeManagerConfig"] = {
            adminAddresses: precompileConfigs.feeManager.adminAddresses,
            blockTimestamp: 0
        };
    }

    if (precompileConfigs.rewardManager.enabled) {
        genesis.config["rewardManagerConfig"] = {
            adminAddresses: precompileConfigs.rewardManager.adminAddresses,
            blockTimestamp: 0
        };
    }

    //add some coins to the owner address
    genesis.alloc[ownerAddressNo0x] = {
        "balance": decimalToHex(ownerBalanceDecimal)
    }

    return JSON.stringify(genesis, null, 2)
}

import { useEffect, useState } from "react";
import { useCreateChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { CodeHighlighter } from "../../components/CodeHighlighter";
import { Container } from "../components/Container";
import { Input } from "../../components/Input";
import { Toggle } from "../../components/Toggle";
import { Textarea as TextArea } from "../../components/TextArea";
import { Button } from "../../components/Button";
import { Copy, Download, AlertCircle, Check } from "lucide-react";

type PrecompileCardProps = {
    title: string;
    address: string;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    children?: React.ReactNode;
};

const PrecompileCard = ({ title, address, enabled, onToggle, children }: PrecompileCardProps) => {
    return (
        <div className={`border rounded-md p-4 transition-colors ${enabled ? "border-green-300 bg-green-50/30 dark:bg-green-900/10 dark:border-green-700" : ""}`}>
            <div className="flex justify-between items-center">
                <div className="flex-1">
                    <div className="font-medium flex items-center">
                        {title}
                        {enabled && <Check className="ml-2 h-4 w-4 text-green-500" />}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-1">{address}</div>
                </div>

                <div className="flex items-center space-x-3">
                    <Toggle
                        label=""
                        checked={enabled}
                        onChange={onToggle}
                    />
                </div>
            </div>

            {children && enabled && (
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {children}
                </div>
            )}
        </div>
    );
};

// Helper function to convert decimal number to hex with 18 decimals of precision
const decimalToHex = (value: string): string => {
    try {
        // Parse the decimal value
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) return "0x0";

        // Convert to wei (multiply by 10^18)
        // Using BigInt to handle large numbers
        const weiValue = BigInt(Math.floor(numValue * 10 ** 18));

        // Convert to hex
        return "0x" + weiValue.toString(16);
    } catch (error) {
        console.error("Error converting to hex:", error);
        return "0x0";
    }
}

export default function GenesisBuilder() {
    const {
        evmChainId,
        setEvmChainId,
        genesisData,
        setGenesisData,
        gasLimit,
        setGasLimit,
        targetBlockRate,
        setTargetBlockRate
    } = useCreateChainStore()()
    const { walletEVMAddress } = useWalletStore()

    const [ownerAddress, setOwnerAddress] = useState<string>("")
    const [ownerBalanceDecimal, setOwnerBalanceDecimal] = useState<string>("1000000")
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("config");
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    // Precompile states
    const [contractDeployerAllowList, setContractDeployerAllowList] = useState({
        enabled: false,
        adminAddresses: [] as string[],
        enabledAddresses: [] as string[]
    })
    const [contractNativeMinter, setContractNativeMinter] = useState({
        enabled: false,
        adminAddresses: [] as string[],
        enabledAddresses: [] as string[]
    })
    const [txAllowList, setTxAllowList] = useState({
        enabled: false,
        adminAddresses: [] as string[],
        enabledAddresses: [] as string[]
    })
    const [feeManager, setFeeManager] = useState({
        enabled: false,
        adminAddresses: [] as string[]
    })
    const [rewardManager, setRewardManager] = useState({
        enabled: false,
        adminAddresses: [] as string[]
    })
    const [warpMessenger, setWarpMessenger] = useState({
        enabled: true,
        quorumNumerator: 67,
        requirePrimaryNetworkSigners: true
    })

    // Helper functions to handle address lists
    const parseAddressList = (input: string): string[] => {
        if (!input.trim()) return [];
        return input.split(',')
            .map(addr => addr.trim())
            .filter(addr => /^0x[a-fA-F0-9]{40}$/.test(addr));
        // Keep the 0x prefix for precompile addresses
    }

    const formatAddressList = (addresses: string[]): string => {
        return addresses.map(addr => addr.startsWith('0x') ? addr : `0x${addr}`).join(', ');
    }

    // Handle owner balance input change with proper validation
    const handleOwnerBalanceChange = (value: string) => {
        // Only allow numbers and decimal point
        if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
            setOwnerBalanceDecimal(value);
        }
    };

    useEffect(() => {
        if (ownerAddress) return
        setOwnerAddress(walletEVMAddress)
    }, [walletEVMAddress, ownerAddress])

    useEffect(() => {
        // Validate owner address
        if (ownerAddress && !/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
            setValidationErrors(prev => ({ ...prev, ownerAddress: "Invalid address format" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.ownerAddress;
                return newErrors;
            });
        }

        // Validate owner balance - now we only validate the decimal input
        if (ownerBalanceDecimal && isNaN(parseFloat(ownerBalanceDecimal))) {
            setValidationErrors(prev => ({ ...prev, ownerBalance: "Please enter a valid number" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.ownerBalance;
                return newErrors;
            });
        }

        // Validate chain ID
        if (evmChainId <= 0) {
            setValidationErrors(prev => ({ ...prev, chainId: "Chain ID must be positive" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.chainId;
                return newErrors;
            });
        }

        // Validate gas limit
        if (gasLimit <= 0) {
            setValidationErrors(prev => ({ ...prev, gasLimit: "Gas limit must be positive" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.gasLimit;
                return newErrors;
            });
        }

        // Validate block rate
        if (targetBlockRate <= 0) {
            setValidationErrors(prev => ({ ...prev, blockRate: "Block rate must be positive" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.blockRate;
                return newErrors;
            });
        }

        // Validate precompile address lists
        if (contractDeployerAllowList.enabled &&
            contractDeployerAllowList.adminAddresses.length === 0 &&
            contractDeployerAllowList.enabledAddresses.length === 0) {
            setValidationErrors(prev => ({
                ...prev,
                contractDeployerAllowList: "Contract Deployer Allow List: At least one admin or enabled address is required"
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.contractDeployerAllowList;
                return newErrors;
            });
        }

        if (contractNativeMinter.enabled &&
            contractNativeMinter.adminAddresses.length === 0 &&
            contractNativeMinter.enabledAddresses.length === 0) {
            setValidationErrors(prev => ({
                ...prev,
                contractNativeMinter: "Native Minter: At least one admin or enabled address is required"
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.contractNativeMinter;
                return newErrors;
            });
        }

        if (txAllowList.enabled &&
            txAllowList.adminAddresses.length === 0 &&
            txAllowList.enabledAddresses.length === 0) {
            setValidationErrors(prev => ({
                ...prev,
                txAllowList: "Transaction Allow List: At least one admin or enabled address is required"
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.txAllowList;
                return newErrors;
            });
        }

        if (feeManager.enabled && feeManager.adminAddresses.length === 0) {
            setValidationErrors(prev => ({
                ...prev,
                feeManager: "Fee Manager: At least one admin address is required"
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.feeManager;
                return newErrors;
            });
        }

        if (rewardManager.enabled && rewardManager.adminAddresses.length === 0) {
            setValidationErrors(prev => ({
                ...prev,
                rewardManager: "Reward Manager: At least one admin address is required"
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.rewardManager;
                return newErrors;
            });
        }
    }, [
        ownerAddress,
        evmChainId,
        gasLimit,
        targetBlockRate,
        ownerBalanceDecimal,
        contractDeployerAllowList,
        contractNativeMinter,
        txAllowList,
        feeManager,
        rewardManager
    ]);

    // Separate effect for generating genesis file to avoid unnecessary re-renders
    useEffect(() => {
        if (!ownerAddress || !evmChainId || Object.keys(validationErrors).length > 0) {
            setGenesisData("")
            return
        }

        try {
            setGenesisData(quickAndDirtyGenesisBuilder(
                ownerAddress,
                evmChainId,
                gasLimit,
                targetBlockRate,
                ownerBalanceDecimal,
                {
                    contractDeployerAllowList,
                    contractNativeMinter,
                    txAllowList,
                    feeManager,
                    rewardManager,
                    warpMessenger
                }
            ))
        } catch (error) {
            setGenesisData(error instanceof Error ? error.message : "Invalid owner address")
        }
    }, [
        ownerAddress,
        evmChainId,
        gasLimit,
        targetBlockRate,
        ownerBalanceDecimal,
        contractDeployerAllowList,
        contractNativeMinter,
        txAllowList,
        feeManager,
        rewardManager,
        warpMessenger,
        validationErrors
    ]);

    const handleCopyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(genesisData);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy genesis data:", err);
        }
    };

    const handleDownloadGenesis = () => {
        const blob = new Blob([genesisData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `genesis-${evmChainId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const isGenesisReady = genesisData && !genesisData.includes("Invalid") && Object.keys(validationErrors).length === 0;

    return (
        <Container
            title="Genesis Builder"
            description="Create a genesis file for your new blockchain."
        >
            <div className="space-y-6">
                {/* Tabs */}
                <div className="border-b">
                    <div className="flex -mb-px">
                        <button
                            onClick={() => setActiveTab("config")}
                            className={`py-2 px-4 font-medium ${activeTab === "config"
                                    ? "border-b-2 border-blue-500 text-blue-600"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            Configuration
                        </button>
                        {isGenesisReady && (
                            <button
                                onClick={() => setActiveTab("genesis")}
                                className={`py-2 px-4 font-medium ${activeTab === "genesis"
                                        ? "border-b-2 border-blue-500 text-blue-600"
                                        : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                Genesis JSON
                            </button>
                        )}
                    </div>
                </div>

                {activeTab === "config" && (
                    <>
                        {/* Basic Configuration */}
                        <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h3 className="text-lg font-medium mb-4">Basic Configuration</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Owner Address"
                                    value={ownerAddress}
                                    onChange={setOwnerAddress}
                                    placeholder="0x..."
                                    error={validationErrors.ownerAddress}
                                    helperText={validationErrors.ownerAddress ? undefined : "Address that will receive initial funds"}
                                />
                                <Input
                                    label="Owner Initial Balance"
                                    value={ownerBalanceDecimal}
                                    onChange={handleOwnerBalanceChange}
                                    placeholder="1000000"
                                    type="text"
                                    error={validationErrors.ownerBalance}
                                    helperText={validationErrors.ownerBalance ? undefined : `Tokens for initial balance (converted to wei automatically)`}
                                />
                                <Input
                                    label="Chain ID"
                                    value={evmChainId.toString()}
                                    onChange={(value) => setEvmChainId(Number(value))}
                                    placeholder="Enter chain ID"
                                    type="number"
                                    error={validationErrors.chainId}
                                    helperText={validationErrors.chainId ? undefined : "Unique identifier for your blockchain"}
                                />
                                <Input
                                    label="Gas Limit"
                                    value={gasLimit.toString()}
                                    onChange={(value) => setGasLimit(Number(value))}
                                    placeholder="Enter gas limit"
                                    type="number"
                                    error={validationErrors.gasLimit}
                                    helperText={validationErrors.gasLimit ? undefined : "Maximum gas allowed per block"}
                                />
                                <Input
                                    label="Target Block Rate (seconds)"
                                    value={targetBlockRate.toString()}
                                    onChange={(value) => setTargetBlockRate(Number(value))}
                                    placeholder="Enter target block rate"
                                    type="number"
                                    error={validationErrors.blockRate}
                                    helperText={validationErrors.blockRate ? undefined : "Target time between blocks in seconds"}
                                />
                            </div>
                        </div>

                        {/* Precompiles */}
                        <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h3 className="text-lg font-medium mb-4">Precompile Configuration</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Contract Deployer Allow List */}
                                <PrecompileCard
                                    title="Contract Deployer Allow List"
                                    address="0x0200000000000000000000000000000000000000"
                                    enabled={contractDeployerAllowList.enabled}
                                    onToggle={(enabled: boolean) =>
                                        setContractDeployerAllowList(prev => ({ ...prev, enabled }))
                                    }
                                >
                                    <div className="space-y-4">
                                        <TextArea
                                            label="Admin Addresses"
                                            value={formatAddressList(contractDeployerAllowList.adminAddresses)}
                                            onChange={(value: string) => setContractDeployerAllowList(prev => ({
                                                ...prev,
                                                adminAddresses: parseAddressList(value)
                                            }))}
                                            placeholder="0x1234..., 0x5678..."
                                            helperText="Comma-separated list of addresses that can manage the allow list"
                                            rows={2}
                                        />
                                        <TextArea
                                            label="Enabled Addresses"
                                            value={formatAddressList(contractDeployerAllowList.enabledAddresses)}
                                            onChange={(value: string) => setContractDeployerAllowList(prev => ({
                                                ...prev,
                                                enabledAddresses: parseAddressList(value)
                                            }))}
                                            placeholder="0x1234..., 0x5678..."
                                            helperText="Comma-separated list of addresses that can deploy contracts"
                                            rows={2}
                                        />
                                    </div>
                                </PrecompileCard>

                                {/* Contract Native Minter */}
                                <PrecompileCard
                                    title="Native Minter"
                                    address="0x0200000000000000000000000000000000000001"
                                    enabled={contractNativeMinter.enabled}
                                    onToggle={(enabled: boolean) =>
                                        setContractNativeMinter(prev => ({ ...prev, enabled }))
                                    }
                                >
                                    <div className="space-y-4">
                                        <TextArea
                                            label="Admin Addresses"
                                            value={formatAddressList(contractNativeMinter.adminAddresses)}
                                            onChange={(value: string) => setContractNativeMinter(prev => ({
                                                ...prev,
                                                adminAddresses: parseAddressList(value)
                                            }))}
                                            placeholder="0x1234..., 0x5678..."
                                            helperText="Comma-separated list of addresses that can manage the native minter"
                                            rows={2}
                                        />
                                        <TextArea
                                            label="Enabled Addresses"
                                            value={formatAddressList(contractNativeMinter.enabledAddresses)}
                                            onChange={(value: string) => setContractNativeMinter(prev => ({
                                                ...prev,
                                                enabledAddresses: parseAddressList(value)
                                            }))}
                                            placeholder="0x1234..., 0x5678..."
                                            helperText="Comma-separated list of addresses that can mint native tokens"
                                            rows={2}
                                        />
                                    </div>
                                </PrecompileCard>

                                {/* Transaction Allow List */}
                                <PrecompileCard
                                    title="Transaction Allow List"
                                    address="0x0200000000000000000000000000000000000002"
                                    enabled={txAllowList.enabled}
                                    onToggle={(enabled: boolean) =>
                                        setTxAllowList(prev => ({ ...prev, enabled }))
                                    }
                                >
                                    <div className="space-y-4">
                                        <TextArea
                                            label="Admin Addresses"
                                            value={formatAddressList(txAllowList.adminAddresses)}
                                            onChange={(value: string) => setTxAllowList(prev => ({
                                                ...prev,
                                                adminAddresses: parseAddressList(value)
                                            }))}
                                            placeholder="0x1234..., 0x5678..."
                                            helperText="Comma-separated list of addresses that can manage the allow list"
                                            rows={2}
                                        />
                                        <TextArea
                                            label="Enabled Addresses"
                                            value={formatAddressList(txAllowList.enabledAddresses)}
                                            onChange={(value: string) => setTxAllowList(prev => ({
                                                ...prev,
                                                enabledAddresses: parseAddressList(value)
                                            }))}
                                            placeholder="0x1234..., 0x5678..."
                                            helperText="Comma-separated list of addresses that can submit transactions"
                                            rows={2}
                                        />
                                    </div>
                                </PrecompileCard>

                                {/* Fee Manager */}
                                <PrecompileCard
                                    title="Fee Manager"
                                    address="0x0200000000000000000000000000000000000003"
                                    enabled={feeManager.enabled}
                                    onToggle={(enabled: boolean) =>
                                        setFeeManager(prev => ({ ...prev, enabled }))
                                    }
                                >
                                    <TextArea
                                        label="Admin Addresses"
                                        value={formatAddressList(feeManager.adminAddresses)}
                                        onChange={(value: string) => setFeeManager(prev => ({
                                            ...prev,
                                            adminAddresses: parseAddressList(value)
                                        }))}
                                        placeholder="0x1234..., 0x5678..."
                                        helperText="Comma-separated list of addresses that can manage fees"
                                        rows={2}
                                    />
                                </PrecompileCard>

                                {/* Reward Manager */}
                                <PrecompileCard
                                    title="Reward Manager"
                                    address="0x0200000000000000000000000000000000000004"
                                    enabled={rewardManager.enabled}
                                    onToggle={(enabled: boolean) =>
                                        setRewardManager(prev => ({ ...prev, enabled }))
                                    }
                                >
                                    <TextArea
                                        label="Admin Addresses"
                                        value={formatAddressList(rewardManager.adminAddresses)}
                                        onChange={(value: string) => setRewardManager(prev => ({
                                            ...prev,
                                            adminAddresses: parseAddressList(value)
                                        }))}
                                        placeholder="0x1234..., 0x5678..."
                                        helperText="Comma-separated list of addresses that can manage rewards"
                                        rows={2}
                                    />
                                </PrecompileCard>

                                {/* Warp Messenger */}
                                <PrecompileCard
                                    title="Warp Messenger"
                                    address="0x0200000000000000000000000000000000000005"
                                    enabled={warpMessenger.enabled}
                                    onToggle={(enabled: boolean) =>
                                        setWarpMessenger(prev => ({ ...prev, enabled }))
                                    }
                                >
                                    <div className="space-y-4">
                                        <Input
                                            label="Quorum Numerator"
                                            value={warpMessenger.quorumNumerator.toString()}
                                            onChange={(value: string) => setWarpMessenger(prev => ({
                                                ...prev,
                                                quorumNumerator: Number(value)
                                            }))}
                                            placeholder="67"
                                            type="number"
                                            helperText="Quorum numerator for warp messaging (denominator is 100)"
                                        />
                                        <div className="flex items-center">
                                            <Toggle
                                                label="Require Primary Network Signers"
                                                checked={warpMessenger.requirePrimaryNetworkSigners}
                                                onChange={(checked: boolean) => setWarpMessenger(prev => ({
                                                    ...prev,
                                                    requirePrimaryNetworkSigners: checked
                                                }))}
                                            />
                                        </div>
                                    </div>
                                </PrecompileCard>
                            </div>
                        </div>

                        {/* Validation and actions */}
                        <div className="mt-8">
                            {Object.keys(validationErrors).length > 0 ? (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-4 rounded-md flex items-start mb-4">
                                    <AlertCircle className="text-red-500 mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-red-800 dark:text-red-300">Please fix the following errors:</h4>
                                        <ul className="mt-2 list-disc list-inside text-sm text-red-700 dark:text-red-400">
                                            {Object.entries(validationErrors).map(([key, message]) => (
                                                <li key={key}>{message}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : isGenesisReady ? (
                                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 p-4 rounded-md flex items-center mb-4">
                                    <Check className="text-green-500 mr-3 h-5 w-5" />
                                    <span className="text-green-800 dark:text-green-300">Genesis configuration is valid and ready to use!</span>
                                </div>
                            ) : null}

                            {isGenesisReady && (
                                <div className="flex justify-center">
                                    <Button
                                        onClick={() => setActiveTab("genesis")}
                                        variant="primary"
                                        className="mt-2"
                                    >
                                        View Genesis JSON
                                    </Button>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === "genesis" && isGenesisReady && (
                    <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium">Genesis JSON</h3>
                            <div className="flex space-x-2">
                                <Button
                                    onClick={handleCopyToClipboard}
                                    variant="secondary"
                                    className="flex items-center"
                                >
                                    <Copy className="h-4 w-4 mr-1" />
                                    {copied ? "Copied!" : "Copy"}
                                </Button>
                                <Button
                                    onClick={handleDownloadGenesis}
                                    variant="secondary"
                                    className="flex items-center"
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                </Button>
                            </div>
                        </div>

                        <div className="border rounded-md overflow-hidden bg-white dark:bg-gray-900">
                            <CodeHighlighter
                                code={genesisData}
                                lang="json"
                            />
                        </div>

                        <div className="mt-4 flex justify-center">
                            <Button
                                onClick={() => setActiveTab("config")}
                                variant="secondary"
                            >
                                Back to Configuration
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Container>
    )
}
