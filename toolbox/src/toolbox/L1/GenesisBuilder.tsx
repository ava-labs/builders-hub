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
import { Textarea as TextArea } from "../../components/TextArea";
import { Button } from "../../components/Button";
import { Copy, Download, AlertCircle, Check, ChevronDown, ChevronUp, Info } from "lucide-react";

type PrecompileCardProps = {
    title: string;
    address: string;
    enabled: boolean;
    children?: React.ReactNode;
};

const PrecompileCard = ({ title, address, enabled, children }: PrecompileCardProps) => {
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

type SectionId = 'chainParams' | 'tokenomics' | 'permissions' | 'transactionFees' | 'warpMessenger';

type GenesisBuilderProps = {
    expandedSections?: SectionId[];
};

const ALL_SECTIONS: SectionId[] = ['chainParams', 'tokenomics', 'permissions', 'transactionFees', 'warpMessenger'];

export default function GenesisBuilder({ expandedSections }: GenesisBuilderProps = { expandedSections: ALL_SECTIONS }) {
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

    // Helper function to convert gwei to wei
    const gweiToWei = (gwei: number): number => gwei * 1000000000;

    const [ownerAddress, setOwnerAddress] = useState<string>("")
    const [ownerBalanceDecimal, setOwnerBalanceDecimal] = useState<string>("1000000")
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("config");
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
    const [validationWarnings, setValidationWarnings] = useState<{ [key: string]: string }>({});

    // Fee Config Parameters
    const [baseFeeChangeDenominator, setBaseFeeChangeDenominator] = useState<number>(48);
    const [blockGasCostStep, setBlockGasCostStep] = useState<number>(200000);
    const [maxBlockGasCost, setMaxBlockGasCost] = useState<number>(1000000);
    const [minBaseFee, setMinBaseFee] = useState<number>(25000000000);
    const [minBlockGasCost, setMinBlockGasCost] = useState<number>(0);
    const [targetGas, setTargetGas] = useState<number>(15000000);

    // Track which sections are expanded
    const [expandedSectionState, setExpandedSectionState] = useState<Set<SectionId>>(
        new Set(expandedSections || ALL_SECTIONS)
    );

    // Toggle section expanded state
    const toggleSection = (sectionId: SectionId) => {
        setExpandedSectionState(prev => {
            const newState = new Set(prev);
            if (newState.has(sectionId)) {
                newState.delete(sectionId);
            } else {
                newState.add(sectionId);
            }
            return newState;
        });
    };

    // Check if a section is expanded
    const isSectionExpanded = (sectionId: SectionId) => expandedSectionState.has(sectionId);

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
    const [warpMessenger, _] = useState({
        enabled: true,
        quorumNumerator: 67,
        requirePrimaryNetworkSigners: true
    })

    // Helper functions to handle address lists
    const parseAddressList = (input: string): string[] => {
        // Trim input and handle empty case
        const trimmedInput = input.trim();
        if (!trimmedInput) return [];
        
        // Check if input is a single address without commas
        if (!trimmedInput.includes(',')) {
            // Clean up any possible whitespace
            const singleAddress = trimmedInput.trim();
            if (/^0x[a-fA-F0-9]{40}$/i.test(singleAddress)) {
                console.log("Detected single valid address:", singleAddress);
                return [singleAddress];
            } else {
                console.log("Single address invalid format:", singleAddress);
            }
        }
        
        // Handle multiple addresses
        const addresses = trimmedInput.split(',')
            .map(addr => addr.trim())
            .filter(addr => {
                const isValid = /^0x[a-fA-F0-9]{40}$/i.test(addr);
                if (!isValid) console.log("Invalid address format:", addr);
                return isValid;
            });
        
        console.log("Parsed addresses:", addresses);
        return addresses;
    }

    const formatAddressList = (addresses: string[]): string => {
        return addresses.map(addr => addr.startsWith('0x') ? addr : `0x${addr}`).join(', ');
    }

    // Handle owner balance input change with proper validation
    const handleOwnerBalanceChange = (value: string) => {
        // Only allow numbers and decimal point
        if (value === "" || /^[0-9]+\.?[0-9]*$/.test(value)) {
            setOwnerBalanceDecimal(value);
        }
    };

    // Only allow numbers handler
    const handleNumberInput = (value: string, setter: (value: number) => void, min: number = 0) => {
        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue >= min) {
            setter(numValue);
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
            
            // Warning if outside 15M-30M
            if (gasLimit < 15000000 || gasLimit > 30000000) {
                setValidationWarnings(prev => ({ 
                    ...prev, 
                    gasLimit: `Recommended gas limit is between 15M and 30M for optimal performance` 
                }));
            } else {
                setValidationWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.gasLimit;
                    return newWarnings;
                });
            }
        }

        // Validate block rate
        if (targetBlockRate <= 0) {
            setValidationErrors(prev => ({ ...prev, blockRate: "Block rate must be positive" }));
        } else if (targetBlockRate > 120) {
            setValidationErrors(prev => ({ ...prev, blockRate: "Block rate must not exceed 120 seconds" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.blockRate;
                return newErrors;
            });
            
            // Warning if > 10
            if (targetBlockRate > 10) {
                setValidationWarnings(prev => ({ 
                    ...prev, 
                    blockRate: "Block rates above 10 seconds may impact user experience" 
                }));
            } else {
                setValidationWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.blockRate;
                    return newWarnings;
                });
            }
        }

        // Validate precompile address lists
        if (contractDeployerAllowList.enabled && 
            contractDeployerAllowList.adminAddresses.length === 0) {
            setValidationErrors(prev => ({
                ...prev,
                contractDeployerAllowList: "Contract Deployer Allow List: Admin addresses are required"
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.contractDeployerAllowList;
                return newErrors;
            });
        }

        if (contractNativeMinter.enabled && 
            contractNativeMinter.adminAddresses.length === 0) {
            setValidationErrors(prev => ({
                ...prev,
                contractNativeMinter: "Native Minter: Admin addresses are required"
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.contractNativeMinter;
                return newErrors;
            });
        }

        if (txAllowList.enabled && 
            txAllowList.adminAddresses.length === 0) {
            setValidationErrors(prev => ({
                ...prev,
                txAllowList: "Transaction Allow List: Admin addresses are required"
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
                feeManager: "Fee Manager: Admin addresses are required"
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
                rewardManager: "Reward Manager: Admin addresses are required"
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.rewardManager;
                return newErrors;
            });
        }

        // Validate fee config parameters
        
        // Gas Limit - Must be between 8M and 100M
        if (gasLimit < 8000000 || gasLimit > 100000000) {
            setValidationErrors(prev => ({ ...prev, gasLimit: `Gas limit must be between 8M and 100M` }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.gasLimit;
                return newErrors;
            });
            
            // Warning if outside 15M-30M
            if (gasLimit < 15000000 || gasLimit > 30000000) {
                setValidationWarnings(prev => ({ 
                    ...prev, 
                    gasLimit: `Recommended gas limit is between 15M and 30M for optimal performance` 
                }));
            } else {
                setValidationWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.gasLimit;
                    return newWarnings;
                });
            }
        }

        // Target Block Rate - Must be between 1 and 30, error if 0 or > 120
        if (targetBlockRate <= 0 || targetBlockRate > 120) {
            setValidationErrors(prev => ({ 
                ...prev, 
                blockRate: targetBlockRate <= 0 
                    ? "Block rate must be positive" 
                    : "Block rate must not exceed 120 seconds" 
            }));
        } else if (targetBlockRate > 30) {
            setValidationErrors(prev => ({ 
                ...prev, 
                blockRate: "Block rate must not exceed 30 seconds for optimal network performance" 
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.blockRate;
                return newErrors;
            });
            
            // Warning if > 10
            if (targetBlockRate > 10) {
                setValidationWarnings(prev => ({ 
                    ...prev, 
                    blockRate: "Block rates above 10 seconds may impact user experience" 
                }));
            } else {
                setValidationWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.blockRate;
                    return newWarnings;
                });
            }
        }

        // Min Base Fee - Must be >= 1 gwei
        if (minBaseFee < gweiToWei(1)) {
            setValidationErrors(prev => ({ ...prev, minBaseFee: "Min base fee must be at least 1 gwei" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.minBaseFee;
                return newErrors;
            });
            
            // Warning if < 25 gwei or > 500 gwei
            if (minBaseFee < gweiToWei(25) || minBaseFee > gweiToWei(500)) {
                setValidationWarnings(prev => ({ 
                    ...prev, 
                    minBaseFee: minBaseFee < gweiToWei(25) 
                        ? "Min base fee below 25 gwei is not recommended for proper spam protection" 
                        : "Min base fee above 500 gwei may be prohibitively expensive"
                }));
            } else {
                setValidationWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.minBaseFee;
                    return newWarnings;
                });
            }
        }

        // Target Gas - Must be between 500K and 200M
        if (targetGas < 500000 || targetGas > 200000000) {
            setValidationErrors(prev => ({ 
                ...prev, 
                targetGas: `Target gas must be between 500K and 200M` 
            }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.targetGas;
                return newErrors;
            });
            
            // Warning if < 5M or > 50M
            if (targetGas < 5000000 || targetGas > 50000000) {
                setValidationWarnings(prev => ({ 
                    ...prev, 
                    targetGas: targetGas < 5000000
                        ? "Target gas below 5M may lead to network congestion"
                        : "Target gas above 50M may require significant validator resources"
                }));
            } else {
                setValidationWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.targetGas;
                    return newWarnings;
                });
            }
        }

        // Base Fee Change Denominator - Must be >= 2
        if (baseFeeChangeDenominator < 2) {
            setValidationErrors(prev => ({ ...prev, baseFeeChangeDenominator: "Base fee change denominator must be at least 2" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.baseFeeChangeDenominator;
                return newErrors;
            });
            
            // Warning if < 8 or > 1000
            if (baseFeeChangeDenominator < 8 || baseFeeChangeDenominator > 1000) {
                setValidationWarnings(prev => ({ 
                    ...prev, 
                    baseFeeChangeDenominator: baseFeeChangeDenominator < 8
                        ? "Low values may cause fees to change too rapidly"
                        : "High values may cause fees to react too slowly to network conditions"
                }));
            } else {
                setValidationWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.baseFeeChangeDenominator;
                    return newWarnings;
                });
            }
        }

        // Min Block Gas Cost - Must be >= 0
        if (minBlockGasCost < 0) {
            setValidationErrors(prev => ({ ...prev, minBlockGasCost: "Min block gas cost must be non-negative" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.minBlockGasCost;
                return newErrors;
            });
            
            // Warning if > 1e9
            if (minBlockGasCost > 1000000000) {
                setValidationWarnings(prev => ({ 
                    ...prev, 
                    minBlockGasCost: "Min block gas cost above 1B may impact network performance"
                }));
            } else {
                setValidationWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.minBlockGasCost;
                    return newWarnings;
                });
            }
        }

        // Max Block Gas Cost - Must be >= minBlockGasCost
        if (maxBlockGasCost < minBlockGasCost) {
            setValidationErrors(prev => ({ ...prev, maxBlockGasCost: "Max block gas cost must be greater than or equal to min block gas cost" }));
        } else {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.maxBlockGasCost;
                return newErrors;
            });
            
            // Warning if > 1e10
            if (maxBlockGasCost > 10000000000) {
                setValidationWarnings(prev => ({ 
                    ...prev, 
                    maxBlockGasCost: "Max block gas cost above 10B may impact network performance"
                }));
            } else {
                setValidationWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.maxBlockGasCost;
                    return newWarnings;
                });
            }
        }

        // Block Gas Cost Step - Warning if > 5_000_000
        if (blockGasCostStep > 5000000) {
            setValidationWarnings(prev => ({ 
                ...prev, 
                blockGasCostStep: "Block gas cost step above 5M may cause fees to change too rapidly"
            }));
        } else {
            setValidationWarnings(prev => {
                const newWarnings = { ...prev };
                delete newWarnings.blockGasCostStep;
                return newWarnings;
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
        rewardManager,
        baseFeeChangeDenominator,
        blockGasCostStep,
        maxBlockGasCost,
        minBaseFee,
        minBlockGasCost,
        targetGas
    ]);

    // Separate effect for generating genesis file to avoid unnecessary re-renders
    useEffect(() => {
        console.log("Genesis data generation check:");
        console.log("- Owner address:", ownerAddress);
        console.log("- Chain ID:", evmChainId);
        console.log("- Validation errors:", Object.keys(validationErrors));
        
        // For precompiles, log their status
        if (contractDeployerAllowList.enabled) {
            console.log("- Contract Deployer Allow List admin addresses:", contractDeployerAllowList.adminAddresses);
        }
        if (contractNativeMinter.enabled) {
            console.log("- Contract Native Minter admin addresses:", contractNativeMinter.adminAddresses);
        }
        if (txAllowList.enabled) {
            console.log("- TX Allow List admin addresses:", txAllowList.adminAddresses);
        }
        if (feeManager.enabled) {
            console.log("- Fee Manager admin addresses:", feeManager.adminAddresses);
        }
        if (rewardManager.enabled) {
            console.log("- Reward Manager admin addresses:", rewardManager.adminAddresses);
        }

        if (!ownerAddress || !evmChainId || Object.keys(validationErrors).length > 0) {
            console.log("Genesis data cannot be generated yet");
            setGenesisData("")
            return
        }

        try {
            console.log("Generating genesis data...");
            const updatedGenesis = quickAndDirtyGenesisBuilder(
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
            );
            
            // Update the feeConfig parameters in the genesis data
            const genesisObj = JSON.parse(updatedGenesis);
            if (genesisObj.config && genesisObj.config.feeConfig) {
                genesisObj.config.feeConfig = {
                    ...genesisObj.config.feeConfig,
                    baseFeeChangeDenominator,
                    blockGasCostStep,
                    maxBlockGasCost,
                    minBaseFee,
                    minBlockGasCost,
                    targetGas
                };
            }
            
            const finalGenesis = JSON.stringify(genesisObj, null, 2);
            console.log("Genesis data generated successfully");
            setGenesisData(finalGenesis);
        } catch (error) {
            console.error("Error generating genesis data:", error);
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
        baseFeeChangeDenominator,
        blockGasCostStep,
        maxBlockGasCost,
        minBaseFee,
        minBlockGasCost,
        targetGas,
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
                        <button
                            onClick={() => setActiveTab("precompiles")}
                            className={`py-2 px-4 font-medium ${activeTab === "precompiles"
                                    ? "border-b-2 border-blue-500 text-blue-600"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            Precompile Info
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
                    <div className="space-y-6">
                        {/* Chain Parameters */}
                        <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden">
                            <div 
                                className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer" 
                                onClick={() => toggleSection('chainParams')}
                            >
                                <div>
                                    <h3 className="text-lg font-medium">Chain Parameters</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Enter the basic parameters of your L1, such as the EVM chain ID.
                                    </p>
                                </div>
                                <div>
                                    {isSectionExpanded('chainParams') ? 
                                        <ChevronUp className="h-5 w-5 text-gray-500" /> : 
                                        <ChevronDown className="h-5 w-5 text-gray-500" />
                                    }
                                </div>
                            </div>
                            {isSectionExpanded('chainParams') && (
                                <div className="p-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="EVM Chain ID"
                                            value={evmChainId.toString()}
                                            onChange={(value) => setEvmChainId(Number(value))}
                                            placeholder="Enter chain ID"
                                            type="number"
                                            error={validationErrors.chainId}
                                            helperText={validationErrors.chainId ? undefined : "Unique identifier for your blockchain"}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tokenomics */}
                        <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden">
                            <div 
                                className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer" 
                                onClick={() => toggleSection('tokenomics')}
                            >
                                <div>
                                    <h3 className="text-lg font-medium">Tokenomics</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Configure the native token and its initial allocation.
                                    </p>
                                </div>
                                <div>
                                    {isSectionExpanded('tokenomics') ? 
                                        <ChevronUp className="h-5 w-5 text-gray-500" /> : 
                                        <ChevronDown className="h-5 w-5 text-gray-500" />
                                    }
                                </div>
                            </div>
                            {isSectionExpanded('tokenomics') && (
                                <div className="p-5 space-y-6">
                                    {/* Native Token Section */}
                                    <div>
                                        <h4 className="font-medium mb-3">Native Token</h4>
                                        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-md mb-4">
                                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                                Currently, only creating your own native token is supported. Support for USDC, AVAX, and other tokens is coming soon.
                                            </p>
                                        </div>
                                        <div className="space-y-4">
                                            <Input
                                                label="Token Symbol"
                                                value=""
                                                onChange={() => {}}
                                                placeholder="e.g., AAA, TEST"
                                                disabled
                                                helperText="Coming soon: The symbol (ticker) of your blockchain's native token"
                                            />
                                        </div>
                                    </div>

                                    {/* Initial Allocation */}
                                    <div>
                                        <h4 className="font-medium mb-3">Initial Allocation</h4>
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
                                                label="Initial Balance"
                                                value={ownerBalanceDecimal}
                                                onChange={handleOwnerBalanceChange}
                                                placeholder="1000000"
                                                type="text"
                                                error={validationErrors.ownerBalance}
                                                helperText={validationErrors.ownerBalance ? undefined : `Tokens for initial balance (converted to wei automatically)`}
                                            />
                                        </div>
                                    </div>

                                    {/* Minting Rights */}
                                    <div>
                                        <h4 className="font-medium mb-3">Minting Rights of Native Token</h4>
                                        <div className="space-y-4">
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="fixed-supply" 
                                                        name="minting-rights"
                                                        className="mt-1 mr-2"
                                                        checked={!contractNativeMinter.enabled}
                                                        onChange={() => setContractNativeMinter(prev => ({...prev, enabled: false}))}
                                                    />
                                                    <label htmlFor="fixed-supply" className="cursor-pointer">
                                                        <div className="font-medium">I want to have a fixed supply of tokens on my blockchain.</div>
                                                    </label>
                                                </div>
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="mintable" 
                                                        name="minting-rights"
                                                        className="mt-1 mr-2"
                                                        checked={contractNativeMinter.enabled}
                                                        onChange={() => setContractNativeMinter(prev => ({...prev, enabled: true}))}
                                                    />
                                                    <label htmlFor="mintable" className="cursor-pointer">
                                                        <div className="font-medium">I want to be able to mint additional tokens (recommended for production).</div>
                                                    </label>
                                                </div>
                                            </div>

                                            {contractNativeMinter.enabled && (
                                                <div className="pl-6 space-y-4 mt-2">
                                                    <TextArea
                                                        label="Admin Addresses (Required)"
                                                        value={formatAddressList(contractNativeMinter.adminAddresses)}
                                                        onChange={(value: string) => setContractNativeMinter(prev => ({
                                                            ...prev,
                                                            adminAddresses: parseAddressList(value)
                                                        }))}
                                                        placeholder="0x1234..., 0x5678..."
                                                        helperText="Comma-separated list of addresses that can manage the native minter"
                                                        rows={2}
                                                        error={contractNativeMinter.enabled && contractNativeMinter.adminAddresses.length === 0 ? 
                                                            "Admin addresses are required for this precompile" : undefined}
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
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Permissions */}
                        <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden">
                            <div 
                                className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer" 
                                onClick={() => toggleSection('permissions')}
                            >
                                <div>
                                    <h3 className="text-lg font-medium">Permissions</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Configure access controls for your blockchain.
                                    </p>
                                </div>
                                <div>
                                    {isSectionExpanded('permissions') ? 
                                        <ChevronUp className="h-5 w-5 text-gray-500" /> : 
                                        <ChevronDown className="h-5 w-5 text-gray-500" />
                                    }
                                </div>
                            </div>
                            {isSectionExpanded('permissions') && (
                                <div className="p-5 space-y-6">
                                    {/* Contract Deployer Allowlist */}
                                    <div>
                                        <h4 className="font-medium mb-3">Contract Deployer Allowlist</h4>
                                        <div className="space-y-4">
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="open-deployer" 
                                                        name="contract-deployer"
                                                        className="mt-1 mr-2"
                                                        checked={!contractDeployerAllowList.enabled}
                                                        onChange={() => setContractDeployerAllowList(prev => ({...prev, enabled: false}))}
                                                    />
                                                    <label htmlFor="open-deployer" className="cursor-pointer">
                                                        <div className="font-medium">I want anyone to be able to deploy contracts on this blockchain.</div>
                                                    </label>
                                                </div>
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="restricted-deployer" 
                                                        name="contract-deployer"
                                                        className="mt-1 mr-2"
                                                        checked={contractDeployerAllowList.enabled}
                                                        onChange={() => setContractDeployerAllowList(prev => ({...prev, enabled: true}))}
                                                    />
                                                    <label htmlFor="restricted-deployer" className="cursor-pointer">
                                                        <div className="font-medium">I want only approved addresses to be able to deploy contracts on this blockchain.</div>
                                                    </label>
                                                </div>
                                            </div>

                                            {contractDeployerAllowList.enabled && (
                                                <div className="pl-6 space-y-4 mt-2">
                                                    <TextArea
                                                        label="Admin Addresses (Required)"
                                                        value={formatAddressList(contractDeployerAllowList.adminAddresses)}
                                                        onChange={(value: string) => setContractDeployerAllowList(prev => ({
                                                            ...prev,
                                                            adminAddresses: parseAddressList(value)
                                                        }))}
                                                        placeholder="0x1234..., 0x5678..."
                                                        helperText="Comma-separated list of addresses that can manage the allow list"
                                                        rows={2}
                                                        error={contractDeployerAllowList.enabled && contractDeployerAllowList.adminAddresses.length === 0 ? 
                                                            "Admin addresses are required for this precompile" : undefined}
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
                                            )}
                                        </div>
                                    </div>

                                    {/* Transaction Allowlist */}
                                    <div>
                                        <h4 className="font-medium mb-3">Transaction Allowlist</h4>
                                        <div className="space-y-4">
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="open-tx" 
                                                        name="tx-allowlist"
                                                        className="mt-1 mr-2"
                                                        checked={!txAllowList.enabled}
                                                        onChange={() => setTxAllowList(prev => ({...prev, enabled: false}))}
                                                    />
                                                    <label htmlFor="open-tx" className="cursor-pointer">
                                                        <div className="font-medium">I want anyone to be able to submit transactions on this blockchain.</div>
                                                    </label>
                                                </div>
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="restricted-tx" 
                                                        name="tx-allowlist"
                                                        className="mt-1 mr-2"
                                                        checked={txAllowList.enabled}
                                                        onChange={() => setTxAllowList(prev => ({...prev, enabled: true}))}
                                                    />
                                                    <label htmlFor="restricted-tx" className="cursor-pointer">
                                                        <div className="font-medium">I want only approved addresses to be able to submit transactions on this blockchain.</div>
                                                    </label>
                                                </div>
                                            </div>

                                            {txAllowList.enabled && (
                                                <div className="pl-6 space-y-4 mt-2">
                                                    <TextArea
                                                        label="Admin Addresses (Required)"
                                                        value={formatAddressList(txAllowList.adminAddresses)}
                                                        onChange={(value: string) => setTxAllowList(prev => ({
                                                            ...prev,
                                                            adminAddresses: parseAddressList(value)
                                                        }))}
                                                        placeholder="0x1234..., 0x5678..."
                                                        helperText="Comma-separated list of addresses that can manage the allow list"
                                                        rows={2}
                                                        error={txAllowList.enabled && txAllowList.adminAddresses.length === 0 ? 
                                                            "Admin addresses are required for this precompile" : undefined}
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
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Transaction Fees */}
                        <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden">
                            <div 
                                className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer" 
                                onClick={() => toggleSection('transactionFees')}
                            >
                                <div>
                                    <h3 className="text-lg font-medium">Transaction Fees</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Configure how transaction fees are determined and managed.
                                    </p>
                                </div>
                                <div>
                                    {isSectionExpanded('transactionFees') ? 
                                        <ChevronUp className="h-5 w-5 text-gray-500" /> : 
                                        <ChevronDown className="h-5 w-5 text-gray-500" />
                                    }
                                </div>
                            </div>
                            
                            {isSectionExpanded('transactionFees') && (
                                <div className="p-5 space-y-6">
                                    {/* Fee Configuration Parameters */}
                                    <div>
                                        <h4 className="font-medium mb-3">Fee Configuration Parameters</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Input
                                                    label="Gas Limit"
                                                    value={gasLimit.toString()}
                                                    onChange={(value) => setGasLimit(Number(value))}
                                                    placeholder="15000000"
                                                    type="number"
                                                    error={validationErrors.gasLimit}
                                                    helperText={validationErrors.gasLimit ? undefined : "Maximum gas allowed per block (8M-100M, recommended 15M-30M)"}
                                                />
                                                {validationWarnings.gasLimit && !validationErrors.gasLimit && (
                                                    <div className="text-amber-500 text-sm mt-1">
                                                        ⚠️ {validationWarnings.gasLimit}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <Input
                                                    label="Target Block Rate (seconds)"
                                                    value={targetBlockRate.toString()}
                                                    onChange={(value) => setTargetBlockRate(Number(value))}
                                                    placeholder="2"
                                                    type="number"
                                                    error={validationErrors.blockRate}
                                                    helperText={validationErrors.blockRate ? undefined : "Target time between blocks (1-30 seconds, recommended ≤10)"}
                                                />
                                                {validationWarnings.blockRate && !validationErrors.blockRate && (
                                                    <div className="text-amber-500 text-sm mt-1">
                                                        ⚠️ {validationWarnings.blockRate}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <Input
                                                    label="Min Base Fee (gwei)"
                                                    value={(minBaseFee / 1000000000).toString()}
                                                    onChange={(value) => {
                                                        // Allow empty field
                                                        if (value === '') {
                                                            setMinBaseFee(0);
                                                            return;
                                                        }
                                                        
                                                        // Allow decimal inputs
                                                        if (value === '.') {
                                                            setMinBaseFee(0);
                                                            return;
                                                        }
                                                        
                                                        const gweiValue = parseFloat(value);
                                                        if (!isNaN(gweiValue)) {
                                                            setMinBaseFee(gweiToWei(gweiValue));
                                                        }
                                                    }}
                                                    placeholder="25"
                                                    type="number"
                                                    error={validationErrors.minBaseFee}
                                                    helperText={validationErrors.minBaseFee ? undefined : "Minimum base fee in gwei (≥1 gwei, recommended ≥25 gwei)"}
                                                />
                                                {validationWarnings.minBaseFee && !validationErrors.minBaseFee && (
                                                    <div className="text-amber-500 text-sm mt-1">
                                                        ⚠️ {validationWarnings.minBaseFee}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <Input
                                                    label="Base Fee Change Denominator"
                                                    value={baseFeeChangeDenominator.toString()}
                                                    onChange={(value) => handleNumberInput(value, setBaseFeeChangeDenominator, 2)}
                                                    placeholder="48"
                                                    type="number"
                                                    error={validationErrors.baseFeeChangeDenominator}
                                                    helperText={validationErrors.baseFeeChangeDenominator ? undefined : "Controls fee adjustment rate (≥2, typical value is 48)"}
                                                />
                                                {validationWarnings.baseFeeChangeDenominator && !validationErrors.baseFeeChangeDenominator && (
                                                    <div className="text-amber-500 text-sm mt-1">
                                                        ⚠️ {validationWarnings.baseFeeChangeDenominator}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <Input
                                                    label="Min Block Gas Cost"
                                                    value={minBlockGasCost.toString()}
                                                    onChange={(value) => handleNumberInput(value, setMinBlockGasCost, 0)}
                                                    placeholder="0"
                                                    type="number"
                                                    error={validationErrors.minBlockGasCost}
                                                    helperText={validationErrors.minBlockGasCost ? undefined : "Minimum block gas cost (≥0)"}
                                                />
                                                {validationWarnings.minBlockGasCost && !validationErrors.minBlockGasCost && (
                                                    <div className="text-amber-500 text-sm mt-1">
                                                        ⚠️ {validationWarnings.minBlockGasCost}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <Input
                                                    label="Max Block Gas Cost"
                                                    value={maxBlockGasCost.toString()}
                                                    onChange={(value) => handleNumberInput(value, setMaxBlockGasCost)}
                                                    placeholder="1000000"
                                                    type="number"
                                                    error={validationErrors.maxBlockGasCost}
                                                    helperText={validationErrors.maxBlockGasCost ? undefined : "Maximum block gas cost (≥Min Block Gas Cost)"}
                                                />
                                                {validationWarnings.maxBlockGasCost && !validationErrors.maxBlockGasCost && (
                                                    <div className="text-amber-500 text-sm mt-1">
                                                        ⚠️ {validationWarnings.maxBlockGasCost}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <Input
                                                    label="Block Gas Cost Step"
                                                    value={blockGasCostStep.toString()}
                                                    onChange={(value) => handleNumberInput(value, setBlockGasCostStep)}
                                                    placeholder="200000"
                                                    type="number"
                                                    error={validationErrors.blockGasCostStep}
                                                    helperText={validationErrors.blockGasCostStep ? undefined : "Step size for block gas cost changes"}
                                                />
                                                {validationWarnings.blockGasCostStep && !validationErrors.blockGasCostStep && (
                                                    <div className="text-amber-500 text-sm mt-1">
                                                        ⚠️ {validationWarnings.blockGasCostStep}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <Input
                                                    label="Target Gas"
                                                    value={targetGas.toString()}
                                                    onChange={(value) => handleNumberInput(value, setTargetGas)}
                                                    placeholder="15000000"
                                                    type="number"
                                                    error={validationErrors.targetGas}
                                                    helperText={validationErrors.targetGas ? undefined : "Target gas per block (500K-200M, recommended 5M-50M)"}
                                                />
                                                {validationWarnings.targetGas && !validationErrors.targetGas && (
                                                    <div className="text-amber-500 text-sm mt-1">
                                                        ⚠️ {validationWarnings.targetGas}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-4 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-md flex items-center">
                                            <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                                These parameters control how transaction fees are calculated and adjusted over time. Adjust with caution as they impact network economics.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Fee Manager */}
                                    <div>
                                        <h4 className="font-medium mb-3">Dynamically Adjust Transaction Fees</h4>
                                        <div className="space-y-4">
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="static-fees" 
                                                        name="fee-manager"
                                                        className="mt-1 mr-2"
                                                        checked={!feeManager.enabled}
                                                        onChange={() => setFeeManager(prev => ({...prev, enabled: false}))}
                                                    />
                                                    <label htmlFor="static-fees" className="cursor-pointer">
                                                        <div className="font-medium">I want transaction fee parameters to be fixed (requires hard fork to change).</div>
                                                    </label>
                                                </div>
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="dynamic-fees" 
                                                        name="fee-manager"
                                                        className="mt-1 mr-2"
                                                        checked={feeManager.enabled}
                                                        onChange={() => setFeeManager(prev => ({...prev, enabled: true}))}
                                                    />
                                                    <label htmlFor="dynamic-fees" className="cursor-pointer">
                                                        <div className="font-medium">I want to be able to dynamically adjust transaction fee parameters.</div>
                                                    </label>
                                                </div>
                                            </div>

                                            {feeManager.enabled && (
                                                <div className="pl-6 space-y-4 mt-2">
                                                    <TextArea
                                                        label="Admin Addresses (Required)"
                                                        value={formatAddressList(feeManager.adminAddresses)}
                                                        onChange={(value: string) => setFeeManager(prev => ({
                                                            ...prev,
                                                            adminAddresses: parseAddressList(value)
                                                        }))}
                                                        placeholder="0x1234..., 0x5678..."
                                                        helperText="Comma-separated list of addresses that can manage fees"
                                                        rows={2}
                                                        error={feeManager.enabled && feeManager.adminAddresses.length === 0 ? 
                                                            "Admin addresses are required for this precompile" : undefined}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reward Manager */}
                                    <div>
                                        <h4 className="font-medium mb-3">Dynamically Adjust Validation Rewards</h4>
                                        <div className="space-y-4">
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="static-rewards" 
                                                        name="reward-manager"
                                                        className="mt-1 mr-2"
                                                        checked={!rewardManager.enabled}
                                                        onChange={() => setRewardManager(prev => ({...prev, enabled: false}))}
                                                    />
                                                    <label htmlFor="static-rewards" className="cursor-pointer">
                                                        <div className="font-medium">I want validation reward parameters to be fixed.</div>
                                                    </label>
                                                </div>
                                                <div className="flex items-start">
                                                    <input 
                                                        type="radio" 
                                                        id="dynamic-rewards" 
                                                        name="reward-manager"
                                                        className="mt-1 mr-2"
                                                        checked={rewardManager.enabled}
                                                        onChange={() => setRewardManager(prev => ({...prev, enabled: true}))}
                                                    />
                                                    <label htmlFor="dynamic-rewards" className="cursor-pointer">
                                                        <div className="font-medium">I want to be able to dynamically adjust validation reward parameters.</div>
                                                    </label>
                                                </div>
                                            </div>

                                            {rewardManager.enabled && (
                                                <div className="pl-6 space-y-4 mt-2">
                                                    <TextArea
                                                        label="Admin Addresses (Required)"
                                                        value={formatAddressList(rewardManager.adminAddresses)}
                                                        onChange={(value: string) => setRewardManager(prev => ({
                                                            ...prev,
                                                            adminAddresses: parseAddressList(value)
                                                        }))}
                                                        placeholder="0x1234..., 0x5678..."
                                                        helperText="Comma-separated list of addresses that can manage rewards"
                                                        rows={2}
                                                        error={rewardManager.enabled && rewardManager.adminAddresses.length === 0 ? 
                                                            "Admin addresses are required for this precompile" : undefined}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Validation and actions */}
                        <div>
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
                                <div className="flex justify-center space-x-4">
                                    <Button
                                        onClick={() => setActiveTab("precompiles")}
                                        variant="secondary"
                                        className="mt-2"
                                    >
                                        View Precompile Info
                                    </Button>
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
                    </div>
                )}

                {activeTab === "precompiles" && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden p-5">
                            <h3 className="text-lg font-medium mb-4">Precompile Info</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                Review the precompiles that will be enabled on your blockchain. To change these settings, go back to the Configuration tab.
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Contract Deployer Allow List */}
                                <PrecompileCard
                                    title="Contract Deployer Allow List"
                                    address="0x0200000000000000000000000000000000000000"
                                    enabled={contractDeployerAllowList.enabled}
                                >
                                    {contractDeployerAllowList.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <div className="font-medium text-sm">Admin Addresses (Required):</div>
                                                <div className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-400 break-all">
                                                    {contractDeployerAllowList.adminAddresses.length > 0 
                                                        ? formatAddressList(contractDeployerAllowList.adminAddresses) 
                                                        : <span className="text-red-500">Required - please add admin addresses</span>}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">Enabled Addresses:</div>
                                                <div className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-400 break-all">
                                                    {contractDeployerAllowList.enabledAddresses.length > 0 
                                                        ? formatAddressList(contractDeployerAllowList.enabledAddresses) 
                                                        : "None specified (optional)"}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </PrecompileCard>

                                {/* Contract Native Minter */}
                                <PrecompileCard
                                    title="Native Minter"
                                    address="0x0200000000000000000000000000000000000001"
                                    enabled={contractNativeMinter.enabled}
                                >
                                    {contractNativeMinter.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <div className="font-medium text-sm">Admin Addresses (Required):</div>
                                                <div className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-400 break-all">
                                                    {contractNativeMinter.adminAddresses.length > 0 
                                                        ? formatAddressList(contractNativeMinter.adminAddresses) 
                                                        : <span className="text-red-500">Required - please add admin addresses</span>}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">Enabled Addresses:</div>
                                                <div className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-400 break-all">
                                                    {contractNativeMinter.enabledAddresses.length > 0 
                                                        ? formatAddressList(contractNativeMinter.enabledAddresses) 
                                                        : "None specified (optional)"}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </PrecompileCard>

                                {/* Transaction Allow List */}
                                <PrecompileCard
                                    title="Transaction Allow List"
                                    address="0x0200000000000000000000000000000000000002"
                                    enabled={txAllowList.enabled}
                                >
                                    {txAllowList.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <div className="font-medium text-sm">Admin Addresses (Required):</div>
                                                <div className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-400 break-all">
                                                    {txAllowList.adminAddresses.length > 0 
                                                        ? formatAddressList(txAllowList.adminAddresses) 
                                                        : <span className="text-red-500">Required - please add admin addresses</span>}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">Enabled Addresses:</div>
                                                <div className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-400 break-all">
                                                    {txAllowList.enabledAddresses.length > 0 
                                                        ? formatAddressList(txAllowList.enabledAddresses) 
                                                        : "None specified (optional)"}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </PrecompileCard>

                                {/* Fee Manager */}
                                <PrecompileCard
                                    title="Fee Manager"
                                    address="0x0200000000000000000000000000000000000003"
                                    enabled={feeManager.enabled}
                                >
                                    {feeManager.enabled && (
                                        <div>
                                            <div className="font-medium text-sm">Admin Addresses (Required):</div>
                                            <div className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-400 break-all">
                                                {feeManager.adminAddresses.length > 0 
                                                    ? formatAddressList(feeManager.adminAddresses) 
                                                    : <span className="text-red-500">Required - please add admin addresses</span>}
                                            </div>
                                        </div>
                                    )}
                                </PrecompileCard>

                                {/* Reward Manager */}
                                <PrecompileCard
                                    title="Reward Manager"
                                    address="0x0200000000000000000000000000000000000004"
                                    enabled={rewardManager.enabled}
                                >
                                    {rewardManager.enabled && (
                                        <div>
                                            <div className="font-medium text-sm">Admin Addresses (Required):</div>
                                            <div className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-400 break-all">
                                                {rewardManager.adminAddresses.length > 0 
                                                    ? formatAddressList(rewardManager.adminAddresses) 
                                                    : <span className="text-red-500">Required - please add admin addresses</span>}
                                            </div>
                                        </div>
                                    )}
                                </PrecompileCard>

                                {/* Warp Messenger */}
                                <PrecompileCard
                                    title="Warp Messenger"
                                    address="0x0200000000000000000000000000000000000005"
                                    enabled={warpMessenger.enabled}
                                >
                                    <div className="space-y-4">
                                        <div>
                                            <div className="font-medium text-sm">Quorum Numerator:</div>
                                            <div className="text-sm mt-1">{warpMessenger.quorumNumerator}</div>
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm">Require Primary Network Signers:</div>
                                            <div className="text-sm mt-1">{warpMessenger.requirePrimaryNetworkSigners ? "Yes" : "No"}</div>
                                        </div>
                                    </div>
                                </PrecompileCard>
                            </div>
                        </div>

                        <div className="flex justify-center space-x-4">
                            <Button
                                onClick={() => setActiveTab("config")}
                                variant="secondary"
                                className="mt-2"
                            >
                                Back to Configuration
                            </Button>
                            {isGenesisReady && (
                                <Button
                                    onClick={() => setActiveTab("genesis")}
                                    variant="primary"
                                    className="mt-2"
                                >
                                    View Genesis JSON
                                </Button>
                            )}
                        </div>
                    </div>
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

                        <div className="mt-4 flex justify-center space-x-4">
                            <Button
                                onClick={() => setActiveTab("config")}
                                variant="secondary"
                            >
                                Back to Configuration
                            </Button>
                            <Button
                                onClick={() => setActiveTab("precompiles")}
                                variant="secondary"
                            >
                                View Precompile Info
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Container>
    )
}
