'use client';

import { Check, ChevronRight, Copy } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import type { CombinedL1 } from '../_lib/types';

// Network identifiers (RPC URL, Subnet ID, Blockchain ID, EVM Chain ID) are
// reference data the user looks up once per session — not on-glance content.
// Rendering them in a full Card with a 3-col grid of break-all monospace
// strings ate ~140px of vertical space and zigzagged into 4-line wraps on
// mobile. Wrapping them in a Radix Collapsible keeps them one click away
// without dominating the dashboard, and animates the height transition
// smoothly (the previous native `<details>` element snap-opened).
export function NetworkDetailsCard({ l1 }: { l1: CombinedL1 }) {
  const { copiedId, copyToClipboard } = useCopyToClipboard();

  const items: Array<{ label: string; value: string; id: string }> = [
    { label: 'RPC URL', value: l1.rpcUrl, id: 'rpc-url' },
    { label: 'Subnet ID', value: l1.subnetId, id: 'subnet-id' },
    { label: 'Blockchain ID', value: l1.blockchainId, id: 'blockchain-id' },
  ];
  if (l1.evmChainId !== null) {
    items.push({ label: 'EVM Chain ID', value: String(l1.evmChainId), id: 'evm-chain-id' });
  }

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
          <span className="font-medium text-foreground">Network identifiers</span>
          <span className="text-muted-foreground hidden sm:inline">
            RPC URL, Subnet ID, Blockchain ID{l1.evmChainId !== null ? ', EVM Chain ID' : ''}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="border-t border-border px-4 pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => {
            const isCopied = copiedId === item.id;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => copyToClipboard(item.value, item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    copyToClipboard(item.value, item.id);
                  }
                }}
                aria-label={`Copy ${item.label}`}
                className="p-3 rounded-lg border border-border bg-background/40 group/item cursor-pointer hover:border-foreground/30 hover:bg-background/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">
                  {item.label}
                </p>
                <div className="flex items-start gap-2">
                  {/* Click on the value itself does NOT trigger copy — leaves
                      the user free to click-and-drag to select a substring
                      (e.g. just the chain ID portion of a longer URL). */}
                  <code
                    className="text-sm font-mono text-foreground flex-1 break-all leading-relaxed cursor-text"
                    title={item.value}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {item.value}
                  </code>
                  <span
                    className="p-1.5 shrink-0 text-muted-foreground group-hover/item:text-foreground transition-colors"
                    aria-hidden="true"
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
