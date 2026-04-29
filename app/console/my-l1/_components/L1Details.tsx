'use client';

import type { ReactNode } from 'react';
import { useL1Health } from '@/hooks/useL1Health';
import { useL1ValidatorCount } from '@/hooks/useL1ValidatorCount';
import type { CombinedL1 } from '../_lib/types';
import { setupSummary } from '../_lib/setup-steps';
import { DetailHeader } from './DetailHeader';
import { StatsGrid } from './StatsGrid';
import { LiveCharts } from './LiveCharts';
import { NextActionBar, SetupCompleteBadge, SetupProgressCard } from './SetupProgress';
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
  const setup = isManaged ? setupSummary(l1) : null;
  const isComplete = setup?.pct === 100;

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <DetailHeader l1={l1} health={health} />
        {isManaged && !isComplete && <NextActionBar l1={l1} />}
      </section>

      {/* Reference data the user copies most (RPC URL, subnet/blockchain/EVM
          chain IDs) lives right under the header so it's reachable in one
          click. Stays collapsed by default to keep visual weight on Health. */}
      <NetworkDetailsCard l1={l1} />

      <DashboardSection title="Health">
        <StatsGrid l1={l1} health={health} validators={validators} />
      </DashboardSection>

      <DashboardSection title="Live activity">
        <LiveCharts l1={l1} />
      </DashboardSection>

      {isManaged &&
        (isComplete ? (
          <SetupCompleteBadge />
        ) : (
          <DashboardSection title="Setup progress">
            <SetupProgressCard l1={l1} fullWidth />
          </DashboardSection>
        ))}

      {isManaged && l1.nodes && l1.nodes.length > 0 && (
        <DashboardSection title="Node fleet">
          <NodeListCard l1={l1} userActiveTotal={userActiveNodeTotal} onRefetch={onRefetch} />
        </DashboardSection>
      )}

      <DashboardSection title="Tools">
        {isManaged && <QuickActionsCard l1={l1} />}
        {l1.source === 'wallet' && <WalletOnlyActions l1={l1} />}
      </DashboardSection>
    </div>
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
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
