"use client";

import { ChevronRight, MoveVertical } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "../../../toolbox/src/stores/walletStore";

interface FlowStep {
  id: string;
  title: string;
  description?: string;
  path: string;
  isOptional?: boolean;
}

interface Flow {
  id: string;
  title: string;
  steps: FlowStep[];
}

interface AlternativeStep {
  id: string;
  title: string;
  description?: string;
  path: string;
}

interface FlowStepWithAlternatives extends FlowStep {
  alternatives?: AlternativeStep[];
}

interface FlowWithAlternatives {
  id: string;
  title: string;
  steps: FlowStepWithAlternatives[];
}

// Define the flows for each category
const flows: FlowWithAlternatives[] = [
  {
    id: "layer-1-create",
    title: "Create new L1 Flow",
    steps: [
      {
        id: "create",
        title: "Create Chain",
        description: "Configure and deploy your L1 blockchain",
        path: "/console/layer-1/create"
      },
      {
        id: "node-setup",
        title: "Node Setup",
        description: "Choose your node infrastructure",
        path: "/console/layer-1/node-setup",
        alternatives: [
          {
            id: "node-setup",
            title: "AvalancheGo Docker L1",
            description: "Self-hosted node deployment",
            path: "/console/layer-1/node-setup"
          },
          {
            id: "node-setup-managed",
            title: "BuilderHub Managed Nodes",
            description: "Managed node service",
            path: "/console/layer-1/node-setup-managed"
          }
        ]
      },
      {
        id: "convert-to-l1",
        title: "Convert to L1",
        description: "Convert subnet to production L1",
        path: "/console/layer-1/convert-to-l1"
      }
    ]
  },
  {
    id: "layer-1-node",
    title: "L1 Node Setup Flow",
    steps: [
      {
        id: "node-setup",
        title: "AvalancheGo Docker L1",
        description: "Deploy and configure L1 node",
        path: "/console/layer-1/node-setup"
      },
      {
        id: "rpc-security-check",
        title: "RPC Methods Check",
        description: "Verify RPC security configuration",
        path: "/console/layer-1/rpc-security-check"
      },
      {
        id: "performance-check",
        title: "L1 Performance Check",
        description: "Monitor node performance",
        path: "/console/layer-1/performance-check"
      }
    ]
  },
  {
    id: "primary-network-node",
    title: "Primary Network Node Setup Flow",
    steps: [
      {
        id: "node-setup",
        title: "AvalancheGo Docker Primary Network",
        description: "Deploy and configure Primary Network node",
        path: "/console/primary-network/node-setup"
      },
      {
        id: "rpc-security-check",
        title: "RPC Methods Check",
        description: "Verify RPC security configuration",
        path: "/console/primary-network/rpc-security-check"
      },
      {
        id: "performance-check",
        title: "Performance Check",
        description: "Monitor node performance",
        path: "/console/primary-network/performance-check"
      }
    ]
  },
  {
    id: "validator-manager",
    title: "Validator Manager Setup Flow",
    steps: [
      {
        id: "deploy-validator-manager",
        title: "Deploy Validator Manager",
        description: "Deploy ValidatorMessages library and ValidatorManager contract",
        path: "/console/permissioned-l1s/validator-manager-setup"
      },
      {
        id: "upgrade-proxy",
        title: "Upgrade Proxy",
        description: "Upgrade proxy implementation if needed",
        path: "/console/permissioned-l1s/upgrade-proxy"
      },
      {
        id: "initialize",
        title: "Initialize",
        description: "Initialize ValidatorManager with configuration",
        path: "/console/permissioned-l1s/initialize"
      },
      {
        id: "init-validator-set",
        title: "Initialize Validator Set",
        description: "Set up initial validator set from conversion transaction",
        path: "/console/permissioned-l1s/init-validator-set"
      },
      {
        id: "read-contract",
        title: "Read Proxy Contract",
        description: "Read and inspect the ValidatorManager contract data",
        path: "/console/permissioned-l1s/read-contract"
      }
    ]
  },
  {
    id: "manage-validators",
    title: "Manage Validators Flow",
    steps: [
      {
        id: "add-validator",
        title: "Add Validator",
        description: "Add a new validator to the L1",
        path: "/console/permissioned-l1s/add-validator"
      },
      {
        id: "change-weight",
        title: "Change Weight",
        description: "Modify a validator's weight",
        path: "/console/permissioned-l1s/change-weight"
      },
      {
        id: "remove-validator",
        title: "Remove Validator",
        description: "Remove a validator from the L1",
        path: "/console/permissioned-l1s/remove-validator"
      },
      {
        id: "query-validators",
        title: "Query L1 Validator Set",
        description: "View all validators on the L1",
        path: "/console/permissioned-l1s/query-validators"
      },
      {
        id: "balance-topup",
        title: "Validator Balance Topup",
        description: "Increase a validator's balance",
        path: "/console/permissioned-l1s/balance-topup"
      }
    ]
  },
  {
    id: "permissionless-migrate",
    title: "Migrate from Permissioned L1 Flow",
    steps: [
      {
        id: "deploy-reward-manager",
        title: "Deploy Reward Manager",
        description: "Set up reward distribution",
        path: "/console/permissionless-l1s/deploy-reward-manager"
      },
      {
        id: "deploy-staking-manager",
        title: "Deploy Staking Manager",
        description: "Enable proof-of-stake validation",
        path: "/console/permissionless-l1s/deploy-staking-manager"
      },
      {
        id: "initialize-staking-manager",
        title: "Initialize Staking Manager",
        description: "Configure staking parameters",
        path: "/console/permissionless-l1s/initialize-staking-manager"
      },
      {
        id: "transfer-ownership",
        title: "Transfer VMC Ownership to Staking Manager",
        description: "Transfer control to staking manager",
        path: "/console/permissionless-l1s/transfer-ownership"
      }
    ]
  },
  {
    id: "icm",
    title: "ICM Setup Flow",
    steps: [
      {
        id: "deploy-contracts",
        title: "ICM Contracts Deployment",
        description: "Deploy core messaging contracts",
        path: "/console/icm/deploy-contracts"
      },
      {
        id: "deploy-registry",
        title: "ICM Registry Deployment", 
        description: "Deploy ICM registry contract",
        path: "/console/icm/deploy-registry"
      },
      {
        id: "relayer-setup",
        title: "ICM Relayer Setup",
        description: "Configure message relayer", 
        path: "/console/icm/relayer-setup"
      }
    ]
  },
  {
    id: "icm-test",
    title: "ICM Test Message Flow",
    steps: [
      {
        id: "deploy-demo",
        title: "Demo Contract Deployment",
        description: "Deploy example messaging contract",
        path: "/console/icm/deploy-demo"
      },
      {
        id: "send-test-message", 
        title: "Send Test Message",
        description: "Test cross-chain messaging",
        path: "/console/icm/send-test-message"
      }
    ]
  },
  {
    id: "ictt-bridge",
    title: "ICTT Bridge Setup Flow",
    steps: [
      {
        id: "deploy-native-home",
        title: "Deploy Native Token Home",
        description: "Deploy the native token home contract",
        path: "/console/ictt/deploy-native-home",
        alternatives: [
          {
            id: "deploy-native-home",
            title: "Deploy Native Token Home",
            description: "Deploy native token bridge contract",
            path: "/console/ictt/deploy-native-home"
          },
          {
            id: "deploy-erc20-home",
            title: "Deploy ERC-20 Token Home", 
            description: "Deploy ERC-20 token bridge contract",
            path: "/console/ictt/deploy-erc20-home"
          }
        ]
      },
      {
        id: "deploy-remote",
        title: "Deploy Token Remote",
        description: "Deploy the remote token contract",
        path: "/console/ictt/deploy-remote",
        alternatives: [
          {
            id: "deploy-native-remote",
            title: "Deploy Native Token Remote",
            description: "Deploy native token remote contract",
            path: "/console/ictt/deploy-native-remote"
          },
          {
            id: "deploy-erc20-remote", 
            title: "Deploy ERC-20 Token Remote",
            description: "Deploy ERC-20 token remote contract",
            path: "/console/ictt/deploy-erc20-remote"
          }
        ]
      },
      {
        id: "register-remote",
        title: "Register Remote with Home",
        description: "Register the remote contract with home",
        path: "/console/ictt/register-remote"
      },
      {
        id: "deposit-collateral",
        title: "Deposit Collateral with Home",
        description: "Deposit required collateral for bridge operation",
        path: "/console/ictt/deposit-collateral"
      }
    ]
  },
  {
    id: "utilities",
    title: "Developer Utilities",
    steps: [
      {
        id: "format-converter",
        title: "Format Converter",
        description: "Convert between different data formats",
        path: "/console/utilities/format-converter"
      }
    ]
  }
];

interface FlowNavigationProps {
  currentPath: string;
}

// Helper function to handle step clicks (works with both regular steps and alternatives)
const handleStepClick = (router: any, step: FlowStep | AlternativeStep, currentFlowId?: string) => {
  let path = step.path;
  
  // Add flow context for node setup flows
  if (currentFlowId === "layer-1-node" && step.path.includes("layer-1")) {
    const url = new URL(step.path, window.location.origin);
    url.searchParams.set('flow', 'node-setup');
    path = url.pathname + url.search;
  } else if (currentFlowId === "primary-network-node" && step.path.includes("primary-network")) {
    const url = new URL(step.path, window.location.origin);
    url.searchParams.set('flow', 'node-setup');
    path = url.pathname + url.search;
  } else if (currentFlowId === "validator-manager" && step.path.includes("permissioned-l1s")) {
    const url = new URL(step.path, window.location.origin);
    url.searchParams.set('flow', 'validator-manager');
    path = url.pathname + url.search;
  } else if (currentFlowId === "manage-validators" && step.path.includes("permissioned-l1s")) {
    const url = new URL(step.path, window.location.origin);
    url.searchParams.set('flow', 'manage-validators');
    path = url.pathname + url.search;
  } else if (currentFlowId === "permissionless-migrate" && step.path.includes("permissionless-l1s")) {
    const url = new URL(step.path, window.location.origin);
    url.searchParams.set('flow', 'migrate');
    path = url.pathname + url.search;
  }
  
  router.push(path);
};

export function FlowNavigation({ currentPath }: FlowNavigationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isTestnet } = useWalletStore();

  // Dynamic sizing based on number of steps
  const getStepSizing = (stepCount: number) => {
    if (stepCount <= 3) {
      return "min-w-[180px] w-auto max-w-none sm:min-w-[200px] lg:min-w-[220px] xl:min-w-[240px]";
    } else if (stepCount <= 4) {
      return "min-w-[150px] w-auto max-w-none sm:min-w-[170px] lg:min-w-[190px] xl:min-w-[210px]";
    } else if (stepCount <= 5) {
      return "min-w-[130px] w-auto max-w-[200px] sm:min-w-[140px] lg:min-w-[160px] xl:min-w-[180px]";
    } else if (stepCount <= 6) {
      return "min-w-[110px] w-auto max-w-[180px] sm:min-w-[120px] lg:min-w-[140px] xl:min-w-[160px]";
    } else {
      return "min-w-[100px] w-auto max-w-[160px] sm:min-w-[110px] lg:min-w-[120px] xl:min-w-[140px]";
    }
  };
  
  // Extract category and tool from current path
  const pathParts = currentPath.split('/').filter(Boolean);
  const category = pathParts[1]; // e.g., "layer-1s"
  const tool = pathParts[2]; // e.g., "create-chain"
  
  // Find the current flow
  let currentFlow = flows.find(flow => flow.id === category);
  
  // Special handling for ICM flows - determine which flow based on the tool
  if (category === "icm") {
    const setupTools = ["deploy-contracts", "deploy-registry", "relayer-setup"];
    const testTools = ["deploy-demo", "send-test-message"];
    
    if (setupTools.includes(tool)) {
      currentFlow = flows.find(flow => flow.id === "icm");
    } else if (testTools.includes(tool)) {
      currentFlow = flows.find(flow => flow.id === "icm-test");
    }
  }
  
  // Special handling for Primary Network flows
  if (category === "primary-network") {
    const nodeSetupTools = ["node-setup", "rpc-security-check", "performance-check"];
    const standaloneTools = ["faucet", "bridge", "unit-converter"];
    
    if (nodeSetupTools.includes(tool)) {
      const flowContext = searchParams.get('flow');
      if (flowContext === 'node-setup') {
        currentFlow = flows.find(flow => flow.id === "primary-network-node");
      }
    }
    // For standalone tools, currentFlow will remain null and no flow navigation will show
  }
  
  // Special handling for Layer 1 flows - determine which flow based on the tool and context
  if (category === "layer-1") {
    const createTools = ["create", "convert-to-l1"];
    const pureNodeSetupTools = ["rpc-security-check", "performance-check"];
    const standaloneTools = ["explorer-setup", "manage-tx-fees"];
    
    if (createTools.includes(tool) || tool === "node-setup-managed") {
      currentFlow = flows.find(flow => flow.id === "layer-1-create");
    } else if (tool === "node-setup") {
      // For node-setup, determine context based on URL params or referrer
      const flowContext = searchParams.get('flow');
      if (flowContext === 'node-setup') {
        currentFlow = flows.find(flow => flow.id === "layer-1-node");
      } else {
        // Default to create flow since node-setup is primarily part of the create process
        currentFlow = flows.find(flow => flow.id === "layer-1-create");
      }
    } else if (pureNodeSetupTools.includes(tool)) {
      currentFlow = flows.find(flow => flow.id === "layer-1-node");
    }
    // For standalone tools (explorer-setup, manage-tx-fees), currentFlow will remain null and no flow navigation will show
  }
  
  // Special handling for Permissioned L1s - determine which flow based on the tool
  if (category === "permissioned-l1s") {
    const validatorManagerTools = ["validator-manager-setup", "upgrade-proxy", "initialize", "init-validator-set", "read-contract"];
    const manageValidatorTools = ["add-validator", "change-weight", "remove-validator", "query-validators", "balance-topup"];
    const standaloneTools = ["deployer-allowlist", "transactor-allowlist"];
    
    if (validatorManagerTools.includes(tool)) {
      currentFlow = flows.find(flow => flow.id === "validator-manager");
    } else if (manageValidatorTools.includes(tool)) {
      const flowContext = searchParams.get('flow');
      if (flowContext === 'manage-validators') {
        currentFlow = flows.find(flow => flow.id === "manage-validators");
      }
    }
    // For standalone tools, currentFlow will remain null and no flow navigation will show
  }
  
  // Special handling for Permissionless L1s - determine if it's migration flow
  if (category === "permissionless-l1s") {
    const migrationTools = ["deploy-reward-manager", "deploy-staking-manager", "initialize-staking-manager", "transfer-ownership"];
    const standaloneTools = ["manage-validators"];
    
    if (migrationTools.includes(tool)) {
      const flowContext = searchParams.get('flow');
      if (flowContext === 'migrate') {
        currentFlow = flows.find(flow => flow.id === "permissionless-migrate");
      }
    }
    // For standalone tools, currentFlow will remain null and no flow navigation will show
  }
  
  // Special handling for ICTT - bridge setup flow
  if (category === "ictt") {
    const bridgeSetupTools = ["deploy-native-home", "deploy-erc20-home", "deploy-native-remote", "deploy-erc20-remote", "register-remote", "deposit-collateral"];
    
    if (bridgeSetupTools.includes(tool)) {
      currentFlow = flows.find(flow => flow.id === "ictt-bridge");
    }
  }
  
  if (!currentFlow) {
    return null;
  }

  // Get dynamic sizing based on number of steps
  const stepSizing = getStepSizing(currentFlow.steps.length);
  
  // Dynamic gap sizing
  const getGapSizing = (stepCount: number) => {
    if (stepCount <= 4) {
      return "gap-2 sm:gap-3 lg:gap-4";
    } else if (stepCount <= 6) {
      return "gap-1 sm:gap-2 lg:gap-3";
    } else {
      return "gap-1 sm:gap-1 lg:gap-2";
    }
  };
  
  const gapSizing = getGapSizing(currentFlow.steps.length);
  
  // Dynamic text sizing for many steps
  const getTextSizing = (stepCount: number) => {
    if (stepCount <= 4) {
      return {
        title: "text-xs font-medium leading-snug",
        description: "text-xs leading-snug"
      };
    } else if (stepCount <= 6) {
      return {
        title: "text-xs font-medium leading-tight",
        description: "text-[10px] leading-tight"
      };
    } else {
      return {
        title: "text-[10px] font-medium leading-tight",
        description: "text-[9px] leading-tight"
      };
    }
  };
  
  const textSizing = getTextSizing(currentFlow.steps.length);
  
  // Find current step index (including alternatives)
  const currentStepIndex = currentFlow.steps.findIndex(step => {
    // Check main step
    if (currentPath.includes(step.id)) return true;
    // Check alternatives
    if (step.alternatives) {
      return step.alternatives.some(alt => currentPath.includes(alt.id));
    }
    return false;
  });
  

  
  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) return "completed";
    if (stepIndex === currentStepIndex) return "current";
    return "upcoming";
  };
  
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-4 py-3 sm:px-6 sm:py-4">
        <div className="mb-2">
          <h3 className="text-sm font-medium text-foreground">{currentFlow.title}</h3>
        </div>
        
        <div className={`flex items-center justify-center pb-2 flex-wrap lg:flex-nowrap ${gapSizing}`}>
          {currentFlow.steps.map((step, index) => {
            const status = getStepStatus(index);
            
            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-2">
                  {/* Main step or alternatives */}
                  {step.alternatives ? (
                    <div className={`flex flex-col gap-3 ${stepSizing} relative`}>
                      {step.alternatives.map((alt, altIndex) => {
                        const isCurrentAlt = currentPath.includes(alt.id);
                        const altStatus = isCurrentAlt ? "current" : "upcoming";
                        
                        // Check if this is BuilderHub Managed Nodes and we're in mainnet mode
                        const isBuilderhubManagedNodes = alt.id === "node-setup-managed";
                        const isDisabledInMainnet = isBuilderhubManagedNodes && isTestnet === false;
                        
                        return (
                          <div key={alt.id}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => !isDisabledInMainnet && handleStepClick(router, alt, currentFlow.id)}
                              disabled={isDisabledInMainnet}
                              className={`relative h-auto p-3 flex flex-col items-start w-full border ${
                                isDisabledInMainnet 
                                  ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700"
                                  : altStatus === "current" 
                                    ? "bg-sky-100 border-sky-300 text-sky-800 hover:bg-sky-200 dark:bg-sky-900/20 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-900/30" 
                                    : "border-border hover:border-muted-foreground/30"
                              }`}
                            >
                              <div className="flex items-center gap-2 w-full min-w-0">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  isDisabledInMainnet ? "bg-gray-300" :
                                  altStatus === "current" ? "bg-sky-600 dark:bg-sky-400" :
                                  "bg-gray-300"
                                }`} />
                                <span className={`${textSizing.title} text-left break-words flex-1 min-w-0 whitespace-normal`}>{alt.title}</span>
                              </div>
                              {alt.description && (
                                <p className={`${textSizing.description} text-muted-foreground text-left mt-1 break-words whitespace-normal`}>
                                  {alt.description}
                                  {isDisabledInMainnet && (
                                    <span className="block text-orange-600 dark:text-orange-400 font-medium mt-1">
                                      (Testnet only)
                                    </span>
                                  )}
                                </p>
                              )}
                            </Button>
                            {altIndex === 0 && step.alternatives && step.alternatives.length > 1 && (
                              <div className="flex justify-center py-1">
                                <div className="flex items-center justify-center p-1">
                                  <MoveVertical className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Button
                      variant={status === "current" ? "outline" : status === "completed" ? "outline" : "outline"}
                      size="sm"
                      onClick={() => handleStepClick(router, step, currentFlow.id)}
                      className={`relative h-auto p-3 flex flex-col items-start ${stepSizing} border ${
                        status === "current" 
                          ? "bg-sky-100 border-sky-300 text-sky-800 hover:bg-sky-200 dark:bg-sky-900/20 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-900/30" 
                          : status === "completed"
                            ? "bg-green-50 border-green-200 text-green-800 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/30"
                            : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          status === "completed" ? "bg-green-500" :
                          status === "current" ? "bg-sky-600 dark:bg-sky-400" :
                          "bg-gray-300"
                        }`} />
                        <span className={`${textSizing.title} text-left break-words flex-1 min-w-0 whitespace-normal`}>{step.title}</span>
                        {step.isOptional && (
                          <span className="text-xs text-muted-foreground">(Optional)</span>
                        )}
                      </div>
                      {step.description && (
                        <p className={`${textSizing.description} text-muted-foreground text-left mt-1 break-words whitespace-normal`}>
                          {step.description}
                        </p>
                      )}
                    </Button>
                  )}
                </div>
                
                {index < currentFlow.steps.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mx-1 hidden lg:block" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}