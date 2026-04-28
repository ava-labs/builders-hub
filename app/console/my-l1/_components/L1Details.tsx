'use client';

import { useL1Health } from '@/hooks/useL1Health';
import { useL1ValidatorCount } from '@/hooks/useL1ValidatorCount';
import type { CombinedL1 } from '../_lib/types';
import { setupSummary } from '../_lib/setup-steps';
import { DetailHeader } from './DetailHeader';
import { WalletNetworkBanner } from './WalletNetworkBanner';
import { StatsGrid } from './StatsGrid';
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
  const isComplete = isManaged && setupSummary(l1).pct === 100;

  return (
    <div className="space-y-6">
      <DetailHeader l1={l1} />
      <WalletNetworkBanner l1={l1} />
      {isManaged && !isComplete && <NextActionBar l1={l1} />}
      <StatsGrid l1={l1} health={health} validators={validators} />
      {isManaged &&
        (isComplete ? <SetupCompleteBadge /> : <SetupProgressCard l1={l1} fullWidth />)}
      {isManaged && <QuickActionsCard l1={l1} />}
      {l1.source === 'wallet' && <WalletOnlyActions l1={l1} />}
      <NetworkDetailsCard l1={l1} />
      {isManaged && l1.nodes && l1.nodes.length > 0 && (
        <NodeListCard l1={l1} userActiveTotal={userActiveNodeTotal} onRefetch={onRefetch} />
      )}
    </div>
  );
}
