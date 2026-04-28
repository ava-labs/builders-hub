'use client';

import { Check, Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import type { CombinedL1 } from '../_lib/types';

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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Network Details</CardTitle>
        <CardDescription>Technical information about your L1</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="p-3 rounded-lg bg-muted/50 group">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <div className="flex items-start gap-2">
                {/* break-all + wrap so the full RPC URL renders without truncation */}
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
                    <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
