'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useL1Health } from '@/hooks/useL1Health';
import { useL1ValidatorCount } from '@/hooks/useL1ValidatorCount';
import { sectionContainer, sectionItem } from '@/components/console/motion';
import type { CombinedL1 } from '../_lib/types';
import { setupSummary } from '../_lib/setup-steps';
import { DetailHeader } from './DetailHeader';
import { StatsGrid } from './StatsGrid';
import { LiveCharts } from './LiveCharts';
import { NextActionBar } from './SetupProgress';
import { QuickActionsCard, WalletOnlyActions } from './QuickActions';
import { NetworkDetailsCard } from './NetworkDetailsCard';
import { NodeListCard } from './NodeList';

export function L1Details({
  l1,
  userActiveNodeTotal,
  onRefetch,
}: {
  l1: CombinedL1;
  userActiveNodeTotal: number;
  onRefetch: () => void;
}) {
  // Live RPC probe — block height, age, gas price refreshed every 30s. Not
  // surfaced as a coloured "degraded/live" pill anywhere; just descriptive
  // metrics so the page doesn't pretend to know more than it does.
  const health = useL1Health(l1.rpcUrl, l1.evmChainId);
  const validators = useL1ValidatorCount(l1.subnetId, l1.isTestnet);
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
      <motion.section className="space-y-4" variants={sectionItem}>
        {/* Setup status now lives inline as a pill in the header's meta row
            (Configured / Configuration missing N/M with an inline progress
            bar; clicking the missing pill opens a popover with the full
            checklist). The NextActionBar still surfaces the most urgent
            single step as a prominent CTA when there's something to do. */}
        <DetailHeader l1={l1} health={health} />
        {!isComplete && <NextActionBar l1={l1} />}
      </motion.section>

      {/* Reference data the user copies most (RPC URL, subnet/blockchain/EVM
          chain IDs) lives right under the header so it's reachable in one
          click. Stays collapsed by default to keep visual weight on Health. */}
      <motion.div variants={sectionItem}>
        <NetworkDetailsCard l1={l1} />
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
          <NodeListCard l1={l1} userActiveTotal={userActiveNodeTotal} onRefetch={onRefetch} />
        </DashboardSection>
      )}

      <DashboardSection title="Tools">
        {isManaged && <QuickActionsCard l1={l1} />}
        {l1.source === 'wallet' && <WalletOnlyActions l1={l1} />}
      </DashboardSection>
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
