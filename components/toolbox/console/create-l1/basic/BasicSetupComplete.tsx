'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Copy, ExternalLink, Sparkles, Wallet } from 'lucide-react';
import type { DeploymentJob } from '@/lib/quick-l1/types';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { cn } from '@/lib/utils';

/**
 * Success screen — the payoff for a one-click deployment.
 *
 * Shows everything the user needs to start using their new L1:
 *   - RPC URL + chain metadata
 *   - Validator Manager address
 *   - Subnet ID + Blockchain ID
 *   - One-click "Add to Wallet"
 * Each value has a Copy button since users will be pasting these into
 * scripts, Foundry configs, block explorers, etc.
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
    <div className="mx-auto max-w-2xl py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        className="mb-8"
      >
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-3 w-3" />
          Deployed
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {job.request.chainName} is live
        </h1>
        <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
          Your L1 is up and running on Fuji. Add it to your wallet and start building.
        </p>
      </motion.div>

      {/* Primary CTA */}
      <motion.button
        type="button"
        onClick={handleAddToWallet}
        disabled={addingToWallet}
        whileHover={!addingToWallet ? { y: -2, scale: 1.01 } : {}}
        whileTap={!addingToWallet ? { scale: 0.98 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          'mb-6 w-full inline-flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-base font-semibold transition-colors',
          addingToWallet
            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed'
            : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100',
        )}
        style={addingToWallet ? undefined : { boxShadow: '0 4px 14px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <Wallet className="h-4 w-4" />
        {addingToWallet ? 'Adding…' : `Add ${job.request.tokenSymbol} network to wallet`}
      </motion.button>

      {/* Deployment details */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
        <DetailRow label="RPC URL" value={result.rpcUrl} mono />
        <DetailRow label="EVM Chain ID" value={String(result.evmChainId)} mono />
        <DetailRow label="Blockchain ID" value={result.blockchainId} mono truncate />
        <DetailRow label="Subnet ID" value={result.subnetId} mono truncate />
        <DetailRow label="Validator Manager" value={result.validatorManagerAddress} mono truncate />
        <DetailRow label="Validator Node" value={result.nodeId} mono truncate />
      </div>

      {/* What's next */}
      <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          <Sparkles className="h-3 w-3" />
          What&apos;s next
        </div>
        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          <li className="flex items-start gap-2">
            <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-zinc-400" />
            Deploy a contract with Foundry using the RPC URL above
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-zinc-400" />
            Add validators from <span className="font-medium">Validators → Add Validator</span> in the sidebar
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-zinc-400" />
            Your managed validator node expires in 3 days — swap in self-hosted nodes for persistence
          </li>
        </ul>
      </div>

      {/* Footer links */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <a
          href={`/console/explorer?rpc=${encodeURIComponent(result.rpcUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 transition-colors"
        >
          Open in Explorer
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <span className="text-zinc-300 dark:text-zinc-700">•</span>
        <a
          href="/console"
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        >
          Back to Console
        </a>
      </div>
    </div>
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
      // Clipboard API can fail on http:// — fall back silently.
    }
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3">
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
