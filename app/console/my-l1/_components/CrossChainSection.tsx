'use client';

import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { YourBridgesCard } from './YourBridgesCard';
import { L1BridgeActivityCard } from './L1BridgeActivityCard';

/**
 * Cross-chain DashboardSection for the My L1 dashboard. Pairs the user's
 * own bridges (local store) with aggregate per-L1 cross-chain activity
 * (ICTT + ICM via server). Mounted from `L1Details` between LiveCharts
 * and Node fleet.
 */
export function CrossChainSection({ l1 }: { l1: CombinedL1 }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <YourBridgesCard l1={l1} />
      <L1BridgeActivityCard l1={l1} />
    </div>
  );
}
