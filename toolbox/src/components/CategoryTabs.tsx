"use client"

import { Button } from "../../@/components/ui/button"
import { Plus, Server, ArrowUpDown, Globe, Shield, FileCode, RefreshCcw, Zap, List, Lock, BookOpen, UserPlus, Weight, UserMinus, GitMerge, DollarSign, Search, RotateCcw, Calculator, Send, Radio, Repeat, Coins, Home, Banknote, Gift, Monitor, Activity, GraduationCap, ExternalLink } from "lucide-react"

// Type definitions
type AcademyInfo = {
  text: string;
  link: string;
}

type CategoryData = {
  title: string;
  academy?: AcademyInfo;
  subcategories: Array<{
    id: string;
    title: string;
    icon?: any;
    tools?: Array<{
      id: string;
      title: string;
      icon: any;
    }>;
  }>;
}

// Category data with subcategories
const categoryData: Record<string, CategoryData> = {
  "create-l1": {
    title: "Create L1",
    academy: {
      text: "Learn L1 Development",
      link: "https://academy.avax.network/course/customizing-evm"
    },
    subcategories: [
      { id: "createChain", title: "Create Chain", icon: Plus },
      { id: "avalanchegoDockerL1", title: "Node Setup", icon: Server },
      { id: "convertToL1", title: "Convert Subnet", icon: ArrowUpDown },
      { id: "selfHostedExplorer", title: "Explorer Setup", icon: Globe },
    ]
  },
  "validator-manager": {
    title: "Validator Manager",
    academy: {
      text: "Learn L1 Validators",
      link: "https://academy.avax.network/course/l1-validator-management"
    },
    subcategories: [
      { id: "setup", title: "Setup", tools: [
        { id: "deployProxyContract", title: "Deploy Proxy Contract", icon: Shield },
        { id: "deployValidatorManager", title: "Deploy Validator Manager", icon: FileCode },
        { id: "upgradeProxy", title: "Upgrade Proxy", icon: RefreshCcw },
        { id: "initialize", title: "Initialize", icon: Zap },
        { id: "initValidatorSet", title: "Init Validator Set", icon: List },
        { id: "deployPoAManager", title: "Deploy PoA Manager", icon: Lock },
      ]},
      { id: "operations", title: "Operations", tools: [
        { id: "readContract", title: "Read Contract", icon: BookOpen },
        { id: "addValidator", title: "Add Validator", icon: UserPlus },
        { id: "changeWeight", title: "Change Weight", icon: Weight },
        { id: "removeValidator", title: "Remove Validator", icon: UserMinus },
        { id: "migrateV1ToV2", title: "Migrate v1 to v2", icon: GitMerge },
        { id: "balanceTopup", title: "Balance Topup", icon: DollarSign },
        { id: "queryL1ValidatorSet", title: "Query Validator Set", icon: Search },
        { id: "transferOwnership", title: "Transfer Ownership", icon: RotateCcw },
      ]},
      { id: "staking", title: "Staking Manager", tools: [
        { id: "deployRewardCalculator", title: "Deploy Reward Calculator", icon: Calculator },
        { id: "deployStakingManager", title: "Deploy Staking Manager", icon: FileCode },
        { id: "initializeStakingManager", title: "Initialize Staking", icon: Zap },
      ]}
    ]
  },
  "interchain-messaging": {
    title: "Interchain Messaging",
    academy: {
      text: "Learn ICM",
      link: "https://academy.avax.network/course/interchain-messaging"
    },
    subcategories: [
      { id: "teleporterMessenger", title: "Teleporter Messenger", icon: Radio },
      { id: "teleporterRegistry", title: "Teleporter Registry", icon: BookOpen },
      { id: "icmRelayer", title: "ICM Relayer", icon: Repeat },
      { id: "deployICMDemo", title: "Deploy Demo", icon: FileCode },
      { id: "sendICMMessage", title: "Send Message", icon: Send },
    ]
  },
  "interchain-token-transfer": {
    title: "Interchain Token Transfer",
    academy: {
      text: "Learn ICTT",
      link: "https://academy.avax.network/course/interchain-token-transfer"
    },
    subcategories: [
      { id: "deployExampleERC20", title: "Deploy ERC20", icon: Coins },
      { id: "deployTokenHome", title: "Token Home", icon: Home },
      { id: "deployERC20TokenRemote", title: "ERC20 Remote", icon: Globe },
      { id: "deployNativeTokenRemote", title: "Native Remote", icon: Banknote },
      { id: "registerWithHome", title: "Register with Home", icon: BookOpen },
      { id: "addCollateral", title: "Add Collateral", icon: Shield },
      { id: "testSend", title: "Test Send", icon: Send },
    ]
  },
  "precompiles": {
    title: "Precompiles",
    academy: {
      text: "Learn Precompiles",
      link: "https://academy.avax.network/course/customizing-evm"
    },
    subcategories: [
      { id: "deployerAllowlist", title: "Deployer Allowlist", icon: List },
      { id: "nativeMinter", title: "Native Minter", icon: Banknote },
      { id: "transactionAllowlist", title: "Transaction Allowlist", icon: Lock },
      { id: "feeManager", title: "Fee Manager", icon: DollarSign },
      { id: "rewardManager", title: "Reward Manager", icon: Gift },
      { id: "warpMessenger", title: "Warp Messenger", icon: Radio },
    ]
  },
  "utils": {
    title: "Utils",
    subcategories: [
      { id: "node", title: "Node", tools: [
        { id: "rpcMethodsCheck", title: "RPC Methods Check", icon: Monitor },
        { id: "performanceMonitor", title: "Performance Monitor", icon: Activity },
      ]},
      { id: "conversion", title: "Conversion", tools: [
        { id: "formatConverter", title: "Format Converter", icon: Repeat },
        { id: "unitConverter", title: "Unit Converter", icon: Calculator },
      ]}
    ]
  },
  "primary-network": {
    title: "Primary Network",
    subcategories: [
      { id: "avalanchegoDockerPrimaryNetwork", title: "Node Setup", icon: Server },
      { id: "crossChainTransfer", title: "Cross-Chain Transfer", icon: ArrowUpDown },
    ]
  },
  "home": {
    title: "Home",
    subcategories: [
      { id: "home", title: "Home", icon: Home },
    ]
  },
  "staking-manager": {
    title: "Staking Manager",
    subcategories: [
      { id: "staking", title: "Staking Manager", tools: [
        { id: "deployRewardCalculator", title: "Deploy Reward Calculator", icon: Calculator },
        { id: "deployStakingManager", title: "Deploy Staking Manager", icon: FileCode },
        { id: "initializeStakingManager", title: "Initialize Staking", icon: Zap },
      ]}
    ]
  },
  "faucet": {
    title: "Faucet",
    subcategories: [
      { id: "faucet", title: "Get Test Tokens", icon: Monitor },
    ]
  }
}

interface CategoryTabsProps {
  selectedCategory: string
  activeItem: string
  onItemSelect: (itemId: string) => void
}

export function CategoryTabs({ selectedCategory, activeItem, onItemSelect }: CategoryTabsProps) {
  const category = categoryData[selectedCategory as keyof typeof categoryData]

  if (!category) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Welcome to L1 Toolbox</h1>
        <p className="text-muted-foreground">Select a category from the sidebar to get started.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-foreground">{category.title}</h1>
          {category.academy && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/50"
            >
              <a
                href={category.academy.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <GraduationCap className="h-4 w-4" />
                {category.academy.text}
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {selectedCategory === "home" && "Welcome to the L1 Toolbox - your comprehensive toolkit for building on Avalanche"}
          {selectedCategory === "create-l1" && "Tools for creating and setting up new L1 blockchains"}
          {selectedCategory === "validator-manager" && "Manage validators for your L1"}
          {selectedCategory === "staking-manager" && "Deploy and manage staking mechanisms for your L1"}
          {selectedCategory === "interchain-messaging" && "Set up cross-chain communication"}
          {selectedCategory === "interchain-token-transfer" && "Bridge tokens between chains"}
          {selectedCategory === "precompiles" && "Use built-in smart contract functionality"}
          {selectedCategory === "utils" && "Utility tools for development and monitoring"}
          {selectedCategory === "primary-network" && "Tools for Avalanche Primary Network"}
          {selectedCategory === "faucet" && "Get test tokens for development"}
        </p>
      </div>

      {/* Check if this category has subcategories with tools (hierarchical) or direct tools */}
      {category.subcategories.some(sub => 'tools' in sub && sub.tools) ? (
        // Hierarchical structure: Show tabs for subcategories, boxes for tools
        <>
          {/* Tab Navigation for Subcategories */}
          <div className="border-b border-border mb-6">
            <nav className="flex space-x-8" aria-label="Tabs">
              {category.subcategories.map((subcategory) => {
                if (!('tools' in subcategory) || !subcategory.tools) return null

                const isActive = subcategory.tools.some(tool => tool.id === activeItem)

                return (
                  <button
                    key={subcategory.id}
                    onClick={() => {
                      // Select the first tool in this subcategory
                      if (subcategory.tools && subcategory.tools.length > 0) {
                        onItemSelect(subcategory.tools[0].id)
                      }
                    }}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {subcategory.title}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Tools Grid for the active subcategory */}
          <div className="space-y-8">
            {category.subcategories.map((subcategory) => {
              if (!('tools' in subcategory) || !subcategory.tools) return null

              const isSubcategoryActive = subcategory.tools.some(tool => tool.id === activeItem)
              if (!isSubcategoryActive) return null

              return (
                <div key={subcategory.id}>
                  <h3 className="text-lg font-semibold text-foreground mb-4">{subcategory.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subcategory.tools.map((tool) => (
                      <Button
                        key={tool.id}
                        variant={activeItem === tool.id ? "default" : "outline"}
                        className="justify-start h-auto p-4"
                        onClick={() => onItemSelect(tool.id)}
                      >
                        <tool.icon className="mr-3 h-5 w-5" />
                        <span>{tool.title}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        // Flat structure: Show all tools as tabs directly
        <>
          {/* Tab Navigation for Direct Tools */}
          <div className="border-b border-border mb-6">
            <nav className="flex flex-wrap gap-x-8 gap-y-2" aria-label="Tabs">
              {category.subcategories.map((subcategory) => (
                <button
                  key={subcategory.id}
                  onClick={() => onItemSelect(subcategory.id)}
                  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeItem === subcategory.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {'icon' in subcategory && <subcategory.icon className="h-4 w-4" />}
                  {subcategory.title}
                </button>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  )
} 