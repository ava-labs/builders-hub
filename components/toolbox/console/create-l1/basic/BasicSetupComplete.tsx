'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowRight, Check, Copy, ExternalLink, Wallet } from 'lucide-react';
import type { DeploymentJob } from '@/lib/quick-l1/types';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Button } from '@/components/toolbox/components/Button';
import { cn } from '@/lib/utils';

/**
 * Success screen — restrained. Big chain name, single CTA, then a
 * compact list of deployment outputs. Chain identity via 6px dots
 * alongside labels (no filled pill badges). Confetti on mount — this
 * is the rare "moment" in the flow.
 */
export default function BasicSetupComplete({ job }: { job: DeploymentJob }) {
  const result = job.result;
  const { addChain } = useWallet();
  const [addingToWallet, setAddingToWallet] = useState(false);

  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current || !result) return;
    firedRef.current = true;
    const base = { spread: 60, startVelocity: 45, ticks: 200, gravity: 0.9, scalar: 1 };
    confetti({ ...base, particleCount: 80, angle: 60, origin: { x: 0, y: 0.65 } });
    confetti({ ...base, particleCount: 80, angle: 120, origin: { x: 1, y: 0.65 } });
    setTimeout(() => {
      confetti({ ...base, particleCount: 60, angle: 90, spread: 130, origin: { x: 0.5, y: 0.55 } });
    }, 220);
  }, [result]);

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
    <div className="mx-auto max-w-3xl py-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
          Deployed
        </div>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {job.request.chainName} is live
        </h1>
        <p className="mt-1.5 text-[14px] text-zinc-500 dark:text-zinc-400">
          Running on Fuji. Add it to your wallet to start building.
        </p>
      </motion.div>

      {/* Primary CTA */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        className="mb-6"
      >
        <Button onClick={handleAddToWallet} loading={addingToWallet} icon={<Wallet className="h-4 w-4" />} stickLeft>
          {addingToWallet ? 'Adding…' : `Add ${job.request.chainName} to wallet`}
        </Button>
      </motion.div>

      {/* Deployment details — compact rows */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.03, delayChildren: 0.18 } },
        }}
        className="rounded-md border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-900"
      >
        <DetailRow label="RPC URL" value={result.rpcUrl} />
        <DetailRow label="EVM Chain ID" value={String(result.evmChainId)} />
        <DetailRow label="Blockchain ID" value={result.blockchainId} />
        <DetailRow label="Subnet ID" value={result.subnetId} chain="p-chain" />
        <DetailRow label="Validator Manager" value={result.validatorManagerAddress} chain="c-chain" />
        <DetailRow label="Validator Node" value={result.nodeId} />
      </motion.div>

      {/* Secondary links */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
      >
        <a
          href={`/console/explorer?rpc=${encodeURIComponent(result.rpcUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-primary hover:underline"
        >
          Open in Explorer
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a
          href="/console"
          className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Back to Console
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </motion.div>
    </div>
  );
}

function chainDotClass(chain: 'p-chain' | 'c-chain' | 'l1'): string {
  return chain === 'p-chain' ? 'bg-blue-500' : chain === 'c-chain' ? 'bg-purple-500' : 'bg-red-500';
}

function chainName(chain: 'p-chain' | 'c-chain' | 'l1'): string {
  return chain === 'p-chain' ? 'P-Chain' : chain === 'c-chain' ? 'C-Chain' : 'L1';
}

function DetailRow({ label, value, chain }: { label: string; value: string; chain?: 'p-chain' | 'c-chain' | 'l1' }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 4 },
        visible: { opacity: 1, y: 0 },
      }}
      className="group flex items-start gap-3 px-4 py-2.5"
    >
      <div className="w-40 shrink-0 flex items-center gap-2 pt-0.5">
        {chain && <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', chainDotClass(chain))} />}
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
          {chain ? `${label} · ${chainName(chain)}` : label}
        </span>
      </div>
      <code className="flex-1 min-w-0 font-mono text-[12px] text-zinc-900 dark:text-zinc-100 break-all select-all">
        {value}
      </code>
      <button
        type="button"
        onClick={onCopy}
        title="Copy"
        className="shrink-0 inline-flex items-center rounded p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors opacity-60 group-hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </motion.div>
  );
}
