import { Button } from "../components/Button";
import { ErrorBoundary } from "react-error-boundary";
import { useToolboxStore } from '../stores/toolboxStore';
import { RefreshCw } from 'lucide-react';
import { useState, useEffect, ReactElement, lazy, Suspense } from "react";
import { GithubLink } from "../components/GithubLink";
import { ConnectWallet } from "../components/ConnectWallet";

type ComponentType = {
    id: string;
    label: string;
    component: React.LazyExoticComponent<() => ReactElement>;
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
            id: "receiverOnSubnet",
            label: "ReceiverOnSubnet",
            component: lazy(() => import('./ICM/ReceiverOnSubnet')),
            fileNames: [
                "toolbox/src/toolbox/ICM/ReceiverOnSubnet.tsx",
                "toolbox/contracts/example-contracts/contracts/receiverOnSubnet.sol",
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
        }
    ]
};

const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => {
    return (
        <div className="space-y-2">
            <div className="text-red-500 text-sm">
                {error.message}
            </div>
            {
                error.message.includes("The error is mostly returned when the client requests") && (
                    <div className="text-sm text-red-500">
                        ^ This usually indicates that the core wallet is not in testnet mode. Open settings &gt; Advanced &gt; Testnet mode.
                    </div>
                )
            }
            <Button onClick={resetErrorBoundary}>
                Try Again
            </Button>
        </div>
    );
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
                            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3">{groupName}</h3>
                            <ul className="space-y-1">
                                {components.map(({ id, label }) => (
                                    <li key={id}>
                                        <a
                                            href={`#${id}`}
                                            onClick={() => handleComponentClick(id)}
                                            className={`block cursor-pointer w-full text-left px-3 py-2 text-sm rounded-md transition-all ${selectedTool === id
                                                ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium'
                                                : ' dark: hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                        >
                                            {label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
                <div className="mt-6">
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

