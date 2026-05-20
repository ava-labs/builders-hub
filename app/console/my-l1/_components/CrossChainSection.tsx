'use client';

import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUserBridgesForL1 } from '@/hooks/useUserBridgesForL1';
import { useL1CrossChainStats } from '@/hooks/useL1CrossChainStats';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { YourBridgesCard } from './YourBridgesCard';
import { L1BridgeActivityCard } from './L1BridgeActivityCard';

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
    <Collapsible className="rounded-xl border bg-card overflow-hidden">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group w-full cursor-pointer flex items-center gap-2 px-4 py-3 text-sm hover:bg-accent/30 transition-colors text-left [&[data-state=open]_.disclosure-chevron]:rotate-90"
        >
          <ChevronRight
            className="disclosure-chevron w-4 h-4 text-muted-foreground transition-transform"
            aria-hidden="true"
          />
          <span className="font-medium text-foreground">Cross-chain</span>
          {hint && <span className="text-muted-foreground hidden sm:inline">{hint}</span>}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="border-t border-border px-4 pt-4 pb-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <YourBridgesCard l1={l1} />
            <L1BridgeActivityCard l1={l1} />
          </div>
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
