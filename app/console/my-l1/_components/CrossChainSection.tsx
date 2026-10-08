'use client';

import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUserBridgesForL1 } from '@/hooks/useUserBridgesForL1';
import { useL1CrossChainStats } from '@/hooks/useL1CrossChainStats';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { cn } from '@/lib/utils';
import { YourBridgesCard } from './YourBridgesCard';
import { L1BridgeActivityCard } from './L1BridgeActivityCard';
import { DISCLOSURE, DISCLOSURE_HINT, DISCLOSURE_LABEL, FRAME } from './chrome';

/**
 * Cross-chain section for the My L1 dashboard. Pairs the user's local
 * bridges with aggregate per-L1 cross-chain activity (ICTT + ICM) and
 * wraps the whole pair in a Radix Collapsible — matching the
 * `NetworkDetailsCard` idiom so the dashboard's "drill-down" sections
 * have consistent open/close behavior.
 *
 * Defaults closed: the section is informational and a fresh L1 will
 * almost always have nothing to show. The trigger surfaces the headline
 * counts so the user can decide whether to expand.
 */
export function CrossChainSection({ l1 }: { l1: CombinedL1 }) {
  const { total: bridgeCount } = useUserBridgesForL1(l1.blockchainId);
  const { data: stats } = useL1CrossChainStats(l1.blockchainId, l1.evmChainId);
  const icm24h = stats?.icm?.msgs24h ?? 0;

  const hint = buildHint(bridgeCount, icm24h);

  return (
    <Collapsible className={FRAME}>
      <CollapsibleTrigger asChild>
        <button type="button" className={DISCLOSURE}>
          <ChevronRight
            className="disclosure-chevron h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform"
            aria-hidden="true"
          />
          <span className={DISCLOSURE_LABEL}>Cross-chain</span>
          {hint && <span className={cn(DISCLOSURE_HINT, 'tabular-nums')}>{hint}</span>}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        {/* The two panels share the board's frame, split by one hairline. */}
        <div className="grid grid-cols-1 divide-y divide-zinc-200 md:grid-cols-2 md:divide-x md:divide-y-0 dark:divide-zinc-800">
          <YourBridgesCard l1={l1} />
          <L1BridgeActivityCard l1={l1} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function buildHint(bridges: number, icm24h: number): string | null {
  const parts: string[] = [];
  if (bridges > 0) parts.push(`${bridges} ${bridges === 1 ? 'bridge' : 'bridges'}`);
  if (icm24h > 0) parts.push(`${icm24h} ICM 24h`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
