'use client';

import { Check, ChevronRight, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import type { CombinedL1 } from '../_lib/types';

// Network identifiers (RPC URL, Subnet ID, Blockchain ID, EVM Chain ID) are
// reference data the user looks up once per session — not on-glance content.
// Rendering them in a full Card with a 3-col grid of break-all monospace
// strings ate ~140px of vertical space and zigzagged into 4-line wraps on
// mobile. Collapsing them into a native <details> element keeps them one
// click away without dominating the dashboard.
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
    <details className="group rounded-xl border bg-card open:bg-card">
      <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
        <span className="font-medium">Network identifiers</span>
        <span className="text-muted-foreground/70">
          RPC URL, Subnet ID, Blockchain ID{l1.evmChainId !== null ? ', EVM Chain ID' : ''}
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.id} className="p-3 rounded-lg bg-muted/40 group/item">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <div className="flex items-start gap-2">
                <code
                  className="text-sm font-mono text-foreground flex-1 break-all leading-relaxed"
                  title={item.value}
                >
                  {item.value}
                </code>
                <button
                  onClick={() => copyToClipboard(item.value, item.id)}
                  className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                  title={`Copy ${item.label}`}
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/item:text-muted-foreground transition-colors" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
