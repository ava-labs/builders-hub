/**
 * Chat component catalog — defines all components the AI can render inline.
 *
 * Each entry has a Zod schema for props validation (used by the render_component tool)
 * and a description that helps the AI decide when to use it.
 */
import { z } from "zod";

// ─── Console Flow Components ───────────────────────────────────────────────
// Multi-step flows rendered via ChatStepFlow wrapper

export const consoleFlowComponents = {
  CreateL1Flow: {
    props: z.object({
      startAtStep: z.string().optional(),
    }),
    description: "Full Create L1 flow — Create Subnet → Create Chain → Node Setup → Convert to L1. Use when a user wants to launch a new Avalanche L1.",
  },
  ValidatorManagerSetup: {
    props: z.object({}),
    description: "Deploy and configure a Validator Manager contract for an L1. Use after creating an L1.",
  },
  NativeStakingManagerSetup: {
    props: z.object({}),
    description: "Deploy and initialize a Native Token Staking Manager. Use for permissionless L1 staking with native tokens.",
  },
  ERC20StakingManagerSetup: {
    props: z.object({}),
    description: "Deploy and initialize an ERC20 Token Staking Manager. Use for permissionless L1 staking with custom ERC20 tokens.",
  },
  StakeNativeValidator: {
    props: z.object({}),
    description: "Stake native tokens to register as a validator on a permissionless L1.",
  },
  StakeERC20Validator: {
    props: z.object({}),
    description: "Stake ERC20 tokens to register as a validator on a permissionless L1.",
  },
  DelegateStake: {
    props: z.object({}),
    description: "Delegate stake to an existing validator on a permissionless L1.",
  },
  RemoveDelegation: {
    props: z.object({}),
    description: "Remove a delegation from a validator.",
  },
  RemoveValidator: {
    props: z.object({}),
    description: "Remove a validator from a permissionless L1.",
  },
  MultisigSetup: {
    props: z.object({}),
    description: "Configure multisig governance for validator management.",
  },
  ICMSetup: {
    props: z.object({}),
    description: "Set up Interchain Messaging (ICM/Teleporter) between L1s. Deploys Teleporter Messenger, Registry, and Relayer.",
  },
  ICMTestConnection: {
    props: z.object({}),
    description: "Test an ICM connection between two chains to verify cross-chain messaging works.",
  },
  ICTTSetup: {
    props: z.object({}),
    description: "Set up Interchain Token Transfer (ICTT) bridge infrastructure.",
  },
  ICTTTokenTransfer: {
    props: z.object({}),
    description: "Transfer tokens across chains using an ICTT bridge.",
  },
  VMCMigration: {
    props: z.object({}),
    description: "Migrate a Validator Manager Contract from V1 to V2.",
  },
} as const;

// ─── Single-Page Console Tools ──────────────────────────────────────────────
// Standalone tools that don't use multi-step flows

export const singleToolComponents = {
  FeeManager: {
    props: z.object({}),
    description: "Configure gas fee parameters for an L1 (min base fee, target gas, etc.).",
  },
  NativeMinter: {
    props: z.object({}),
    description: "Mint native tokens on an L1 using the Native Minter precompile.",
  },
  RewardManager: {
    props: z.object({}),
    description: "Configure staking reward parameters for an L1.",
  },
  DeployerAllowList: {
    props: z.object({}),
    description: "Manage which addresses can deploy contracts on an L1.",
  },
  TransactorAllowList: {
    props: z.object({}),
    description: "Manage which addresses can submit transactions on an L1.",
  },
  Faucet: {
    props: z.object({}),
    description: "Get testnet AVAX from the faucet. Use when a user needs test tokens.",
  },
  CPBridge: {
    props: z.object({}),
    description: "Transfer AVAX between C-Chain and P-Chain.",
  },
  UnitConverter: {
    props: z.object({}),
    description: "Convert between AVAX denominations (nAVAX, wei, gwei, AVAX).",
  },
} as const;

// ─── Metrics & Visualization Components ──────────────────────────────────────
// Self-contained components that fetch their own data from /api/* endpoints

export const metricsComponents = {
  OverviewStats: {
    props: z.object({}),
    description: "Show Avalanche network overview stats: active addresses, transactions, TPS, validators, ICM messages, market cap, plus a top chains table. Use for questions about network health, activity, or 'how many active accounts'.",
  },
  LiveBlockBurns: {
    props: z.object({}),
    description: "Live real-time C-Chain block feed showing AVAX burned per block. Updates every 2.5 seconds. Use when asking about fees, burns, or real-time activity.",
  },
  ICMFlowDiagram: {
    props: z.object({}),
    description: "Interactive Sankey diagram showing Interchain Messaging (ICM) traffic flows between chains. Animated particles show message volume. Use for cross-chain messaging analytics.",
  },
  ICTTDashboard: {
    props: z.object({}),
    description: "Interchain Token Transfer (ICTT) dashboard with transfer volume charts, token distribution, and active routes. Use for bridge/transfer analytics.",
  },
} as const;

// ─── Media Components ───────────────────────────────────────────────────────

export const mediaComponents = {
  YouTubeEmbed: {
    props: z.object({
      videoId: z.string().describe("YouTube video ID (e.g. 'dRZTt0yGWBw')"),
      title: z.string().optional().describe("Video title for accessibility"),
    }),
    description: "Embed a YouTube video inline. Use when recommending Avalanche tutorial or explainer videos.",
  },
  DocImage: {
    props: z.object({
      src: z.string().describe("Image path from docs (e.g. '/images/avalanche-consensus1.png' or full https URL)"),
      alt: z.string().optional().describe("Image description / caption"),
    }),
    description: "Show a diagram or screenshot from the documentation inline. Use when the doc context contains images (![alt](/images/...)) that help illustrate the answer — architecture diagrams, flow charts, UI screenshots.",
  },
} as const;

// ─── Full Catalog ───────────────────────────────────────────────────────────

export const componentCatalog = {
  ...consoleFlowComponents,
  ...singleToolComponents,
  ...metricsComponents,
  ...mediaComponents,
} as const;

// Type-safe component name union
export type ComponentName = keyof typeof componentCatalog;

// All component names as an array (used for the tool's z.enum)
export const componentNames = Object.keys(componentCatalog) as [ComponentName, ...ComponentName[]];

// Build a description list for the AI system prompt
export function getCatalogDescription(): string {
  return Object.entries(componentCatalog)
    .map(([name, { description }]) => `- **${name}**: ${description}`)
    .join("\n");
}
