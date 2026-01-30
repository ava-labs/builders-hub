import { type StepDefinition } from "@/components/console/step-flow";

/**
 * Represents a suggested next step after completing a flow
 */
export type FlowNextStep = {
  path: string;
  title: string;
  description: string;
  priority: "recommended" | "optional";
};

/**
 * Metadata for a console flow including completion summary and next steps
 */
export type FlowMetadata = {
  title: string;
  completionSummary: string;
  /** Optional custom accomplishments. If omitted, auto-generated from step titles */
  accomplishments?: string[];
  nextSteps: FlowNextStep[];
};

/**
 * Central registry of all console flows with their metadata.
 * Key is derived from basePath: "/console/layer-1/create" → "layer-1/create"
 */
export const consoleFlows: Record<string, FlowMetadata> = {
  "layer-1/create": {
    title: "Create New L1",
    completionSummary: "You've successfully created and launched your Avalanche L1!",
    nextSteps: [
      {
        path: "/console/permissioned-l1s/validator-manager-setup",
        title: "Deploy Validator Manager",
        description: "Set up on-chain validator management for your L1",
        priority: "recommended",
      },
      {
        path: "/console/icm/setup",
        title: "Setup Cross-Chain Messaging",
        description: "Enable communication between your L1 and other chains",
        priority: "recommended",
      },
      {
        path: "/console/ictt/setup",
        title: "Setup Token Bridge",
        description: "Deploy a bridge to transfer tokens to/from your L1",
        priority: "optional",
      },
    ],
  },

  "permissioned-l1s/validator-manager-setup": {
    title: "Validator Manager Setup",
    completionSummary: "You've successfully deployed and configured your Validator Manager!",
    nextSteps: [
      {
        path: "/console/permissioned-l1s/multisig-setup",
        title: "Setup Multisig Governance",
        description: "Add multi-signature security to your validator management",
        priority: "recommended",
      },
      {
        path: "/console/permissioned-l1s/add-validator",
        title: "Add Validators",
        description: "Register additional validators for your L1 network",
        priority: "recommended",
      },
      {
        path: "/console/icm/setup",
        title: "Setup Cross-Chain Messaging",
        description: "Enable interchain communication for your L1",
        priority: "optional",
      },
    ],
  },

  "permissioned-l1s/multisig-setup": {
    title: "Multisig Setup",
    completionSummary: "You've successfully configured multisig governance for your L1!",
    nextSteps: [
      {
        path: "/console/permissioned-l1s/add-validator",
        title: "Add Validators",
        description: "Register validators using your new multisig setup",
        priority: "recommended",
      },
      {
        path: "/console/permissioned-l1s/change-validator-weight",
        title: "Manage Validator Weights",
        description: "Adjust voting power of your validators",
        priority: "optional",
      },
    ],
  },

  "icm/setup": {
    title: "ICM Setup",
    completionSummary: "You've successfully set up Interchain Messaging for your L1!",
    nextSteps: [
      {
        path: "/console/icm/test-connection",
        title: "Test ICM Connection",
        description: "Verify your cross-chain messaging setup works correctly",
        priority: "recommended",
      },
      {
        path: "/console/ictt/setup",
        title: "Setup Token Bridge",
        description: "Enable cross-chain token transfers using ICM",
        priority: "recommended",
      },
    ],
  },

  "icm/test-connection": {
    title: "ICM Test Connection",
    completionSummary: "You've successfully tested your Interchain Messaging connection!",
    nextSteps: [
      {
        path: "/console/ictt/setup",
        title: "Setup Token Bridge",
        description: "Deploy cross-chain token transfer infrastructure",
        priority: "recommended",
      },
      {
        path: "/console",
        title: "Return to Console",
        description: "Explore other tools and features",
        priority: "optional",
      },
    ],
  },

  "ictt/setup": {
    title: "ICTT Setup",
    completionSummary: "You've successfully deployed your Interchain Token Transfer bridge!",
    nextSteps: [
      {
        path: "/console/ictt/token-transfer",
        title: "Transfer Tokens",
        description: "Test your bridge by transferring tokens across chains",
        priority: "recommended",
      },
      {
        path: "/console",
        title: "Return to Console",
        description: "Explore other tools and features",
        priority: "optional",
      },
    ],
  },

  "ictt/token-transfer": {
    title: "Token Transfer",
    completionSummary: "You've successfully transferred tokens across chains!",
    nextSteps: [
      {
        path: "/console/ictt/setup",
        title: "Setup Another Bridge",
        description: "Deploy additional token bridges for other assets",
        priority: "optional",
      },
      {
        path: "/console",
        title: "Return to Console",
        description: "Explore other tools and features",
        priority: "optional",
      },
    ],
  },

  "utilities/vmcMigrateFromV1": {
    title: "VMC Migration",
    completionSummary: "You've successfully migrated your Validator Manager Contract!",
    nextSteps: [
      {
        path: "/console/permissioned-l1s/validator-manager-setup/read-contract",
        title: "Verify Migration",
        description: "Read the migrated contract state to confirm success",
        priority: "recommended",
      },
      {
        path: "/console",
        title: "Return to Console",
        description: "Explore other tools and features",
        priority: "optional",
      },
    ],
  },

  "permissionless-l1s/native-staking-manager-setup": {
    title: "Native Staking Manager Setup",
    completionSummary: "You've successfully deployed your Native Staking Manager!",
    nextSteps: [
      {
        path: "/console/permissioned-l1s/add-validator",
        title: "Add Validators",
        description: "Register validators for your permissionless L1",
        priority: "recommended",
      },
      {
        path: "/console/icm/setup",
        title: "Setup Cross-Chain Messaging",
        description: "Enable interchain communication for your L1",
        priority: "optional",
      },
    ],
  },
};

/**
 * Extract flow key from basePath
 * @example getFlowKey("/console/layer-1/create") → "layer-1/create"
 */
export function getFlowKey(basePath: string): string {
  return basePath.replace("/console/", "");
}

/**
 * Generate accomplishments list from step definitions
 * Auto-generates "Completed: {title}" for each step
 */
export function generateAccomplishments(steps: StepDefinition[]): string[] {
  return steps.map((step) => `Completed: ${step.title}`);
}

/**
 * Get flow metadata with auto-generated accomplishments if not specified
 * @returns FlowMetadata or null if flow not found in registry
 */
export function getFlowMetadata(
  basePath: string,
  steps: StepDefinition[]
): (FlowMetadata & { accomplishments: string[] }) | null {
  const key = getFlowKey(basePath);
  const metadata = consoleFlows[key];

  if (!metadata) return null;

  return {
    ...metadata,
    accomplishments: metadata.accomplishments ?? generateAccomplishments(steps),
  };
}
