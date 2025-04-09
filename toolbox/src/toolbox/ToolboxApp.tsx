"use client";

import { Button } from "../components/Button";
import { ErrorBoundary } from "react-error-boundary";
import { useToolboxStore } from '../toolbox/toolboxStore';
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect, ReactElement, lazy, Suspense } from "react";
import { GithubLink } from "./components/GithubLink";
import { ConnectWallet } from "../components/ConnectWallet";
import { ErrorFallback } from "../components/ErrorFallback";

type ComponentType = {
    id: string;
    label: string;
    component: React.LazyExoticComponent<(props?: any) => ReactElement>;
    fileNames: string[];
    skipWalletConnection?: boolean;
}

const componentGroups: Record<string, ComponentType[]> = {
    "Wallet": [
        {
            id: 'switchChain',
            label: "Switch Chain",
            component: lazy(() => import('./Wallet/SwitchChain')),
            fileNames: ["toolbox/src/toolbox/Wallet/SwitchChain.tsx"]
        },
        {
            id: 'addL1s',
            label: "Add L1s",
            component: lazy(() => import('./Wallet/AddL1s')),
            fileNames: []
        },
        {
            id: 'crossChainTransfer',
            label: "Cross Chain Transfer",
            component: lazy(() => import('./Wallet/CrossChainTransfer')),
            fileNames: ["toolbox/src/toolbox/Wallet/CrossChainTransfer.tsx"]
        },
        {
            id: 'balanceTopup',
            label: "Validator Balance Topup",
            component: lazy(() => import('./ValidatorManager/BalanceTopup')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/BalanceTopup.tsx"]
        }
    ],
    'Conversion': [
        {
            id: 'formatConverter',
            label: "Format Converter",
            component: lazy(() => import('./Conversion/FormatConverter')),
            fileNames: [],
            skipWalletConnection: true,
        },
        {
            id: 'unitConverter',
            label: "Unit Converter",
            component: lazy(() => import('./Conversion/UnitConverter')),
            fileNames: [],
            skipWalletConnection: true,
        }
    ],
    'Create an L1': [
        {
            id: 'createSubnet',
            label: "Create Subnet",
            component: lazy(() => import('./L1/CreateSubnet')),
            fileNames: ["toolbox/src/toolbox/L1/CreateSubnet.tsx"]
        },
        {
            id: 'createChain',
            label: "Create Chain",
            component: lazy(() => import('./L1/CreateChain')),
            fileNames: ["toolbox/src/toolbox/L1/CreateChain.tsx"]
        },
        {
            id: 'convertToL1',
            label: "Convert to L1",
            component: lazy(() => import('./L1/ConvertToL1')),
            fileNames: ["toolbox/src/toolbox/L1/ConvertToL1.tsx"]
        },
        {
            id: 'collectConversionSignatures',
            label: "Collect conversion signatures",
            component: lazy(() => import('./L1/CollectConversionSignatures')),
            fileNames: ["toolbox/src/toolbox/L1/CollectConversionSignatures.tsx", "toolbox/src/toolbox/L1/convertWarp.ts"]
        },
        {
            id: 'genesisBuilder',
            label: "Genesis Builder",
            component: lazy(() => import('./L1/GenesisBuilder')),
            fileNames: ["toolbox/src/toolbox/L1/GenesisBuilder.tsx"]
        }
    ],
    "Deploy ValidatorManager": [
        {
            id: "deployValidatorMessages",
            label: "Validator Messages Library",
            component: lazy(() => import('./ValidatorManager/DeployValidatorMessages')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/DeployValidatorMessages.tsx"]
        },
        {
            id: "deployValidatorManager",
            label: "Deploy Validator Manager",
            component: lazy(() => import('./ValidatorManager/DeployValidatorManager')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/DeployValidatorManager.tsx"]
        },
        {
            id: "upgradeProxy",
            label: "Upgrade Proxy",
            component: lazy(() => import('./ValidatorManager/UpgradeProxy')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/UpgradeProxy.tsx"]
        },
        {
            id: "readContract",
            label: "Read Contract",
            component: lazy(() => import('./ValidatorManager/ReadContract')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/ReadContract.tsx"]
        }
    ],
    "Initialize ValidatorManager": [
        {
            id: "initialize",
            label: "Initialize",
            component: lazy(() => import('./InitializePoA/Initialize')),
            fileNames: ["toolbox/src/toolbox/InitializePoA/Initialize.tsx"]
        },
        {
            id: "initValidatorSet",
            label: "Initialize Validator Set",
            component: lazy(() => import('./InitializePoA/InitValidatorSet')),
            fileNames: ["toolbox/src/toolbox/InitializePoA/InitValidatorSet.tsx"]
        }
    ],

    "ValidatorManager Functions": [
        {
            id: "addValidator",
            label: "Add Validator",
            component: lazy(() => import('./ValidatorManager/AddValidator')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/AddValidator.tsx"]
        },
        {
            id: "removeValidator",
            label: "Remove Validator",
            component: lazy(() => import('./ValidatorManager/RemoveValidator')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/RemoveValidator.tsx"]
        },
        {
            id: "changeWeight",
            label: "Change Weight",
            component: lazy(() => import('./ValidatorManager/ChangeWeight')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/ChangeWeight.tsx"]
        }
    ],
    "Deploy StakingManager": [
        {
            id: "deployRewardCalculator",
            label: "Deploy Reward Calculator",
            component: lazy(() => import('./StakingManager/DeployRewardCalculator')),
            fileNames: ["toolbox/src/toolbox/StakingManager/DeployRewardCalculator.tsx"]
        },
        {
            id: "deployStakingManager",
            label: "Deploy Staking Manager",
            component: lazy(() => import('./StakingManager/DeployStakingManager')),
            fileNames: ["toolbox/src/toolbox/StakingManager/DeployStakingManager.tsx"]
        },
        {
            id: "transferOwnership",
            label: "Transfer Ownership",
            component: lazy(() => import('./StakingManager/TransferOwnership')),
            fileNames: ["toolbox/src/toolbox/StakingManager/TransferOwnership.tsx"]
        },
        {
            id: "initializeStakingManager",
            label: "Initialize Staking Manager",
            component: lazy(() => import('./StakingManager/Initialize')),
            fileNames: ["toolbox/src/toolbox/StakingManager/Initialize.tsx"]
        },
    ],
    "Nodes": [
        {
            id: "rpcMethodsCheck",
            label: "RPC Methods Check",
            component: lazy(() => import('./Nodes/RPCMethodsCheck')),
            fileNames: ["toolbox/src/toolbox/Nodes/RPCMethodsCheck.tsx"],
            skipWalletConnection: true,
        },
        {
            id: "avalanchegoDocker",
            label: "Avalanchego in Docker",
            component: lazy(() => import('./Nodes/AvalanchegoDocker')),
            fileNames: ["toolbox/src/toolbox/Nodes/AvalanchegoDocker.tsx"],
            skipWalletConnection: true,
        },
        {
            id: "performanceMonitor",
            label: "Performance Monitor",
            component: lazy(() => import('./Nodes/PerformanceMonitor')),
            fileNames: ["toolbox/src/toolbox/Nodes/PerformanceMonitor.tsx"],
            skipWalletConnection: true,
        }
    ],
    "ICM": [
        {
            id: "teleporterMessenger",
            label: "Teleporter Messenger",
            component: lazy(() => import('./ICM/TeleporterMessenger')),
            fileNames: ["toolbox/src/toolbox/ICM/TeleporterMessenger.tsx"]
        },
        {
            id: "teleporterRegistry",
            label: "Teleporter Registry",
            component: lazy(() => import('./ICM/TeleporterRegistry')),
            fileNames: ["toolbox/src/toolbox/ICM/TeleporterRegistry.tsx"]
        },
        {
            id: "icmRelayer",
            label: "ICM Relayer",
            component: lazy(() => import('./ICM/ICMRelayer')),
            fileNames: ["toolbox/src/toolbox/ICM/ICMRelayer.tsx"]
        },
        {
            id: "deployICMDemo",
            label: "Deploy ICM Demo",
            component: lazy(() => import('./ICM/DeployICMDemo')),
            fileNames: [
                "toolbox/src/toolbox/ICM/DeployICMDemo.tsx",
                "toolbox/contracts/example-contracts/contracts/ICMDemo.sol",
            ]
        },
        {
            id: "sendICMMessage",
            label: "Send ICM Message",
            component: lazy(() => import('./ICM/SendICMMessage')),
            fileNames: [
                "toolbox/src/toolbox/ICM/SendICMMessage.tsx",
                "toolbox/contracts/example-contracts/contracts/senderOnCChain.sol",
            ]
        },
    ],
    "ICTT": [
        {
            id: "deployExampleERC20",
            label: "Example ERC20",
            component: lazy(() => import('./ICTT/DeployExampleERC20')),
            fileNames: ["toolbox/src/toolbox/ICTT/DeployExampleERC20.tsx"]
        },
        {
            id: "deployERC20TokenHome",
            label: "ERC20 Token Home",
            component: lazy(() => import('./ICTT/DeployERC20TokenHome')),
            fileNames: ["toolbox/src/toolbox/ICTT/DeployERC20TokenHome.tsx"]
        },
        {
            id: "deployERC20TokenRemote",
            label: "ERC20 Token Remote",
            component: lazy(() => import('./ICTT/DeployERC20TokenRemote')),
            fileNames: ["toolbox/src/toolbox/ICTT/DeployERC20TokenRemote.tsx"]
        },
        {
            id: "registerWithHome",
            label: "Register with Home",
            component: lazy(() => import('./ICTT/RegisterWithHome')),
            fileNames: ["toolbox/src/toolbox/ICTT/RegisterWithHome.tsx"]
        }
    ]
};

// Loading component for Suspense
const ComponentLoader = () => (
    <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
);

export default function ToolboxApp() {
    const defaultTool = Object.values(componentGroups).flat()[0].id;

    // Use state from URL hash. Default to first tool if hash is empty.
    const [selectedTool, setSelectedTool] = useState(
        window.location.hash ? window.location.hash.substring(1) : defaultTool
    );

    // State to track expanded/collapsed groups
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
        Object.keys(componentGroups).reduce((acc, key) => ({ ...acc, [key]: false }), {})
    );

    // Toggle group expansion
    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => ({ 
            ...prev, 
            [groupName]: !prev[groupName] 
        }));
    };

    // Listen for URL hash changes (e.g. back/forward navigation)
    useEffect(() => {
        const handleHashChange = () => {
            setSelectedTool(window.location.hash ? window.location.hash.substring(1) : defaultTool);
        };
        window.addEventListener("hashchange", handleHashChange);
        return () => window.removeEventListener("hashchange", handleHashChange);
    }, []);

    const handleComponentClick = (toolId: string) => {
        // Update the URL hash
        window.location.hash = toolId;
        // Optionally update local state immediately
        setSelectedTool(toolId);
    };

    const renderSelectedComponent = () => {
        const allComponents = Object.values(componentGroups).flat();
        const comp = allComponents.find(c => c.id === selectedTool);
        if (!comp) {
            return <div>Component not found</div>;
        }

        const Component = comp.component;

        return (
            <ErrorBoundary
                FallbackComponent={ErrorFallback}
                onReset={() => {
                    window.location.reload();
                }}
            >
                <ConnectWallet required={!comp.skipWalletConnection}>
                    <div className="space-y-4">
                        <Suspense fallback={<ComponentLoader />}>
                            <Component />
                        </Suspense>
                    </div>
                    <div className="mt-4 space-y-1 border-t pt-3">
                        {comp.fileNames.map((fileName, index) => (
                            <GithubLink
                                key={index}
                                user="ava-labs"
                                repo="builders-hub"
                                branch={import.meta.env?.VITE_GIT_BRANCH_NAME || "master"}
                                filePath={fileName}
                            />
                        ))}
                    </div>
                </ConnectWallet>
            </ErrorBoundary>
        );
    };

    return (
        <div className="container mx-auto flex flex-col md:flex-row">
            <div className="w-64 flex-shrink-0 p-6">
                <ul className="space-y-6">
                    {Object.entries(componentGroups).map(([groupName, components]) => (
                        <li key={groupName}>
                            <div
                                onClick={() => toggleGroup(groupName)}
                                className="flex items-center justify-between mb-2 p-2 rounded-md cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">{groupName}</h3>
                                {expandedGroups[groupName]
                                    ? <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                                    : <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                                }
                            </div>
                            {expandedGroups[groupName] && (
                                <ul className="space-y-1 pl-2 border-l border-gray-200 dark:border-gray-700 ml-2">
                                    {components.map(({ id, label }) => (
                                        <li key={id}>
                                            <a
                                                href={`#${id}`}
                                                onClick={() => handleComponentClick(id)}
                                                className={`block cursor-pointer w-full text-left px-3 py-1.5 text-sm rounded-md transition-all ${selectedTool === id
                                                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-medium'
                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                                                    }`}
                                            >
                                                {label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
                <div className="mt-8 border-t pt-6 dark:border-gray-700">
                    <Button
                        onClick={() => {
                            if (window.confirm("Are you sure you want to reset the state?")) {
                                useToolboxStore.getState().reset();
                            }
                        }}
                        className="w-full"
                        variant="secondary"
                        icon={<RefreshCw className="w-4 h-4 mr-2" />}
                    >
                        Reset State
                    </Button>
                </div>
            </div>
            <div className="flex-1 p-6 min-w-0">
                {renderSelectedComponent()}
            </div>
        </div>
    );
}

