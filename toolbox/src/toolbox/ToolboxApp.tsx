"use client";

import { ErrorBoundary } from "react-error-boundary";
import { RefreshCw, ChevronDown, ChevronRight, Layers, Users, MessagesSquare, Coins, Settings, Wrench, GraduationCap, Home, Plus, Shield, ArrowUpDown, UserPlus, Weight, UserMinus, GitMerge, DollarSign, Search, RotateCcw, Calculator, Send, FileCode, BookOpen, Server, Globe, Zap, List, Lock, Banknote, Gift, Radio, Droplets, Monitor, Activity, RefreshCcw, Repeat, Moon, Sun, ArrowLeft, Pin, Network } from 'lucide-react';
import { useState, useEffect, lazy, Suspense } from "react";
import { GithubLink } from "../components/GithubLink";
import { ErrorFallback } from "../components/ErrorFallback";
import { ErrorBoundaryWithWarning } from "../components/ErrorBoundaryWithWarning";
import { OptionalConnectWallet, type WalletMode } from "../components/ConnectWallet/ConnectWallet";
import SplashPage from "./SplashPage";
import { Toaster } from "sonner";

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
    icon: <Layers className="w-5 h-5" />,
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
        walletMode: "c-chain",
        icon: <Plus className="w-4 h-4" />
      },
      {
        id: "avalanchegoDockerL1",
        label: "L1 Node Setup with Docker",
        component: lazy(() => import('./Nodes/AvalancheGoDockerL1')),
        fileNames: ["toolbox/src/toolbox/Nodes/AvalancheGoDockerL1.tsx"],
        walletMode: "testnet-mainnet",
        icon: <Server className="w-4 h-4" />
      },
      {
        id: "managedTestnetNodes",
        label: "Managed Testnet Nodes",
        component: lazy(() => import('./Nodes/ManagedTestnetNodes/ManagedTestnetNodes')),
        fileNames: ["toolbox/src/toolbox/Nodes/BuilderHubNodes/BuilderHubNodes.tsx"],
        walletMode: "testnet-mainnet",
        icon: <Server className="w-4 h-4" />
      },
      {
        id: 'convertToL1',
        label: "Convert Subnet to L1",
        component: lazy(() => import('./L1/ConvertToL1')),
        fileNames: ["toolbox/src/toolbox/L1/ConvertToL1.tsx"],
        walletMode: "c-chain",
        icon: <ArrowUpDown className="w-4 h-4" />
      },
      {
        id: "selfHostedExplorer",
        label: "Self-Hosted Explorer",
        component: lazy(() => import('./L1/SelfHostedExplorer')),
        fileNames: ["toolbox/src/toolbox/Nodes/SelfHostedExplorer.tsx"],
        walletMode: "testnet-mainnet",
        icon: <Globe className="w-4 h-4" />
      }
    ]
  },
  "Validator Manager": {
    icon: <Users className="w-5 h-5" />,
    academy: {
      text: "Learn about managing the validator set of an L1",
      link: "https://build.avax.network/academy/l1-validator-management"
    },
    subgroups: {
      "Setup": {
        icon: <Settings className="w-4 h-4" />,
        components: [
          {
            id: "deployProxyContract",
            label: "Deploy Proxy Contract",
            component: lazy(() => import('./Proxy/DeployProxyContract')),
            fileNames: ["toolbox/src/toolbox/Proxy/DeployProxyContract.tsx"],
            walletMode: "l1",
            icon: <Shield className="w-4 h-4" />
          },
          {
            id: "deployValidatorManager",
            label: "Deploy Validator Manager Contract",
            component: lazy(() => import('./ValidatorManager/DeployValidatorManager')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/DeployValidatorManager.tsx"],
            walletMode: "l1",
            icon: <FileCode className="w-4 h-4" />
          },
          {
            id: "upgradeProxy",
            label: "Upgrade Proxy Implementation",
            component: lazy(() => import('./Proxy/UpgradeProxy')),
            fileNames: ["toolbox/src/toolbox/Proxy/UpgradeProxy.tsx"],
            walletMode: "l1",
            icon: <RefreshCcw className="w-4 h-4" />
          },
          {
            id: "initialize",
            label: "Set Initial Configuration",
            component: lazy(() => import('./ValidatorManager/Initialize')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/Initialize.tsx"],
            walletMode: "l1",
            icon: <Zap className="w-4 h-4" />
          },
          {
            id: "initValidatorSet",
            label: "Initialize Validator Set",
            component: lazy(() => import('./ValidatorManager/InitValidatorSet')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/InitValidatorSet.tsx"],
            walletMode: "l1",
            icon: <List className="w-4 h-4" />
          },
          {
            id: 'deployPoAManager',
            label: "Deploy PoA Manager",
            component: lazy(() => import('./ValidatorManager/DeployPoAManager')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/DeployPoAManager.tsx"],
            walletMode: "l1",
            icon: <Lock className="w-4 h-4" />
          }
        ]
      },
      "Operations": {
        icon: <Wrench className="w-4 h-4" />,
        components: [
          {
            id: "readContract",
            label: "Read Contract",
            component: lazy(() => import('./ValidatorManager/ReadContract')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/ReadContract.tsx"],
            walletMode: "l1",
            icon: <BookOpen className="w-4 h-4" />
          },
          {
            id: "addValidator",
            label: "Add L1 Validator",
            component: lazy(() => import('./ValidatorManager/AddValidator/AddValidator')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/AddValidator/AddValidator.tsx"],
            walletMode: "l1",
            icon: <UserPlus className="w-4 h-4" />
          },
          {
            id: "changeWeight",
            label: "Change L1 Validator Weight",
            component: lazy(() => import('./ValidatorManager/ChangeWeight/ChangeWeight')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/ChangeWeight/ChangeWeight.tsx"],
            walletMode: "l1",
            icon: <Weight className="w-4 h-4" />
          },
          {
            id: "removeValidator",
            label: "Remove L1 Validator",
            component: lazy(() => import('./ValidatorManager/RemoveValidator/RemoveValidator')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/RemoveValidator/RemoveValidator.tsx"],
            walletMode: "l1",
            icon: <UserMinus className="w-4 h-4" />
          },
          {
            id: "migrateV1ToV2",
            label: "Migrate v1 to v2",
            component: lazy(() => import('./ValidatorManager/MigrateV1ToV2')),
            fileNames: ["toolbox/src/toolbox//ValidatorManager/MigrateV1ToV2.tsx"],
            walletMode: "l1",
            icon: <GitMerge className="w-4 h-4" />
          },
          {
            id: 'balanceTopup',
            label: "Increase L1 Validator Balance",
            component: lazy(() => import('./Nodes/BalanceTopup')),
            fileNames: ["toolbox/src/toolbox/Nodes/BalanceTopup.tsx"],
            walletMode: "c-chain",
            icon: <DollarSign className="w-4 h-4" />
          },
          {
            id: "queryL1ValidatorSet",
            label: "Query L1 Validator Set",
            component: lazy(() => import('./ValidatorManager/QueryL1ValidatorSet')),
            fileNames: ["toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet.tsx"],
            walletMode: "testnet-mainnet",
            icon: <Search className="w-4 h-4" />
          },
          {
            id: "transferOwnership",
            label: "Transfer Contract Ownership",
            component: lazy(() => import('./StakingManager/TransferOwnership')),
            fileNames: ["toolbox/src/toolbox/StakingManager/TransferOwnership.tsx"],
            walletMode: "l1",
            icon: <RotateCcw className="w-4 h-4" />
          }
        ]
      },
      "Staking Manager": {
        icon: <Coins className="w-4 h-4" />,
        components: [
          {
            id: "deployRewardCalculator",
            label: "Deploy Reward Calculator",
            component: lazy(() => import('./StakingManager/DeployRewardCalculator')),
            fileNames: ["toolbox/src/toolbox/StakingManager/DeployRewardCalculator.tsx"],
            walletMode: "l1",
            icon: <Calculator className="w-4 h-4" />
          },
          {
            id: "deployStakingManager",
            label: "Deploy Staking Manager",
            component: lazy(() => import('./StakingManager/DeployStakingManager')),
            fileNames: ["toolbox/src/toolbox/StakingManager/DeployStakingManager.tsx"],
            walletMode: "l1",
            icon: <FileCode className="w-4 h-4" />
          },
          {
            id: "initializeStakingManager",
            label: "Set Initial Configuration",
            component: lazy(() => import('./StakingManager/Initialize')),
            fileNames: ["toolbox/src/toolbox/StakingManager/Initialize.tsx"],
            walletMode: "l1",
            icon: <Zap className="w-4 h-4" />
          },
        ]
      }
    }
  },
  "Interchain Messaging": {
    icon: <MessagesSquare className="w-5 h-5" />,
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
        walletMode: "l1",
        icon: <Radio className="w-4 h-4" />
      },
      {
        id: "teleporterRegistry",
        label: "Deploy Teleporter Registry",
        component: lazy(() => import('./ICM/TeleporterRegistry')),
        fileNames: ["toolbox/src/toolbox/ICM/TeleporterRegistry.tsx"],
        walletMode: "l1",
        icon: <BookOpen className="w-4 h-4" />
      },
      {
        id: "icmRelayer",
        label: "ICM Relayer Setup",
        component: lazy(() => import('./ICM/ICMRelayer')),
        fileNames: ["toolbox/src/toolbox/ICM/ICMRelayer.tsx"],
        walletMode: "l1",
        icon: <Repeat className="w-4 h-4" />
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
        icon: <FileCode className="w-4 h-4" />
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
        icon: <Send className="w-4 h-4" />
      },
    ]
  },
  "Interchain Token Transfer": {
    icon: <Coins className="w-5 h-5" />,
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
        walletMode: "l1",
        icon: <Coins className="w-4 h-4" />
      },
      {
        id: "deployTokenHome",
        label: "Deploy Token Home Contract",
        component: lazy(() => import('./ICTT/DeployTokenHome')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployTokenHome.tsx"],
        walletMode: "l1",
        icon: <Home className="w-4 h-4" />
      },
      {
        id: "deployERC20TokenRemote",
        label: "Deploy ERC20 Token Remote Contract",
        component: lazy(() => import('./ICTT/DeployERC20TokenRemote')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployERC20TokenRemote.tsx"],
        walletMode: "l1",
        icon: <Globe className="w-4 h-4" />
      },
      {
        id: "deployNativeTokenRemote",
        label: "Deploy Native Token Remote Contract",
        component: lazy(() => import('./ICTT/DeployNativeTokenRemote')),
        fileNames: ["toolbox/src/toolbox/ICTT/DeployNativeTokenRemote.tsx"],
        walletMode: "l1",
        icon: <Banknote className="w-4 h-4" />
      },
      {
        id: "registerWithHome",
        label: "Register Token Remote with Home",
        component: lazy(() => import('./ICTT/RegisterWithHome')),
        fileNames: ["toolbox/src/toolbox/ICTT/RegisterWithHome.tsx"],
        walletMode: "l1",
        icon: <BookOpen className="w-4 h-4" />
      },
      {
        id: "addCollateral",
        label: "Add Collateral",
        component: lazy(() => import('./ICTT/AddCollateral')),
        fileNames: ["toolbox/src/toolbox/ICTT/AddCollateral.tsx"],
        walletMode: "l1",
        icon: <Shield className="w-4 h-4" />
      },
      {
        id: "testSend",
        label: "Test Sending ERC20 Tokens",
        component: lazy(() => import('./ICTT/TestSend')),
        fileNames: ["toolbox/src/toolbox/ICTT/TestSend.tsx"],
        walletMode: "l1",
        icon: <Send className="w-4 h-4" />
      }
    ]
  },

  "Precompiles": {
    icon: <Settings className="w-5 h-5" />,
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
        icon: <List className="w-4 h-4" />
      },
      {
        id: "nativeMinter",
        label: "Native Minter",
        component: lazy(() => import("./Precompiles/NativeMinter")),
        fileNames: ["toolbox/src/toolbox/Precompiles/NativeMinter.tsx"],
        walletMode: "l1",
        icon: <Banknote className="w-4 h-4" />
      },
      {
        id: "transactionAllowlist",
        label: "Transaction Allowlist",
        component: lazy(() => import("./Precompiles/TransactionAllowlist")),
        fileNames: ["toolbox/src/toolbox/Precompiles/TransactionAllowlist.tsx"],
        walletMode: "l1",
        icon: <Lock className="w-4 h-4" />
      },
      {
        id: "feeManager",
        label: "Fee Manager",
        component: lazy(() => import("./Precompiles/FeeManager")),
        fileNames: ["toolbox/src/toolbox/Precompiles/FeeManager.tsx"],
        walletMode: "l1",
        icon: <DollarSign className="w-4 h-4" />
      },
      {
        id: "rewardManager",
        label: "Reward Manager",
        component: lazy(() => import("./Precompiles/RewardManager")),
        fileNames: ["toolbox/src/toolbox/Precompiles/RewardManager.tsx"],
        walletMode: "l1",
        icon: <Gift className="w-4 h-4" />
      },
      {
        id: "warpMessenger",
        label: "Warp Messenger",
        component: lazy(() => import("./Precompiles/WarpMessenger")),
        fileNames: ["toolbox/src/toolbox/Precompiles/WarpMessenger.tsx"],
        walletMode: "l1",
        icon: <Radio className="w-4 h-4" />
      }
    ]
  },
  "Utils": {
    icon: <Wrench className="w-5 h-5" />,
    components: [],
    subgroups: {
      "Node": {
        icon: <Server className="w-4 h-4" />,
        components: [
          {
            id: "rpcMethodsCheck",
            label: "RPC Methods Check",
            component: lazy(() => import('./Nodes/RPCMethodsCheck')),
            fileNames: ["toolbox/src/toolbox/Nodes/RPCMethodsCheck.tsx"],
            walletMode: "testnet-mainnet",
            icon: <Monitor className="w-4 h-4" />
          },
          {
            id: "performanceMonitor",
            label: "Performance Monitor",
            component: lazy(() => import('./Nodes/PerformanceMonitor')),
            fileNames: ["toolbox/src/toolbox/Nodes/PerformanceMonitor.tsx"],
            walletMode: "optional",
            icon: <Activity className="w-4 h-4" />
          }
        ]
      },
      "Conversion": {
        icon: <RefreshCcw className="w-4 h-4" />,
        components: [
          {
            id: 'formatConverter',
            label: "Format Converter",
            component: lazy(() => import('./Conversion/FormatConverter')),
            fileNames: [],
            walletMode: "optional",
            icon: <Repeat className="w-4 h-4" />
          },
          {
            id: 'unitConverter',
            label: "AVAX Unit Converter",
            component: lazy(() => import('./Conversion/UnitConverter')),
            fileNames: [],
            walletMode: "optional",
            icon: <Calculator className="w-4 h-4" />
          }
        ]
      }
    }
  },
  'Primary Network': {
    icon: <Network className="w-5 h-5" />,
    academy: {
      text: "Learn about the Avalanche Primary Network",
      link: "https://build.avax.network/docs/quick-start/primary-network"
    },
    components: [
      {
        id: "avalanchegoDockerPrimaryNetwork",
        label: "Node Setup with Docker",
        component: lazy(() => import('./Nodes/AvalancheGoDockerPrimaryNetwork')),
        fileNames: ["toolbox/src/toolbox/Nodes/AvalancheGoDockerPrimaryNetwork.tsx"],
        walletMode: "testnet-mainnet",
        icon: <Server className="w-4 h-4" />
      },
      {
        id: "crossChainTransfer",
        label: "Cross-Chain Transfer",
        component: lazy(() => import('../components/CrossChainTransfer')),
        fileNames: ["toolbox/src/components/CrossChainTransfer.tsx"],
        walletMode: "c-chain",
        icon: <ArrowUpDown className="w-4 h-4" />
      }
    ]
  },
  "Faucet": {
    icon: <Droplets className="w-5 h-5" />,
    academy: {
      text: "Get free testnet tokens to start building",
      link: "https://build.avax.network/docs/quick-start/fund-test-accounts"
    },
    components: [
      {
        id: "faucet",
        label: "Get Test Tokens",
        component: lazy(() => import('./Wallet/Faucet')),
        fileNames: ["toolbox/src/toolbox/Wallet/Faucet.tsx"],
        walletMode: "c-chain",
        icon: <Droplets className="w-4 h-4" />
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
  const defaultTool = embedded ? "" : "splash";

  // Use state from URL hash. Default to splash page if hash is empty.
  const [selectedTool, setSelectedTool] = useState(
    window.location.hash ? window.location.hash.substring(1) : defaultTool
  );
  
  // State to track sidebar hover and pin
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [_, setShowDarkModeToggle] = useState(false);
  
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

  // Determine if sidebar should be expanded
  const isSidebarExpanded = isSidebarHovered || isSidebarPinned;

  // Handle dark mode toggle visibility with delay
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isSidebarExpanded) {
      // Delay showing the toggle until transition is complete (300ms)
      timeoutId = setTimeout(() => {
        setShowDarkModeToggle(true);
      }, 300);
    } else {
      // Hide immediately when sidebar collapses
      setShowDarkModeToggle(false);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isSidebarExpanded]);

  // Helper function to find which group and subgroup contains a specific tool
  const findParentGroupAndSubgroup = (toolId: string): { groupName: string | null, subgroupName: string | null } => {
    for (const [groupName, group] of Object.entries(componentGroups)) {
      if (group.components?.some(component => component.id === toolId)) {
        return { groupName, subgroupName: null };
      }
      if (group.subgroups) {
        for (const [subgroupName, subgroup] of Object.entries(group.subgroups)) {
          if (subgroup.components.some(component => component.id === toolId)) {
            return { groupName, subgroupName };
          }
        }
      }
    }
    return { groupName: null, subgroupName: null };
  };

  // Get initial tool from URL hash or default
  const initialTool = window.location.hash ? window.location.hash.substring(1) : defaultTool;
  const { groupName: initialParentGroup, subgroupName: initialSubgroup } = findParentGroupAndSubgroup(initialTool);

  // State to track expanded/collapsed groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.keys(componentGroups).reduce((acc, key) => ({
      ...acc,
      [key]: key === initialParentGroup // Set parent group of selected tool to expanded
    }), {})
  );

  // State to track expanded/collapsed subgroups
  const [expandedSubgroups, setExpandedSubgroups] = useState<Record<string, boolean>>(
    initialParentGroup && initialSubgroup 
      ? { [`${initialParentGroup}-${initialSubgroup}`]: true }
      : {}
  );

  // Toggle group expansion
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Toggle subgroup expansion
  const toggleSubgroup = (subgroupKey: string) => {
    setExpandedSubgroups(prev => ({
      ...prev,
      [subgroupKey]: !prev[subgroupKey]
    }));
  };

  // Listen for URL hash changes (e.g. back/forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const newTool = window.location.hash ? window.location.hash.substring(1) : defaultTool;
      setSelectedTool(newTool);
      
      // Auto-expand the parent group and subgroup of the selected tool
      const { groupName: parentGroup, subgroupName } = findParentGroupAndSubgroup(newTool);
      if (parentGroup) {
        setExpandedGroups(prev => ({
          ...prev,
          [parentGroup]: true
        }));
        
        if (subgroupName) {
          setExpandedSubgroups(prev => ({
            ...prev,
            [`${parentGroup}-${subgroupName}`]: true
          }));
        }
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
    
    // Auto-expand the parent group and subgroup of the selected tool
    const { groupName: parentGroup, subgroupName } = findParentGroupAndSubgroup(toolId);
    if (parentGroup) {
      setExpandedGroups(prev => ({
        ...prev,
        [parentGroup]: true
      }));
      
      if (subgroupName) {
        setExpandedSubgroups(prev => ({
          ...prev,
          [`${parentGroup}-${subgroupName}`]: true
        }));
      }
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
    <div className={embedded ? "" : "container mx-auto flex flex-col md:flex-row relative"}>
      {/* Premium Background - only show when not embedded */}
      {!embedded && (
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
      )}

      {!embedded && (
        <div
          className={`fixed left-0 top-0 h-screen bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-300 z-50 ${
          isSidebarExpanded ? 'w-80 shadow-xl' : 'w-16 shadow-sm'
          }`}
          onMouseEnter={() => !isSidebarPinned && setIsSidebarHovered(true)}
          onMouseLeave={() => !isSidebarPinned && setIsSidebarHovered(false)}
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
                      <div className={`p-4 border-b border-zinc-100 dark:border-zinc-800 transition-all duration-300 ${isSidebarExpanded ? 'px-6' : 'px-3'}`}>
              <div className="mb-2 relative">
                <button
                  onClick={() => {
                    window.location.hash = "";
                    setSelectedTool("splash");
                  }}
                  className="flex items-center group transition-all duration-200 cursor-pointer"
                >
                  <div className="relative">
                    <img
                      src="/small-logo.png"
                      alt="Avalanche"
                      className="h-8 w-auto brightness-0 dark:invert transition-all duration-200"
                    />
                    <img
                      src="/small-logo.png"
                      alt=""
                      className="absolute inset-0 h-8 w-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{
                      filter: 'brightness(0) saturate(100%) invert(27%) sepia(96%) saturate(1919%) hue-rotate(213deg) brightness(99%) contrast(107%)'
                      }}
                    />
                  </div>
                </button>

                {/* Pin and Dark mode toggles - only visible when sidebar is fully expanded */}
              <div className={`absolute right-0 top-0 flex items-center gap-2 transition-all duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <button
                    onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      isSidebarPinned
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
                    tabIndex={isSidebarExpanded ? 0 : -1}
                  >
                  <Pin className={`w-5 h-5 transition-transform duration-200 ${isSidebarPinned ? 'rotate-45' : ''}`} />
                  </button>
                  <button
                    onClick={toggleDarkMode}
                    className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200"
                  title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                    tabIndex={isSidebarExpanded ? 0 : -1}
                  >
                    {isDarkMode ? (
                      <Sun className="w-5 h-5" />
                    ) : (
                      <Moon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <nav className="p-2 space-y-2">
              {Object.entries(componentGroups).map(([groupName, group]) => {
                // Special handling for single-component groups (like Faucet)
              const isSingleComponent = group.components?.length === 1 && !group.subgroups;
              const singleComponent = isSingleComponent && group.components ? group.components[0] : null;

                return (
                  <div key={groupName}>
                    <button
                      onClick={() => {
                        if (isSingleComponent && singleComponent) {
                          handleComponentClick(singleComponent.id);
                        } else {
                          toggleGroup(groupName);
                        }
                      }}
                      className={`flex w-full items-center justify-between px-3 py-3 text-left text-base font-semibold text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-all duration-200 border-b border-zinc-100 dark:border-zinc-800 mb-1 group ${
                      isSingleComponent && singleComponent && selectedTool === singleComponent.id
                        ? 'bg-blue-50 dark:bg-zinc-700 text-blue-700 dark:text-white border-blue-200 dark:border-zinc-600'
                        : ''
                      }`}
                      title={!isSidebarExpanded ? groupName : undefined}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0">{group.icon}</div>
                      <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                        isSidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
                      }`}>{groupName}</span>
                      </div>
                      {!isSingleComponent && (
                      <div className={`flex-shrink-0 transition-all duration-300 ${
                        isSidebarExpanded ? 'opacity-100 ml-2' : 'opacity-0 ml-0'
                      }`}>
                        {expandedGroups[groupName]
                          ? <ChevronDown className="w-5 h-5 text-zinc-400" />
                          : <ChevronRight className="w-5 h-5 text-zinc-400" />
                        }
                        </div>
                      )}
                    </button>

                    {!isSingleComponent && expandedGroups[groupName] && (
                    <div className={`overflow-hidden transition-all duration-300 ${
                          isSidebarExpanded
                        ? 'max-h-[2000px] opacity-100 mt-1' 
                        : 'max-h-0 opacity-0'
                    }`}>
                        {group.academy && (
                          <a
                            href={group.academy.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mb-3 mt-2 mx-3 group"
                            tabIndex={isSidebarExpanded ? 0 : -1}
                          >
                            <div className="bg-blue-50 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-zinc-700 hover:shadow-md hover:border-blue-300 dark:hover:border-zinc-600 rounded-lg p-3 border border-blue-200 dark:border-zinc-700 transition-all duration-200 group-hover:scale-[1.02]">
                              <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-zinc-200 mb-1 group-hover:text-blue-800 dark:group-hover:text-white transition-colors duration-200">
                                <GraduationCap className="w-4 h-4 flex-shrink-0" />
                                <span>Academy</span>
                              </div>
                              <p className="text-xs text-blue-600 dark:text-zinc-400 leading-relaxed group-hover:text-blue-700 dark:group-hover:text-zinc-300 transition-colors duration-200">
                                {group.academy.text}
                              </p>
                            </div>
                          </a>
                        )}

                        <div className="ml-3 pl-3 border-l-2 border-zinc-100 dark:border-zinc-800">
                      
                          {/* Render regular components if they exist */}
                          {group.components && (
                            <ul className="space-y-1">
                              {group.components.map(({ id, label, icon }) => (
                                <li key={id}>
                                  <a
                                    href={`#${id}`}
                                    onClick={() => handleComponentClick(id)}
                                    className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-200 group ${
                                      selectedTool === id
                                      ? 'bg-blue-600 dark:bg-zinc-700 text-white dark:text-white font-medium shadow-sm'
                                      : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                    }`}
                                  title={!isSidebarExpanded ? label : undefined}
                                    tabIndex={isSidebarExpanded ? 0 : -1}
                                  >
                                    <div className="flex-shrink-0">{icon}</div>
                                  <span className={`block leading-relaxed font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                    isSidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
                                  }`}>{label}</span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* Render subgroups if they exist */}
                        {group.subgroups && Object.entries(group.subgroups).map(([subgroupName, subgroup]) => {
                                const subgroupKey = `${groupName}-${subgroupName}`;
                                return (
                                  <div key={subgroupName} className="mt-3">
                                    <button
                                onClick={() => toggleSubgroup(subgroupKey)}
                                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md transition-all duration-200 border-b border-zinc-100 dark:border-zinc-800 mb-1 group"
                                      tabIndex={isSidebarExpanded ? 0 : -1}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                  <div className="flex-shrink-0">{subgroup.icon}</div>
                                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                    isSidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
                                  }`}>{subgroupName}</span>
                                        </div>
                                <div className={`flex-shrink-0 transition-all duration-300 ${
                                  isSidebarExpanded ? 'opacity-100 ml-2' : 'opacity-0 ml-0'
                                }`}>
                                  {expandedSubgroups[subgroupKey]
                                    ? <ChevronDown className="w-4 h-4 text-zinc-400" />
                                    : <ChevronRight className="w-4 h-4 text-zinc-400" />
                                  }
                                      </div>
                                    </button>

                                    {expandedSubgroups[subgroupKey] && (
                                      <ul className="mt-1 ml-3 space-y-1">
                                  {subgroup.components.map(({ id, label, icon }) => (
                                            <li key={id}>
                                              <a
                                                href={`#${id}`}
                                        onClick={() => handleComponentClick(id)}
                                                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-200 group ${
                                                  selectedTool === id
                                            ? 'bg-blue-600 dark:bg-zinc-700 text-white dark:text-white font-medium shadow-sm'
                                            : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                                }`}
                                        title={!isSidebarExpanded ? label : undefined}
                                        tabIndex={isSidebarExpanded ? 0 : -1}
                                              >
                                        <div className="flex-shrink-0">{icon}</div>
                                        <span className={`block leading-relaxed font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                          isSidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
                                        }`}>{label}</span>
                                              </a>
                                            </li>
                                  ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                        })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

        <div className={`border-t border-zinc-200 dark:border-zinc-700 p-2 bg-zinc-50 dark:bg-zinc-800/50 transition-all duration-300 ${isSidebarExpanded ? 'px-4' : ''} space-y-2`}>
            <a
              href="/"
              className={`w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700`}
            >
            <ArrowLeft className={`w-4 h-4 transition-all duration-300 ${isSidebarExpanded ? 'mr-2' : 'mr-0'}`} />
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
              isSidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
            }`}>Back to Builder Hub</span>
            </a>
            <button
              onClick={() => {
              if (window.confirm("Are you sure you want to reset the state?")) {
                  resetAllStores();
                }
              }}
              className="w-full flex items-center px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50 rounded-lg transition-all duration-200"
              title={!isSidebarExpanded ? "Reset State" : undefined}
            >
              <RefreshCw className="w-4 h-4 flex-shrink-0" />
            <span className={`ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 ${
              isSidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 ml-0'
            }`}>Reset State</span>
            </button>
          </div>
        </div>
      )}

      <div className={embedded ? "w-full" : `flex-1 p-6 min-w-0 transition-all duration-300 ${isSidebarPinned ? 'ml-80' : 'ml-16'}`}>
        {renderSelectedComponent()}
      </div>
      <Toaster position="bottom-right" richColors expand={true} visibleToasts={5}/>
    </div>
  );
}