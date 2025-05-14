"use client";

import { Button } from "../components/Button";
import { ErrorBoundary } from "react-error-boundary";
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect, ReactElement, lazy, Suspense } from "react";
import { GithubLink } from "../components/GithubLink";
import { ErrorFallback } from "../components/ErrorFallback";
import { ErrorBoundaryWithWarning } from "../components/ErrorBoundaryWithWarning";
import { OptionalConnectWallet, type WalletMode } from "../components/ConnectWallet/ConnectWallet";

import "../main.css";
import { resetAllStores } from "../stores/reset";

type ComponentType = {
  id: string;
  label: string;
  component: React.LazyExoticComponent<(props?: any) => ReactElement | null>;
  fileNames: string[];
  walletMode: WalletMode;
}

type ComponentGroupType = {
  academy?: {
    text: string;
    link: string;
  },
  components: ComponentType[]
}

const componentGroups: Record<string, ComponentGroupType> = {
  'Create an L1': {
    academy: {
      text: "Learn about creating an L1",
      link: "https://build.avax.network/academy/avalanche-fundamentals"
    },
    components: [
      {
        id: 'createSubnet',
        label: "Create Subnet",
        component: lazy(() => import('./L1/CreateSubnet')),
        fileNames: ["toolbox/src/toolbox/L1/CreateSubnet.tsx"],
        walletMode: "c-chain"
      },
      {
        id: 'createChain',
        label: "Create Chain",
        component: lazy(() => import('./L1/CreateChain')),
        fileNames: ["toolbox/src/toolbox/L1/CreateChain.tsx"],
        walletMode: "c-chain"
      },
      {
        id: 'convertToL1',
        label: "Convert Subnet to L1",
        component: lazy(() => import('./L1/ConvertToL1')),
        fileNames: ["toolbox/src/toolbox/L1/ConvertToL1.tsx"],
        walletMode: "c-chain"
      },
      {
        id: 'collectConversionSignatures',
        label: "Collect conversion signatures",
        component: lazy(() => import('./L1/CollectConversionSignatures')),
        fileNames: ["toolbox/src/toolbox/L1/CollectConversionSignatures.tsx", "toolbox/src/toolbox/L1/convertWarp.ts"],
        walletMode: "optional"
      },
      {
        id: 'queryL1Details',
        label: "Query L1 Details",
        component: lazy(() => import('./L1/QueryL1Details')),
        fileNames: ["toolbox/src/toolbox/L1/QueryL1Details.tsx"],
        walletMode: "c-chain"
      }
    ]
  },
  "Nodes": {
    components: [
      {
        id: "avalanchegoDocker",
        label: "Node Setup with Docker",
        component: lazy(() => import('./Nodes/AvalanchegoDocker')),
        fileNames: ["toolbox/src/toolbox/Nodes/AvalanchegoDocker.tsx"],
        walletMode: "optional",
      },
      {
        id: 'balanceTopup',
        label: "L1 Validator Balance Topup",
        component: lazy(() => import('./Nodes/BalanceTopup')),
        fileNames: ["toolbox/src/toolbox/Nodes/BalanceTopup.tsx"],
        walletMode: "c-chain"
      },
      {
        id: "rpcMethodsCheck",
        label: "RPC Methods Check",
        component: lazy(() => import('./Nodes/RPCMethodsCheck')),
        fileNames: ["toolbox/src/toolbox/Nodes/RPCMethodsCheck.tsx"],
        walletMode: "optional",
      },
      {
        id: "performanceMonitor",
        label: "Performance Monitor",
        component: lazy(() => import('./Nodes/PerformanceMonitor')),
        fileNames: ["toolbox/src/toolbox/Nodes/PerformanceMonitor.tsx"],
        walletMode: "optional",
      }
    ]
  },
  "Validator Manager Setup": {
    academy: {
      text: "Learn about managing the validator set of an L1",
      link: "https://build.avax.network/academy/l1-validator-management"
    },
    components: [
      {
        id: "deployValidatorManager",
        label: "Deploy Validator Manager Contract",
        component: lazy(() => import('./ValidatorManager/DeployValidatorManager')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/DeployValidatorManager.tsx"],
        walletMode: "l1"
      },
      {
        id: "initialize",
        label: "Set Initial Configuration",
        component: lazy(() => import('./ValidatorManager/Initialize')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/Initialize.tsx"],
        walletMode: "l1"
      },
      {
        id: "initValidatorSet",
        label: "Initialize Validator Set",
        component: lazy(() => import('./ValidatorManager/InitValidatorSet')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/InitValidatorSet.tsx"],
        walletMode: "l1"
      },
      {
        id: "readContract",
        label: "Read Validator Manager Contract",
        component: lazy(() => import('./ValidatorManager/ReadContract')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/ReadContract.tsx"],
        walletMode: "l1"
      },
    ]
  },
  "Validator Manager Operations": {
    components: [
      {
        id: "addValidator",
        label: "Add L1 Validator",
        component: lazy(() => import('./ValidatorManager/AddValidator')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/AddValidator.tsx"],
        walletMode: "l1"
      },
      {
        id: "removeValidator",
        label: "Remove L1 Validator",
        component: lazy(() => import('./ValidatorManager/RemoveValidator')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/RemoveValidator.tsx"],
        walletMode: "l1"
      },
      {
        id: "changeWeight",
        label: "Change L1 Validator Weight",
        component: lazy(() => import('./ValidatorManager/ChangeWeight')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/ChangeWeight.tsx"],
        walletMode: "l1"
      },
      {
        id: "queryL1ValidatorSet",
        label: "Query L1 Validator Set",
        component: lazy(() => import('./ValidatorManager/QueryL1ValidatorSet')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet.tsx"],
        walletMode: "optional"
      },
    ]
  },
  "Staking Manager Setup": {
    academy: {
      text: "Learn about setting up Proof-of-Stake for an L1",
      link: "https://build.avax.network/academy/l1-validator-management"
    },
    components: [
      {
        id: "deployRewardCalculator",
        label: "Deploy Reward Calculator",
        component: lazy(() => import('./StakingManager/DeployRewardCalculator')),
        fileNames: ["toolbox/src/toolbox/StakingManager/DeployRewardCalculator.tsx"],
        walletMode: "l1"
      },
      {
        id: "deployStakingManager",
        label: "Deploy Staking Manager",
        component: lazy(() => import('./StakingManager/DeployStakingManager')),
        fileNames: ["toolbox/src/toolbox/StakingManager/DeployStakingManager.tsx"],
        walletMode: "l1"
      },
      {
        id: "initializeStakingManager",
        label: "Set Initial Configuration",
        component: lazy(() => import('./StakingManager/Initialize')),
        fileNames: ["toolbox/src/toolbox/StakingManager/Initialize.tsx"],
        walletMode: "l1"
      },
      {
        id: "transferOwnership",
        label: "Transfer Validator Manager Ownership",
        component: lazy(() => import('./StakingManager/TransferOwnership')),
        fileNames: ["toolbox/src/toolbox/StakingManager/TransferOwnership.tsx"],
        walletMode: "l1"
      }
    ]
  },
  "Interchain Messaging (ICM)": {
    academy: {
      text: "Learn about cross-L1 interoperability using ICM",
      link: "https://build.avax.network/academy/interchain-messaging"
    },
    components: [
      {
        id: "teleporterMessenger",
        label: "Deploy Teleporter Messenger",
        component: lazy(() => import('./ICM/TeleporterMessenger')),
        fileNames: ["toolbox/src/toolbox/ICM/TeleporterMessenger.tsx"],
        walletMode: "l1"
      },
      {
        id: "teleporterRegistry",
        label: "Deploy Teleporter Registry",
        component: lazy(() => import('./ICM/TeleporterRegistry')),
        fileNames: ["toolbox/src/toolbox/ICM/TeleporterRegistry.tsx"],
        walletMode: "l1"
      },
      {
        id: "icmRelayer",
        label: "ICM Relayer Setup",
        component: lazy(() => import('./ICM/ICMRelayer')),
        fileNames: ["toolbox/src/toolbox/ICM/ICMRelayer.tsx"],
        walletMode: "l1"
      },
      {
        id: "deployICMDemo",
        label: "Deploy ICM Demo",
        component: lazy(() => import('./ICM/DeployICMDemo')),
        fileNames: [
          "toolbox/src/toolbox/ICM/DeployICMDemo.tsx",
          "toolbox/contracts/example-contracts/contracts/ICMDemo.sol",
        ],
        walletMode: "l1"
      },
      {
        id: "sendICMMessage",
        label: "Send ICM Message",
        component: lazy(() => import('./ICM/SendICMMessage')),
        fileNames: [
          "toolbox/src/toolbox/ICM/SendICMMessage.tsx",
          "toolbox/contracts/example-contracts/contracts/senderOnCChain.sol",
        ],
        walletMode: "l1"
      },
    ]
  },
  "Interchain Token Transfer (ICTT)": {
    academy: {
      text: "Learn about setting up bridges between L1s",
      link: "https://build.avax.network/academy/interchain-token-transfer"
    },
    components: [
      {
        id: "deployExampleERC20",
        label: "Deploy Example ERC20",
        component: lazy(() => import('./ICTT/DeployExampleERC20')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployExampleERC20.tsx"],
        walletMode: "l1"
      },
      {
        id: "deployERC20TokenHome",
        label: "Deploy ERC20 Token Home Contract",
        component: lazy(() => import('./ICTT/DeployERC20TokenHome')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployERC20TokenHome.tsx"],
        walletMode: "l1"
      },
      {
        id: "deployERC20TokenRemote",
        label: "Deploy ERC20 Token Remote Contract",
        component: lazy(() => import('./ICTT/DeployERC20TokenRemote')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployERC20TokenRemote.tsx"],
        walletMode: "l1"
      },
      {
        id: "deployNativeTokenRemote",
        label: "Deploy Native Token Remote Contract",
        component: lazy(() => import('./ICTT/DeployNativeTokenRemote')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployNativeTokenRemote.tsx"],
        walletMode: "l1"
      },
      {
        id: "registerWithHome",
        label: "Register Token Remote with Home",
        component: lazy(() => import('./ICTT/RegisterWithHome')),
        fileNames: ["toolbox/src/toolbox/ICTT/RegisterWithHome.tsx"],
        walletMode: "l1"
      },
      {
        id: "addCollateral",
        label: "Add Collateral",
        component: lazy(() => import('./ICTT/AddCollateral')),
        fileNames: ["toolbox/src/toolbox/ICTT/AddCollateral.tsx"],
        walletMode: "l1"
      },
      {
        id: "testSend",
        label: "Test Sending ERC20 Tokens",
        component: lazy(() => import('./ICTT/TestSend')),
        fileNames: ["toolbox/src/toolbox/ICTT/TestSend.tsx"],
        walletMode: "l1"
      }
    ]
  },
  "Proxy Utils": {
    components: [
      {
        id: "deployProxyContract",
        label: "Deploy Proxy Contract",
        component: lazy(() => import('./Proxy/DeployProxyContract')),
        fileNames: ["toolbox/src/toolbox/Proxy/DeployProxyContract.tsx"],
        walletMode: "l1"
      },
      {
        id: "upgradeProxy",
        label: "Upgrade Proxy Implementation",
        component: lazy(() => import('./Proxy/UpgradeProxy')),
        fileNames: ["toolbox/src/toolbox/Proxy/UpgradeProxy.tsx"],
        walletMode: "l1"
      }
    ]
  },
  "Precompiles": {
    academy: {
      text: "Learn about Subnet-EVM precompiled contracts",
      link: "https://build.avax.network/docs/virtual-machines/default-precompiles"
    },
    components: [
      {
        id: "deployerAllowlist",
        label: "Deployer Allowlist",
        component: lazy(() => import("./Precompiles/DeployerAllowlist")),
        fileNames: ["toolbox/src/toolbox/Precompiles/DeployerAllowlist.tsx"],
        walletMode: "l1",
      },
      {
        id: "nativeMinter",
        label: "Native Minter",
        component: lazy(() => import("./Precompiles/NativeMinter")),
        fileNames: ["toolbox/src/toolbox/Precompiles/NativeMinter.tsx"],
        walletMode: "l1",
      },
      {
        id: "transactionAllowlist",
        label: "Transaction Allowlist",
        component: lazy(() => import("./Precompiles/TransactionAllowlist")),
        fileNames: ["toolbox/src/toolbox/Precompiles/TransactionAllowlist.tsx"],
        walletMode: "l1",
      },
      {
        id: "feeManager",
        label: "Fee Manager",
        component: lazy(() => import("./Precompiles/FeeManager")),
        fileNames: ["toolbox/src/toolbox/Precompiles/FeeManager.tsx"],
        walletMode: "l1",
      },
      {
        id: "rewardManager",
        label: "Reward Manager",
        component: lazy(() => import("./Precompiles/RewardManager")),
        fileNames: ["toolbox/src/toolbox/Precompiles/RewardManager.tsx"],
        walletMode: "l1",
      },
      {
        id: "warpMessenger",
        label: "Warp Messenger",
        component: lazy(() => import("./Precompiles/WarpMessenger")),
        fileNames: ["toolbox/src/toolbox/Precompiles/WarpMessenger.tsx"],
        walletMode: "l1",
      }
    ]
  },
  'Conversion Utils': {
    components: [
      {
        id: 'formatConverter',
        label: "Format Converter",
        component: lazy(() => import('./Conversion/FormatConverter')),
        fileNames: [],
        walletMode: "optional",
      },
      {
        id: 'unitConverter',
        label: "AVAX Unit Converter",
        component: lazy(() => import('./Conversion/UnitConverter')),
        fileNames: [],
        walletMode: "optional",
      }
    ]
  },
};

// Loading component for Suspense
const ComponentLoader = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

export default function ToolboxApp() {
  const defaultTool = Object.values(componentGroups)[0].components[0].id;

  // Use state from URL hash. Default to first tool if hash is empty.
  const [selectedTool, setSelectedTool] = useState(
    window.location.hash ? window.location.hash.substring(1) : defaultTool
  );

  // Helper function to find which group contains a specific tool
  const findParentGroup = (toolId: string): string | null => {
    for (const [groupName, group] of Object.entries(componentGroups)) {
      if (group.components.some(component => component.id === toolId)) {
        return groupName;
      }
    }
    return null;
  };

  // Get initial tool from URL hash or default
  const initialTool = window.location.hash ? window.location.hash.substring(1) : defaultTool;
  const initialParentGroup = findParentGroup(initialTool);

  // State to track expanded/collapsed groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.keys(componentGroups).reduce((acc, key) => ({
      ...acc,
      [key]: key === initialParentGroup // Set parent group of selected tool to expanded
    }), {})
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
    const allComponents = Object.values(componentGroups).map(group => group.components).flat();
    allComponents.push({
      id: "dev",
      label: "Dev",
      component: lazy(() => import('./Dev')),
      fileNames: [],
      walletMode: "l1",
    });

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
        <ErrorBoundaryWithWarning>
          <OptionalConnectWallet walletMode={comp.walletMode}>
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
          </OptionalConnectWallet>
        </ErrorBoundaryWithWarning>
      </ErrorBoundary>
    );
  };

  return (
    <div className="container mx-auto flex flex-col md:flex-row">
      <div className="w-64 flex-shrink-0 p-6">
        <ul className="space-y-6">
          {Object.entries(componentGroups).map(([groupName, group]) => (
            <li key={groupName}>
              <div
                onClick={() => toggleGroup(groupName)}
                className="flex items-center justify-between p-2 rounded-md cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">{groupName}</h3>
                {expandedGroups[groupName]
                  ? <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                }
              </div>
              {expandedGroups[groupName] && (
                <>
                  {group.academy && (
                    <a href={group.academy.link} target="_blank" rel="noopener noreferrer">
                      <div className="mb-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <div className={`inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium transition-colors`}
                        >
                          <img src="/small-logo.png" alt="Avalanche" className="h-3 w-auto" />
                          <span>Avalanche Academy</span>
                        </div>
                        {group.academy.text}
                      </div>
                    </a>
                  )}
                  <ul className="space-y-1 mt-2 pl-2 border-l border-gray-200 dark:border-gray-700 ml-2">
                    {group.components.map(({ id, label }) => (
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
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-8 border-t pt-6 dark:border-gray-700">
          <Button
            onClick={() => {
              if (window.confirm("Are you sure you want to reset the state?")) {
                resetAllStores();
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

