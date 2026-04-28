'use client';

import Link from 'next/link';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CombinedL1 } from '../_lib/types';

// Past L1s: managed NodeRegistrations whose nodes have all expired or been
// terminated. We still surface them so users can find an old chain by name
// after the 3-day TTL kicks in. There's no live data to show — the chain
// itself is gone — so the row is a compact summary + Recreate CTA only.
export function PastL1sSection({ l1s }: { l1s: CombinedL1[] }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Past L1s
        </h3>
        <p className="text-xs text-muted-foreground/70">
          These managed L1s have spun down. Their RPC endpoints are no longer responsive — recreate
          them with the Quick L1 wizard if you want to spin one up again.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {l1s.map((l1) => (
          <PastL1Card key={l1.subnetId} l1={l1} />
        ))}
      </div>
    </div>
  );
}

function PastL1Card({ l1 }: { l1: CombinedL1 }) {
  const created = l1.firstSeenAt ? new Date(l1.firstSeenAt) : null;
  const expired = l1.expiresAt ? new Date(l1.expiresAt) : null;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground truncate">{l1.chainName}</h4>
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400">
              Spun down
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {l1.nodes?.length ?? 0} node{(l1.nodes?.length ?? 0) === 1 ? '' : 's'} ·{' '}
            {l1.evmChainId ?? `Subnet ${l1.subnetId.slice(0, 6)}…`}
          </p>
        </div>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        {created && <div>Created {created.toLocaleString()}</div>}
        {expired && <div>Spun down {expired.toLocaleString()}</div>}
      </div>
      <Link href="/console/create-l1" className="self-start">
        <Button variant="outline" size="sm">
          <Layers className="w-3.5 h-3.5 mr-2" />
          Recreate
        </Button>
      </Link>
    </div>
  );
}
