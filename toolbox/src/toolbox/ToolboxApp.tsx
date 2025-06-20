"use client";

import { Button } from "../components/Button";
import { ErrorBoundary } from "react-error-boundary";
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect, lazy, Suspense } from "react";
import { GithubLink } from "../components/GithubLink";
import { ErrorFallback } from "../components/ErrorFallback";
import { ErrorBoundaryWithWarning } from "../components/ErrorBoundaryWithWarning";
import { OptionalConnectWallet, type WalletMode } from "../components/ConnectWallet/ConnectWallet";
import SplashPage from "./SplashPage";

import "../main.css";
import { resetAllStores } from "../stores/reset";

// Premium background styles
const backgroundStyles = `
  @keyframes constellation-twinkle {
    0%, 100% { 
      opacity: 0.3;
    }
    50% { 
      opacity: 1;
    }
  }
  
  .animate-constellation-twinkle {
    animation: constellation-twinkle 4s ease-in-out infinite;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = backgroundStyles;
  document.head.appendChild(styleSheet);
}

type ComponentType = {
  id: string;
  label: string;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
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
        id: 'createChain',
        label: "Create Chain",
        component: lazy(() => import('./L1/CreateChain')),
        fileNames: ["toolbox/src/toolbox/L1/CreateChain.tsx"],
        walletMode: "c-chain"
      },
      {
        id: "avalanchegoDocker",
        label: "Node Setup with Docker",
        component: lazy(() => import('./Nodes/AvalanchegoDocker')),
        fileNames: ["toolbox/src/toolbox/Nodes/AvalanchegoDocker.tsx"],
        walletMode: "testnet-mainnet",
      },
      {
        id: 'convertToL1',
        label: "Convert Subnet to L1",
        component: lazy(() => import('./L1/ConvertToL1')),
        fileNames: ["toolbox/src/toolbox/L1/ConvertToL1.tsx"],
        walletMode: "c-chain"
      },
      {
        id: "selfHostedExplorer",
        label: "Self-Hosted Explorer",
        component: lazy(() => import('./L1/SelfHostedExplorer')),
        fileNames: ["toolbox/src/toolbox/Nodes/SelfHostedExplorer.tsx"],
        walletMode: "testnet-mainnet",
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
        id: "upgradeProxy",
        label: "Upgrade Proxy Implementation",
        component: lazy(() => import('./Proxy/UpgradeProxy')),
        fileNames: ["toolbox/src/toolbox/Proxy/UpgradeProxy.tsx"],
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
        id: "migrateV1ToV2",
        label: "Migrate v1 to v2",
        component: lazy(() => import('./ValidatorManager/MigrateV1ToV2')),
        fileNames: ["toolbox/src/toolbox//ValidatorManager/MigrateV1ToV2.tsx"],
        walletMode: "l1"
      }
    ]
  },
  "Validator Manager Operations": {
    components: [
      {
        id: "readContract",
        label: "Read Contract",
        component: lazy(() => import('./ValidatorManager/ReadContract')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/ReadContract.tsx"],
        walletMode: "l1"
      },
      {
        id: "addValidator",
        label: "Add L1 Validator",
        component: lazy(() => import('./ValidatorManager/AddValidator/AddValidator')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/AddValidator/AddValidator.tsx"],
        walletMode: "l1"
      },
      {
        id: "changeWeight",
        label: "Change L1 Validator Weight",
        component: lazy(() => import('./ValidatorManager/ChangeWeight/ChangeWeight')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/ChangeWeight/ChangeWeight.tsx"],
        walletMode: "l1"
      },
      {
        id: "removeValidator",
        label: "Remove L1 Validator",
        component: lazy(() => import('./ValidatorManager/RemoveValidator/RemoveValidator')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/RemoveValidator/RemoveValidator.tsx"],
        walletMode: "l1"
      },
      {
        id: 'balanceTopup',
        label: "Increase L1 Validator Balance",
        component: lazy(() => import('./Nodes/BalanceTopup')),
        fileNames: ["toolbox/src/toolbox/Nodes/BalanceTopup.tsx"],
        walletMode: "c-chain"
      },
      {
        id: "queryL1ValidatorSet",
        label: "Query L1 Validator Set",
        component: lazy(() => import('./ValidatorManager/QueryL1ValidatorSet')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet.tsx"],
        walletMode: "testnet-mainnet"
      },
      {
        id: "transferOwnership",
        label: "Transfer Contract Ownership",
        component: lazy(() => import('./StakingManager/TransferOwnership')),
        fileNames: ["toolbox/src/toolbox/StakingManager/TransferOwnership.tsx"],
        walletMode: "l1"
      }
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
    ]
  },
  "Interchain Messaging": {
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
  "Interchain Token Transfer": {
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
        id: "deployTokenHome",
        label: "Deploy Token Home Contract",
        component: lazy(() => import('./ICTT/DeployTokenHome')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployTokenHome.tsx"],
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
      link: "https://build.avax.network/docs/virtual-machines/default-precompiles/rewardmanager"
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
  "Node Utils": {
    components: [
      {
        id: "rpcMethodsCheck",
        label: "RPC Methods Check",
        component: lazy(() => import('./Nodes/RPCMethodsCheck')),
        fileNames: ["toolbox/src/toolbox/Nodes/RPCMethodsCheck.tsx"],
        walletMode: "testnet-mainnet",
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
  'Expert Tools': {
    components: [
      {
        id: 'deployPoAManager',
        label: "Deploy PoA Manager",
        component: lazy(() => import('./ValidatorManager/DeployPoAManager')),
        fileNames: ["toolbox/src/toolbox/ValidatorManager/DeployPoAManager.tsx"],
        walletMode: "l1"
      }
    ]
  }
};

// Loading component for Suspense
const ComponentLoader = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

export default function ToolboxApp() {
  const defaultTool = "splash";

  // Use state from URL hash. Default to splash page if hash is empty.
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
      const newTool = window.location.hash ? window.location.hash.substring(1) : defaultTool;
      setSelectedTool(newTool);
      
      // Auto-expand the parent group of the selected tool
      const parentGroup = findParentGroup(newTool);
      if (parentGroup) {
        setExpandedGroups(prev => ({
          ...prev,
          [parentGroup]: true
        }));
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleComponentClick = (toolId: string) => {
    // Update the URL hash
    window.location.hash = toolId;
    // Optionally update local state immediately
    setSelectedTool(toolId);
    
    // Auto-expand the parent group of the selected tool
    const parentGroup = findParentGroup(toolId);
    if (parentGroup) {
      setExpandedGroups(prev => ({
        ...prev,
        [parentGroup]: true
      }));
    }
  };

  const renderSelectedComponent = () => {
    // Handle splash page
    if (selectedTool === "splash") {
      return (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            window.location.reload();
          }}
        >
          <ErrorBoundaryWithWarning>
            <div className="space-y-4">
              <SplashPage />
            </div>
          </ErrorBoundaryWithWarning>
        </ErrorBoundary>
      );
    }

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
    <div className="container mx-auto flex flex-col md:flex-row relative">
      {/* Premium Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0A0A0A] dark:via-[#0A0A0A] dark:to-[#0A0A0A]">
          {/* Subtle grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>
          
          {/* Constellation dots */}
          <div className="absolute inset-0">
            <div className="absolute top-1/5 left-1/5 w-1 h-1 bg-slate-400/40 rounded-full animate-constellation-twinkle dark:bg-slate-500/60"></div>
            <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-slate-400/40 rounded-full animate-constellation-twinkle dark:bg-slate-500/60" style={{animationDelay: '1s'}}></div>
            <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-slate-400/40 rounded-full animate-constellation-twinkle dark:bg-slate-500/60" style={{animationDelay: '2s'}}></div>
            <div className="absolute bottom-1/5 right-1/3 w-1 h-1 bg-slate-400/40 rounded-full animate-constellation-twinkle dark:bg-slate-500/60" style={{animationDelay: '3s'}}></div>
          </div>
        </div>
      </div>

      <div className="w-80 flex-shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 flex flex-col h-screen shadow-sm rounded-r-xl ml-4 my-4 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="relative flex items-center mb-2">
              <img src="/small-logo.png" alt="Avalanche" className="h-8 w-auto brightness-0 dark:brightness-0 dark:invert" />
              <button
                onClick={() => {
                  window.location.hash = "";
                  setSelectedTool("splash");
                }}
                className="text-zinc-900 dark:text-white text-xl font-bold tracking-tight absolute left-1/2 transform -translate-x-1/2 top-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 cursor-pointer"
              >
                L1 Toolbox
              </button>
            </div>
            </div>
            
            <nav className="p-4 space-y-2">
              {Object.entries(componentGroups).map(([groupName, group]) => (
                <div key={groupName}>
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left text-base font-semibold text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors duration-200"
                  >
                    <span className="truncate">{groupName}</span>
                    {expandedGroups[groupName]
                      ? <ChevronDown className="w-5 h-5 flex-shrink-0 ml-2 text-zinc-400" />
                      : <ChevronRight className="w-5 h-5 flex-shrink-0 ml-2 text-zinc-400" />
                    }
                  </button>
                  
                  {expandedGroups[groupName] && (
                    <div className="mt-1 ml-3 pl-3 border-l-2 border-zinc-100 dark:border-zinc-800">
                    {group.academy && (
                      <a 
                        href={group.academy.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block mb-3 mt-2"
                      >
                        <div className="bg-blue-50 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-zinc-750 rounded-lg p-3 border border-blue-200 dark:border-zinc-700 transition-all duration-200">
                          <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-zinc-200 mb-1">
                            <img src="/small-logo.png" alt="Avalanche" className="h-4 w-auto" />
                            <span>Academy</span>
                          </div>
                          <p className="text-xs text-blue-600 dark:text-zinc-400 leading-relaxed">
                            {group.academy.text}
                          </p>
                        </div>
                      </a>
                    )}
                    
                    <ul className="space-y-0.5">
                      {group.components.map(({ id, label }) => (
                        <li key={id}>
                          <a
                            href={`#${id}`}
                            onClick={() => handleComponentClick(id)}
                            className={`block px-4 py-2.5 text-sm rounded-lg transition-all duration-200 ${
                              selectedTool === id
                                ? 'bg-blue-600 dark:bg-zinc-700 text-white dark:text-white font-medium shadow-sm'
                                : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <span className="truncate block">{label}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
        
        <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-800/50">
          <Button
            onClick={() => {
              if (window.confirm("Are you sure you want to reset the state?")) {
                resetAllStores();
              }
            }}
            className="w-full text-sm font-medium"
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

