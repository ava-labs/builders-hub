"use client";

import React from "react";
import type { ComponentName } from "./catalog";

/**
 * Chat component registry — maps catalog component names to lazily-loaded
 * React components. Each entry is wrapped in React.lazy() for code splitting.
 *
 * Console flow components use the ChatStepFlow wrapper which manages step
 * navigation in memory (no URL routing).
 */

// Helper to create a lazy ChatStepFlow loader for a given steps module
function lazyFlow(
  title: string,
  importSteps: () => Promise<{ steps: any[] }>,
) {
  return React.lazy(async () => {
    const [{ default: ChatStepFlow }, { steps }] = await Promise.all([
      import("@/components/chat/flows/chat-step-flow"),
      importSteps(),
    ]);
    // Return a component that renders ChatStepFlow with these steps
    return {
      default: (props: { startAtStep?: string }) => (
        <ChatStepFlow title={title} steps={steps} startAtStep={props.startAtStep} />
      ),
    };
  });
}

// Helper to lazy-load a standalone tool component
function lazyTool(importComponent: () => Promise<{ default: React.ComponentType<any> }>) {
  return React.lazy(importComponent);
}

// ─── Registry Map ───────────────────────────────────────────────────────────

export const componentRegistry: Record<ComponentName, React.LazyExoticComponent<React.ComponentType<any>>> = {
  // Console Flows
  CreateL1Flow: lazyFlow("Create New L1", () => import("@/app/console/layer-1/create/steps")),
  ValidatorManagerSetup: lazyFlow("Validator Manager Setup", () => import("@/app/console/permissioned-l1s/validator-manager-setup/steps")),
  StakingManagerSetup: lazyFlow("Staking Manager Setup", () => import("@/app/console/permissionless-l1s/staking-manager-setup/steps")),
  StakeValidator: lazyFlow("Stake Validator", () => import("@/app/console/permissionless-l1s/stake/steps")),
  DelegateStake: lazyFlow("Delegate Stake", () => import("@/app/console/permissionless-l1s/delegate/steps")),
  RemoveDelegation: lazyFlow("Remove Delegation", () => import("@/app/console/permissionless-l1s/remove-delegation/steps")),
  RemoveValidator: lazyFlow("Remove Validator", () => import("@/app/console/permissionless-l1s/remove-validator/steps")),
  MultisigSetup: lazyFlow("Multisig Setup", () => import("@/app/console/permissioned-l1s/multisig-setup/steps")),
  ICMSetup: lazyFlow("ICM Setup", () => import("@/app/console/icm/setup/steps")),
  ICMTestConnection: lazyFlow("ICM Test Connection", () => import("@/app/console/icm/test-connection/steps")),
  ICTTSetup: lazyFlow("ICTT Setup", () => import("@/app/console/ictt/setup/steps")),
  ICTTTokenTransfer: lazyFlow("ICTT Token Transfer", () => import("@/app/console/ictt/token-transfer/steps")),
  VMCMigration: lazyFlow("VMC Migration", () => import("@/app/console/utilities/vmcMigrateFromV1/steps")),

  // Single-Page Console Tools
  FeeManager: lazyTool(() => import("@/components/toolbox/console/l1-tokenomics/FeeManager")),
  NativeMinter: lazyTool(() => import("@/components/toolbox/console/l1-tokenomics/NativeMinter")),
  RewardManager: lazyTool(() => import("@/components/toolbox/console/l1-tokenomics/RewardManager")),
  DeployerAllowList: lazyTool(() => import("@/components/toolbox/console/l1-access-restrictions/DeployerAllowlist")),
  TransactorAllowList: lazyTool(() => import("@/components/toolbox/console/l1-access-restrictions/TransactionAllowlist")),
  Faucet: lazyTool(() => import("@/components/toolbox/console/primary-network/Faucet")),
  CPBridge: lazyTool(() => import("@/components/toolbox/console/primary-network/CrossChainTransfer")),
  UnitConverter: lazyTool(() => import("@/components/toolbox/console/primary-network/UnitConverter")),

  // Metrics & Visualization (self-contained, fetch own data)
  OverviewStats: lazyTool(() =>
    import("@/components/chat/flows/metrics-wrappers").then((m) => ({ default: m.OverviewStatsCard }))
  ),
  LiveBlockBurns: lazyTool(() =>
    import("@/components/stats/LiveBlockBurns").then((m) => ({ default: m.LiveBlockBurns }))
  ),
  ICMFlowDiagram: lazyTool(() =>
    import("@/components/chat/flows/metrics-wrappers").then((m) => ({ default: m.ICMFlowWrapper }))
  ),
  ICTTDashboard: lazyTool(() =>
    import("@/components/chat/flows/metrics-wrappers").then((m) => ({ default: m.ICTTDashboardWrapper }))
  ),

  // Media
  YouTubeEmbed: lazyTool(() => import("@/components/chat/youtube-embed")),
};
