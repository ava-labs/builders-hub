'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Wallet } from 'lucide-react';
import type { DeploymentJob } from '@/lib/quick-l1/types';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Container } from '@/components/toolbox/components/Container';
import { Button } from '@/components/toolbox/components/Button';
import { cn } from '@/lib/utils';

/**
 * Success screen. Lists the deployment outputs users actually need
 * (RPC URL, chain IDs, validator manager) with copy affordances, plus
 * a primary Add-to-Wallet CTA.
 */
export default function BasicSetupComplete({ job }: { job: DeploymentJob }) {
  const result = job.result;
  const { addChain } = useWallet();
  const [addingToWallet, setAddingToWallet] = useState(false);

  if (!result) return null;

  const handleAddToWallet = async () => {
    setAddingToWallet(true);
    try {
      await addChain({ rpcUrl: result.rpcUrl, allowLookup: false });
    } finally {
      setAddingToWallet(false);
    }
  };

  return (
    <Container
      title={`${job.request.chainName} is live`}
      description="Your L1 is up and running on Fuji. Add it to your wallet to start building."
    >
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        Deployment complete
      </div>

      {/* Deployment details */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
        <DetailRow label="RPC URL" value={result.rpcUrl} mono />
        <DetailRow label="EVM Chain ID" value={String(result.evmChainId)} mono />
        <DetailRow label="Blockchain ID" value={result.blockchainId} mono truncate />
        <DetailRow label="Subnet ID" value={result.subnetId} mono truncate />
        <DetailRow label="Validator Manager" value={result.validatorManagerAddress} mono truncate />
        <DetailRow label="Validator Node" value={result.nodeId} mono truncate />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleAddToWallet} loading={addingToWallet} icon={<Wallet className="h-4 w-4" />} stickLeft>
          {addingToWallet ? 'Adding…' : `Add ${job.request.tokenSymbol} network to wallet`}
        </Button>
        <a
          href={`/console/explorer?rpc=${encodeURIComponent(result.rpcUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open in Explorer
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a
          href="/console"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Back to Console
        </a>
      </div>
    </Container>
  );
}

/**
 * One row in the details table — label on the left, mono value with
 * a Copy button on the right. Optional `truncate` clips long hashes so
 * the row doesn't wrap on smaller screens.
 */
function DetailRow({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable (http://) */
    }
  };
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="w-36 shrink-0 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        className={cn(
          'flex-1 min-w-0 text-sm text-zinc-900 dark:text-zinc-100',
          mono && 'font-mono',
          truncate && 'truncate',
        )}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
