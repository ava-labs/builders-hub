'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { L1HealthState } from '@/hooks/useL1Health';
import { useL1ValidatorSet } from '@/hooks/useL1ValidatorSet';
import { useL1ActivePrecompiles } from '@/hooks/useL1ActivePrecompiles';
import { sectionContainer, sectionItem } from '@/components/console/motion';
import { isPrimaryNetwork, type CombinedL1 } from '@/lib/console/my-l1/types';
import { setupSummary } from '@/lib/console/my-l1/setup-steps';
import { useL1ValidatorManager } from '@/lib/console/my-l1/useL1ValidatorManager';
import { StatsGrid } from './StatsGrid';
import { LiveCharts } from './LiveCharts';
import { NextActionBar } from './SetupProgress';
import { SetupStatusPill } from './SetupStatusPill';
import { PrimaryNetworkActions, QuickActionsCard, WalletOnlyActions } from './QuickActions';
import { NetworkDetailsCard } from './NetworkDetailsCard';
import { NodeListCard } from './NodeList';
import { PrecompilesSection } from './PrecompilesSection';

// `health` is threaded in from `DashboardBody` so the page only owns one
// `useL1Health` subscription — both the HeroCard pulse dot and the StatsGrid
// below read the same probe instead of each mounting their own poll.
export function L1Details({
  l1,
  health,
  userActiveNodeTotal,
  onRefetch,
}: {
  l1: CombinedL1;
  health: L1HealthState;
  userActiveNodeTotal: number;
  onRefetch: () => void;
}) {
  const validators = useL1ValidatorSet(l1.subnetId, l1.isTestnet);
  const validatorManager = useL1ValidatorManager(l1);
  // C-Chain runs coreth (not subnet-EVM) and won't expose
  // eth_getActiveRulesAt — skip the Precompiles section entirely.
  const isPrimary = isPrimaryNetwork(l1);
  const precompiles = useL1ActivePrecompiles(l1.rpcUrl, !isPrimary);
  const isManaged = l1.source === 'managed';
  const setup = setupSummary(l1);
  const isComplete = setup.pct === 100;

  return (
    <motion.div
      className="space-y-5"
      variants={sectionContainer}
      initial="hidden"
      animate="visible"
    >
      {/* HeroCard above already owns chain identity, balance, and primary
          actions. The "needs attention" CTA + setup status badge stay just
          above NetworkDetailsCard so the urgent next step is visible the
          moment the user finishes scanning the hero. */}
      {!isPrimary && !isComplete && (
        <motion.div variants={sectionItem} className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[260px]">
            <NextActionBar l1={l1} />
          </div>
          <div className="shrink-0 self-center">
            <SetupStatusPill l1={l1} />
          </div>
        </motion.div>
      )}

      {/* Reference data the user copies most (RPC URL, subnet/blockchain/EVM
          chain IDs) lives right under the hero so it's reachable in one
          click. Stays collapsed by default to keep visual weight on Health. */}
      <motion.div variants={sectionItem}>
        <NetworkDetailsCard l1={l1} validatorManager={validatorManager} />
      </motion.div>

      <DashboardSection title="Health">
        <StatsGrid l1={l1} health={health} validators={validators} />
      </DashboardSection>

      <motion.div variants={sectionItem}>
        <LiveCharts l1={l1} />
      </motion.div>

      {isManaged && (
        // Always render for managed L1s — even when the node array is empty
        // (e.g. nodes expired). The card itself renders an empty state in
        // that case so the user clearly sees the L1 is dark, rather than
        // the whole section silently disappearing.
        <DashboardSection title="Node fleet">
          <NodeListCard
            l1={l1}
            userActiveTotal={userActiveNodeTotal}
            onRefetch={onRefetch}
            validators={validators}
            validatorManagerKind={validatorManager.kind}
          />
        </DashboardSection>
      )}

      <DashboardSection title="Tools">
        {isPrimary ? (
          <PrimaryNetworkActions l1={l1} />
        ) : isManaged ? (
          <QuickActionsCard l1={l1} validatorManagerKind={validatorManager.kind} />
        ) : (
          <WalletOnlyActions l1={l1} validatorManagerKind={validatorManager.kind} />
        )}
      </DashboardSection>

      {!isPrimary && (
        <DashboardSection title="Precompiles">
          <PrecompilesSection l1={l1} state={precompiles} />
        </DashboardSection>
      )}
    </motion.div>
  );
}

function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <motion.section className="space-y-3" variants={sectionItem}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </motion.section>
  );
}
