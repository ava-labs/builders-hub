"use client";

import { ErrorBoundary } from "react-error-boundary";
import { useState, useEffect, lazy, Suspense } from "react";
import { GithubLink } from "../components/GithubLink";
import { ErrorFallback } from "../components/ErrorFallback";
import { ErrorBoundaryWithWarning } from "../components/ErrorBoundaryWithWarning";

import Home from "./Home";
import { AppSidebar } from "../components/AppSidebar";
import { CategoryTabs } from "../components/CategoryTabs";
import { HeaderWalletConnection } from "../components/HeaderWalletConnection";
import { UserButton } from "../components/UserButton";
import { SidebarProvider, SidebarTrigger } from "../../@/components/ui/sidebar";
import { Button } from "../../@/components/ui/button";
import { Sun, Moon } from "lucide-react";

import "../main.css";

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

export type WalletModeRequired = "l1" | "c-chain" | "testnet-mainnet";
export type WalletMode = "optional" | WalletModeRequired;

export type ComponentType = {
  id: string;
  label: string;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  fileNames: string[];
  walletMode: WalletMode;
  icon?: React.ReactNode;
}

type ComponentSubgroupType = {
  components: ComponentType[]
  icon?: React.ReactNode;
}

type ComponentGroupType = {
  academy?: {
    text: string;
    link: string;
  },
  components?: ComponentType[]
  subgroups?: Record<string, ComponentSubgroupType>
  icon?: React.ReactNode;
}

export const componentGroups: Record<string, ComponentGroupType> = {
  'Create L1': {
    academy: {
      text: "Learn L1 Development",
      link: "https://academy.avax.network/course/customizing-evm"
    },
    components: [
      {
        id: 'createChain',
        label: "Create Chain",
        component: lazy(() => import('./L1/CreateChain')),
        fileNames: ["toolbox/src/toolbox/L1/CreateChain.tsx"],
        walletMode: "c-chain",
      },
      {
        id: "avalanchegoDockerL1",
        label: "L1 Node Setup with Docker",
        component: lazy(() => import('./Nodes/AvalancheGoDockerL1')),
        fileNames: ["toolbox/src/toolbox/Nodes/AvalancheGoDockerL1.tsx"],
        walletMode: "testnet-mainnet",
      },
      {
        id: 'convertToL1',
        label: "Convert Subnet to L1",
        component: lazy(() => import('./L1/ConvertToL1')),
        fileNames: ["toolbox/src/toolbox/L1/ConvertToL1.tsx"],
        walletMode: "c-chain",
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
  "Validator Manager": {
    academy: {
      text: "Learn L1 Validators",
      link: "https://academy.avax.network/course/l1-validator-management"
    },
    subgroups: {
      "Setup": {
        components: [
          {
            id: "deployProxyContract",
            label: "Deploy Proxy Contract",
            component: lazy(() => import('./Proxy/DeployProxyContract')),
            fileNames: ["toolbox/src/toolbox/Proxy/DeployProxyContract.tsx"],
            walletMode: "l1",
          },
          {
            id: "deployValidatorManager",
            label: "Deploy Validator Manager Contract",
            component: lazy(() => import('./ValidatorManager/DeployValidatorManager')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/DeployValidatorManager.tsx"],
            walletMode: "l1",
          },
          {
            id: "upgradeProxy",
            label: "Upgrade Proxy Implementation",
            component: lazy(() => import('./Proxy/UpgradeProxy')),
            fileNames: ["toolbox/src/toolbox/Proxy/UpgradeProxy.tsx"],
            walletMode: "l1",
          },
          {
            id: "initialize",
            label: "Set Initial Configuration",
            component: lazy(() => import('./ValidatorManager/Initialize')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/Initialize.tsx"],
            walletMode: "l1",
          },
          {
            id: "initValidatorSet",
            label: "Initialize Validator Set",
            component: lazy(() => import('./ValidatorManager/InitValidatorSet')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/InitValidatorSet.tsx"],
            walletMode: "l1",
          },
          {
            id: 'deployPoAManager',
            label: "Deploy PoA Manager",
            component: lazy(() => import('./ValidatorManager/DeployPoAManager')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/DeployPoAManager.tsx"],
            walletMode: "l1",
          }
        ]
      },
      "Operations": {
        components: [
          {
            id: "readContract",
            label: "Read Contract",
            component: lazy(() => import('./ValidatorManager/ReadContract')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/ReadContract.tsx"],
            walletMode: "l1",
          },
          {
            id: "addValidator",
            label: "Add L1 Validator",
            component: lazy(() => import('./ValidatorManager/AddValidator/AddValidator')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/AddValidator/AddValidator.tsx"],
            walletMode: "l1",
          },
          {
            id: "changeWeight",
            label: "Change L1 Validator Weight",
            component: lazy(() => import('./ValidatorManager/ChangeWeight/ChangeWeight')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/ChangeWeight/ChangeWeight.tsx"],
            walletMode: "l1",
          },
          {
            id: "removeValidator",
            label: "Remove L1 Validator",
            component: lazy(() => import('./ValidatorManager/RemoveValidator/RemoveValidator')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/RemoveValidator/RemoveValidator.tsx"],
            walletMode: "l1",
          },
          {
            id: "migrateV1ToV2",
            label: "Migrate v1 to v2",
            component: lazy(() => import('./ValidatorManager/MigrateV1ToV2')),
            fileNames: ["toolbox/src/toolbox//ValidatorManager/MigrateV1ToV2.tsx"],
            walletMode: "l1",
          },
          {
            id: 'balanceTopup',
            label: "Increase L1 Validator Balance",
            component: lazy(() => import('./Nodes/BalanceTopup')),
            fileNames: ["toolbox/src/toolbox/Nodes/BalanceTopup.tsx"],
            walletMode: "c-chain",
          },
          {
            id: "queryL1ValidatorSet",
            label: "Query L1 Validator Set",
            component: lazy(() => import('./ValidatorManager/QueryL1ValidatorSet')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet.tsx"],
            walletMode: "testnet-mainnet",
          },
          {
            id: "transferOwnership",
            label: "Transfer Contract Ownership",
            component: lazy(() => import('./StakingManager/TransferOwnership')),
            fileNames: ["toolbox/src/toolbox/StakingManager/TransferOwnership.tsx"],
            walletMode: "l1",
          }
        ]
      },
      "Staking Manager": {
        components: [
          {
            id: "deployRewardCalculator",
            label: "Deploy Reward Calculator",
            component: lazy(() => import('./StakingManager/DeployRewardCalculator')),
            fileNames: ["toolbox/src/toolbox/StakingManager/DeployRewardCalculator.tsx"],
            walletMode: "l1",
          },
          {
            id: "deployStakingManager",
            label: "Deploy Staking Manager",
            component: lazy(() => import('./StakingManager/DeployStakingManager')),
            fileNames: ["toolbox/src/toolbox/StakingManager/DeployStakingManager.tsx"],
            walletMode: "l1",
          },
          {
            id: "initializeStakingManager",
            label: "Set Initial Configuration",
            component: lazy(() => import('./StakingManager/Initialize')),
            fileNames: ["toolbox/src/toolbox/StakingManager/Initialize.tsx"],
            walletMode: "l1",
          },
        ]
      }
    }
  },
  "Interchain Messaging": {
    academy: {
      text: "Learn ICM",
      link: "https://academy.avax.network/course/interchain-messaging"
    },
    components: [
      {
        id: "teleporterMessenger",
        label: "Deploy Teleporter Messenger",
        component: lazy(() => import('./ICM/TeleporterMessenger')),
        fileNames: ["toolbox/src/toolbox/ICM/TeleporterMessenger.tsx"],
        walletMode: "l1",
      },
      {
        id: "teleporterRegistry",
        label: "Deploy Teleporter Registry",
        component: lazy(() => import('./ICM/TeleporterRegistry')),
        fileNames: ["toolbox/src/toolbox/ICM/TeleporterRegistry.tsx"],
        walletMode: "l1",
      },
      {
        id: "icmRelayer",
        label: "ICM Relayer Setup",
        component: lazy(() => import('./ICM/ICMRelayer')),
        fileNames: ["toolbox/src/toolbox/ICM/ICMRelayer.tsx"],
        walletMode: "l1",
      },
      {
        id: "deployICMDemo",
        label: "Deploy ICM Demo",
        component: lazy(() => import('./ICM/DeployICMDemo')),
        fileNames: [
          "toolbox/src/toolbox/ICM/DeployICMDemo.tsx",
          "toolbox/contracts/example-contracts/contracts/ICMDemo.sol",
        ],
        walletMode: "l1",
      },
      {
        id: "sendICMMessage",
        label: "Send ICM Message",
        component: lazy(() => import('./ICM/SendICMMessage')),
        fileNames: [
          "toolbox/src/toolbox/ICM/SendICMMessage.tsx",
          "toolbox/contracts/example-contracts/contracts/senderOnCChain.sol",
        ],
        walletMode: "l1",
      },
    ]
  },
  "Interchain Token Transfer": {
    academy: {
      text: "Learn ICTT",
      link: "https://academy.avax.network/course/interchain-token-transfer"
    },
    components: [
      {
        id: "deployExampleERC20",
        label: "Deploy Example ERC20",
        component: lazy(() => import('./ICTT/DeployExampleERC20')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployExampleERC20.tsx"],
        walletMode: "l1",
      },
      {
        id: "deployTokenHome",
        label: "Deploy Token Home Contract",
        component: lazy(() => import('./ICTT/DeployTokenHome')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployTokenHome.tsx"],
        walletMode: "l1",
      },
      {
        id: "deployERC20TokenRemote",
        label: "Deploy ERC20 Token Remote Contract",
        component: lazy(() => import('./ICTT/DeployERC20TokenRemote')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployERC20TokenRemote.tsx"],
        walletMode: "l1",
      },
      {
        id: "deployNativeTokenRemote",
        label: "Deploy Native Token Remote Contract",
        component: lazy(() => import('./ICTT/DeployNativeTokenRemote')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployNativeTokenRemote.tsx"],
        walletMode: "l1",
      },
      {
        id: "registerWithHome",
        label: "Register Token Remote with Home",
        component: lazy(() => import('./ICTT/RegisterWithHome')),
        fileNames: ["toolbox/src/toolbox/ICTT/RegisterWithHome.tsx"],
        walletMode: "l1",
      },
      {
        id: "addCollateral",
        label: "Add Collateral",
        component: lazy(() => import('./ICTT/AddCollateral')),
        fileNames: ["toolbox/src/toolbox/ICTT/AddCollateral.tsx"],
        walletMode: "l1",
      },
      {
        id: "testSend",
        label: "Test Sending ERC20 Tokens",
        component: lazy(() => import('./ICTT/TestSend')),
        fileNames: ["toolbox/src/toolbox/ICTT/TestSend.tsx"],
        walletMode: "l1",
      }
    ]
  },
  "Precompiles": {
    academy: {
      text: "Learn Precompiles",
      link: "https://academy.avax.network/course/customizing-evm"
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
  "Utils": {
    components: [],
    subgroups: {
      "Node": {
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
      "Conversion": {
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
      }
    }
  },
  'Primary Network': {
    academy: {
      text: "Learn L1 Development",
      link: "https://academy.avax.network/course/customizing-evm"
    },
    components: [
      {
        id: "avalanchegoDockerPrimaryNetwork",
        label: "Node Setup with Docker",
        component: lazy(() => import('./Nodes/AvalancheGoDockerPrimaryNetwork')),
        fileNames: ["toolbox/src/toolbox/Nodes/AvalancheGoDockerPrimaryNetwork.tsx"],
        walletMode: "testnet-mainnet",
      },
      {
        id: "crossChainTransfer",
        label: "Cross-Chain Transfer",
        component: lazy(() => import('../components/CrossChainTransfer')),
        fileNames: ["toolbox/src/components/CrossChainTransfer.tsx"],
        walletMode: "c-chain",
      }
    ]
  },
  "Home": {
    academy: {
      text: "Learn L1 Development",
      link: "https://academy.avax.network/course/customizing-evm"
    },
    components: [
      {
        id: "home",
        label: "Home",
        component: lazy(() => import('./Home')),
        fileNames: ["toolbox/src/toolbox/Home.tsx"],
        walletMode: "optional",
      }
    ]
  },
  "Faucet": {
    academy: {
      text: "Learn L1 Development",
      link: "https://academy.avax.network/course/customizing-evm"
    },
    components: [
      {
        id: "faucet",
        label: "Get Test Tokens",
        component: lazy(() => import('./Wallet/Faucet')),
        fileNames: ["toolbox/src/toolbox/Wallet/Faucet.tsx"],
        walletMode: "c-chain",
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

interface ToolboxAppProps {
  embedded?: boolean;
}

export default function ToolboxApp({ embedded = false }: ToolboxAppProps) {
  const defaultTool = embedded ? "" : "home";

  // Use state from URL hash. Default to home page if hash is empty.
  const [selectedTool, setSelectedTool] = useState(
    window.location.hash ? window.location.hash.substring(1) : defaultTool
  );
  
  // Track last opened tool for each category
  const [lastOpenedInCategory, setLastOpenedInCategory] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('toolbox-last-opened-in-category');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  // Toggle dark mode
  const toggleDarkMode = () => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark');
      setIsDarkMode(!isDarkMode);
      // Save preference to localStorage
      localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
    }
  };

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  // Track initial tool selection
  useEffect(() => {
    if (selectedTool && selectedTool !== "home") {
      const activeCategory = getActiveCategory(selectedTool);
      if (activeCategory) {
        const newLastOpened = { ...lastOpenedInCategory, [activeCategory]: selectedTool };
        setLastOpenedInCategory(newLastOpened);
        if (typeof window !== 'undefined') {
          localStorage.setItem('toolbox-last-opened-in-category', JSON.stringify(newLastOpened));
        }
      }
    }
  }, []); // Only run on initial mount

  // Listen for URL hash changes (e.g. back/forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const newTool = window.location.hash ? window.location.hash.substring(1) : defaultTool;
      setSelectedTool(newTool);
      
      // Update last opened tool for the category when navigating via URL
      const activeCategory = getActiveCategory(newTool);
      if (activeCategory && newTool !== "home") {
        const newLastOpened = { ...lastOpenedInCategory, [activeCategory]: newTool };
        setLastOpenedInCategory(newLastOpened);
        localStorage.setItem('toolbox-last-opened-in-category', JSON.stringify(newLastOpened));
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [lastOpenedInCategory]);

  // Get the default/first tool for a category
  const getDefaultToolForCategory = (categoryId: string): string => {
    // Check if we have a last opened tool for this category
    if (lastOpenedInCategory[categoryId]) {
      return lastOpenedInCategory[categoryId];
    }
    
    // Otherwise, return the first tool in the category
    const categoryToFirstTool: Record<string, string> = {
      "home": "home",
      "create-l1": "createChain",
      "validator-manager": "deployProxyContract",
      "interchain-messaging": "teleporterMessenger",
      "interchain-token-transfer": "deployExampleERC20",
      "precompiles": "deployerAllowlist",
      "staking-manager": "deployRewardCalculator",
      "utils": "formatConverter",
      "primary-network": "avalanchegoDockerPrimaryNetwork",
      "faucet": "faucet"
    };
    
    return categoryToFirstTool[categoryId] || categoryId;
  };

  const handleComponentClick = (toolId: string) => {
    const mainCategories = ["home", "create-l1", "validator-manager", "staking-manager", "interchain-messaging", "interchain-token-transfer", "precompiles", "utils", "primary-network", "faucet"];
    
    // If clicking on a main category, open the default tool for that category
    if (mainCategories.includes(toolId)) {
      const defaultTool = getDefaultToolForCategory(toolId);
      toolId = defaultTool;
    }
    
    // Track which category this tool belongs to and save as last opened
    const activeCategory = getActiveCategory(toolId);
    if (activeCategory) {
      const newLastOpened = { ...lastOpenedInCategory, [activeCategory]: toolId };
      setLastOpenedInCategory(newLastOpened);
      if (typeof window !== 'undefined') {
        localStorage.setItem('toolbox-last-opened-in-category', JSON.stringify(newLastOpened));
      }
    }
    
    // Update the URL hash
    window.location.hash = toolId;
    // Optionally update local state immediately
    setSelectedTool(toolId);
  };

  // Determine which main category is active based on the current tool
  const getActiveCategory = (currentTool: string) => {
    // Map of tool IDs to their main categories
    const toolToCategory: Record<string, string> = {
      // Home
      home: "home",
      
      // Create L1
      createChain: "create-l1",
      avalanchegoDockerL1: "create-l1", 
      convertToL1: "create-l1",
      selfHostedExplorer: "create-l1",
      
      // Validator Manager
      deployProxyContract: "validator-manager",
      deployValidatorManager: "validator-manager",
      upgradeProxy: "validator-manager", 
      initialize: "validator-manager",
      initValidatorSet: "validator-manager",
      deployPoAManager: "validator-manager",
      readContract: "validator-manager",
      addValidator: "validator-manager",
      changeWeight: "validator-manager",
      removeValidator: "validator-manager", 
      migrateV1ToV2: "validator-manager",
      balanceTopup: "validator-manager",
      queryL1ValidatorSet: "validator-manager",
      transferOwnership: "validator-manager",
      deployRewardCalculator: "staking-manager",
      deployStakingManager: "staking-manager",
      initializeStakingManager: "staking-manager",
      
      // Interchain Messaging
      teleporterMessenger: "interchain-messaging",
      teleporterRegistry: "interchain-messaging",
      icmRelayer: "interchain-messaging",
      deployICMDemo: "interchain-messaging", 
      sendICMMessage: "interchain-messaging",
      
      // Interchain Token Transfer
      deployExampleERC20: "interchain-token-transfer",
      deployTokenHome: "interchain-token-transfer",
      deployERC20TokenRemote: "interchain-token-transfer",
      deployNativeTokenRemote: "interchain-token-transfer",
      registerWithHome: "interchain-token-transfer",
      addCollateral: "interchain-token-transfer",
      testSend: "interchain-token-transfer",
      
      // Precompiles
      deployerAllowlist: "precompiles",
      nativeMinter: "precompiles",
      transactionAllowlist: "precompiles",
      feeManager: "precompiles",
      rewardManager: "precompiles", 
      warpMessenger: "precompiles",
      
      // Utils
      rpcMethodsCheck: "utils",
      performanceMonitor: "utils",
      formatConverter: "utils",
      unitConverter: "utils",
      
      // Primary Network
      avalanchegoDockerPrimaryNetwork: "primary-network",
      crossChainTransfer: "primary-network",
      
      // Faucet
      faucet: "faucet"
    }
    
    return toolToCategory[currentTool] || ""
  };

  const renderToolComponent = () => {
    const allComponents: ComponentType[] = [];
    Object.values(componentGroups).forEach(group => {
      if (group.components) {
        allComponents.push(...group.components);
      }
      if (group.subgroups) {
        Object.values(group.subgroups).forEach(subgroup => {
          allComponents.push(...subgroup.components);
        });
      }
    });
    allComponents.push({
      id: "dev",
      label: "Dev",
      component: lazy(() => import('./Dev')),
      fileNames: [],
      walletMode: "l1",
    });

    const comp = allComponents.find(c => c.id === selectedTool);
    if (!comp) {
      return null;
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
        </ErrorBoundaryWithWarning>
      </ErrorBoundary>
    );
  };

  // Removed unused handleResetState function

  const renderSelectedComponent = () => {
    const activeCategory = getActiveCategory(selectedTool);
    
    // Handle home page
    if (selectedTool === "home") {
      return (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            window.location.reload();
          }}
        >
          <ErrorBoundaryWithWarning>
            <div className="space-y-4">
              <Home />
            </div>
          </ErrorBoundaryWithWarning>
        </ErrorBoundary>
      );
    }

    // Show category tabs when a main category is selected but no specific tool
    const mainCategories = ["home", "create-l1", "validator-manager", "staking-manager", "interchain-messaging", "interchain-token-transfer", "precompiles", "utils", "primary-network", "faucet"];
    if (mainCategories.includes(selectedTool)) {
      return <CategoryTabs selectedCategory={selectedTool} activeItem={selectedTool} onItemSelect={handleComponentClick} />
    }

    // Show category tabs with active tool when a specific tool is selected
    if (activeCategory) {
      return (
        <div>
          <CategoryTabs selectedCategory={activeCategory} activeItem={selectedTool} onItemSelect={handleComponentClick} />
          <div className="mt-8">
            {renderToolComponent()}
          </div>
        </div>
      )
    }

    return <div>Component not found</div>;
  };

  if (embedded) {
    return (
      <div className="w-full">
        {renderSelectedComponent()}
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
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

        <AppSidebar 
          activeItem={getActiveCategory(selectedTool) || selectedTool}
          onItemSelect={handleComponentClick}
        />
        
        <main className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 min-h-[64px]">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="h-5 w-px bg-sidebar-border" />
              <div className="flex items-center gap-3">
              {(() => {
                const activeCategory = getActiveCategory(selectedTool);
                const mainCategories = ["home", "create-l1", "validator-manager", "staking-manager", "interchain-messaging", "interchain-token-transfer", "precompiles", "utils", "primary-network", "faucet"];
                
                // Category name mapping
                const categoryNames: Record<string, string> = {
                  "home": "Home",
                  "create-l1": "Create L1",
                  "validator-manager": "Validator Manager", 
                  "staking-manager": "Staking Manager",
                  "interchain-messaging": "Interchain Messaging",
                  "interchain-token-transfer": "Interchain Token Transfer",
                  "precompiles": "Precompiles",
                  "utils": "Utils",
                  "primary-network": "Primary Network",
                  "faucet": "Faucet"
                };

                // Tool name mapping
                const toolNames: Record<string, string> = {
                  home: "Home",
                  createChain: "Create Chain",
                  avalanchegoDockerL1: "Node Setup",
                  convertToL1: "Convert Subnet",
                  selfHostedExplorer: "Explorer Setup",
                  deployProxyContract: "Deploy Proxy Contract",
                  deployValidatorManager: "Deploy Validator Manager",
                  upgradeProxy: "Upgrade Proxy",
                  initialize: "Initialize",
                  initValidatorSet: "Init Validator Set",
                  deployPoAManager: "Deploy PoA Manager",
                  readContract: "Read Contract",
                  addValidator: "Add Validator",
                  changeWeight: "Change Weight",
                  removeValidator: "Remove Validator",
                  migrateV1ToV2: "Migrate v1 to v2",
                  balanceTopup: "Balance Topup",
                  queryL1ValidatorSet: "Query Validator Set",
                  transferOwnership: "Transfer Ownership",
                  deployRewardCalculator: "Deploy Reward Calculator",
                  deployStakingManager: "Deploy Staking Manager",
                  initializeStakingManager: "Initialize Staking",
                  teleporterMessenger: "Teleporter Messenger",
                  teleporterRegistry: "Teleporter Registry",
                  icmRelayer: "ICM Relayer",
                  deployICMDemo: "Deploy Demo",
                  sendICMMessage: "Send Message",
                  deployExampleERC20: "Deploy ERC20",
                  deployTokenHome: "Token Home",
                  deployERC20TokenRemote: "ERC20 Remote",
                  deployNativeTokenRemote: "Native Remote",
                  registerWithHome: "Register with Home",
                  addCollateral: "Add Collateral",
                  testSend: "Test Send",
                  deployerAllowlist: "Deployer Allowlist",
                  nativeMinter: "Native Minter",
                  transactionAllowlist: "Transaction Allowlist",
                  feeManager: "Fee Manager",
                  rewardManager: "Reward Manager",
                  warpMessenger: "Warp Messenger",
                  rpcMethodsCheck: "RPC Methods Check",
                  performanceMonitor: "Performance Monitor",
                  formatConverter: "Format Converter",
                  unitConverter: "Unit Converter",
                  avalanchegoDockerPrimaryNetwork: "Node Setup",
                  crossChainTransfer: "Cross-Chain Transfer",
                  faucet: "Get Test Tokens"
                };

                if (selectedTool === "home") {
                  return <h1 className="text-lg font-semibold text-foreground">Home</h1>
                }

                if (mainCategories.includes(selectedTool)) {
                  return <h1 className="text-lg font-semibold text-foreground">{categoryNames[selectedTool]}</h1>
                }

                if (activeCategory && toolNames[selectedTool]) {
                  return (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">{categoryNames[activeCategory]}</span>
                      <span className="text-muted-foreground">›</span>
                      <span className="font-medium text-foreground">{toolNames[selectedTool]}</span>
                    </div>
                  )
                }

                                 return <h1 className="text-lg font-semibold text-foreground">L1 Toolbox</h1>
               })()}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="h-8 w-8"
              >
                {isDarkMode ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
              
              {/* Wallet Connection - only show when connected or can connect */}
              <HeaderWalletConnection />
              
              {/* User Login Button */}
              <UserButton />
            </div>
          </header>
          <div className="flex-1 flex flex-col gap-4 p-4 pt-0">
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-6">
              {renderSelectedComponent()}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

