'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowRight, Check, Copy, ExternalLink, Wallet, Link2, Layers } from 'lucide-react';
import type { DeploymentJob } from '@/lib/quick-l1/types';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Button } from '@/components/toolbox/components/Button';
import { cn } from '@/lib/utils';

/**
 * Success / recap screen — big chain name, single primary CTA, then a
 * two-column grid of everything the deployment produced. Because the
 * progress page now shows one-step-at-a-time (no tx history mid-flight),
 * the user's actual "what did I just do?" moment lives here.
 *
 * Layout:
 *   - Hero (chain name + eyebrow + tagline)
 *   - Primary CTA (Add to wallet)
 *   - Stats strip (time / txs / chains touched)
 *   - Grid: Chain details | Interop artifacts (only when interop=on)
 *   - Secondary links (explorer, back to console)
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

  // Deployment stats — derived, not stored, since we already have all
  // the raw evidence in the job. Keeps the recap honest.
  const stats = useMemo(() => {
    const durationMs = Math.max(0, new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime());
    const totalTxs = job.evidence.reduce((acc, e) => acc + e.txs.length, 0);
    const chainsTouched = new Set(job.evidence.flatMap((e) => e.txs.map((t) => t.chain))).size;
    const totalSteps = job.completedSteps.length;
    return { durationMs, totalTxs, chainsTouched, totalSteps };
  }, [job]);

  if (!result) return null;

  const handleAddToWallet = async () => {
    setAddingToWallet(true);
    try {
      await addChain({ rpcUrl: result.rpcUrl, allowLookup: false });
    } finally {
      setAddingToWallet(false);
    }
  };

  const mm = String(Math.floor(stats.durationMs / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((stats.durationMs % 60_000) / 1000)).padStart(2, '0');
  const elapsedLabel = `${mm}:${ss}`;

  return (
    <div className="mx-auto max-w-4xl py-4 px-4">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Deployed
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
            {job.request.chainName} is live
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Running on Fuji. Add it to your wallet to start building.
          </p>
        </div>

        {/* Primary CTA — anchored to the right on wider screens */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="shrink-0"
        >
          <Button onClick={handleAddToWallet} loading={addingToWallet} icon={<Wallet className="h-4 w-4" />} stickLeft>
            {addingToWallet ? 'Adding…' : `Add ${job.request.chainName} to wallet`}
          </Button>
        </motion.div>
      </motion.div>

      {/* Stats strip — compact, glanceable, single row */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="mb-4 grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden divide-x divide-zinc-100 dark:divide-zinc-900"
      >
        <StatCell label="Duration" value={elapsedLabel} mono />
        <StatCell label="Transactions" value={String(stats.totalTxs)} />
        <StatCell label="Chains" value={String(stats.chainsTouched)} />
        <StatCell label="Steps" value={String(stats.totalSteps)} />
      </motion.div>

      {/* Recap grid — chain details + (optionally) interop */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.05, delayChildren: 0.22 } },
        }}
        className={cn('grid gap-4', result.interop ? 'lg:grid-cols-2' : 'grid-cols-1')}
      >
        <RecapCard
          title="Chain details"
          subtitle="Everything needed to connect to your L1"
          icon={<Layers className="h-4 w-4" />}
        >
          <DetailRow label="RPC URL" value={result.rpcUrl} />
          <DetailRow label="EVM Chain ID" value={String(result.evmChainId)} mono />
          <DetailRow label="Blockchain ID" value={result.blockchainId} />
          <DetailRow label="Subnet ID" value={result.subnetId} chain="p-chain" />
          <DetailRow label="Validator Manager" value={result.validatorManagerAddress} chain="c-chain" />
          <DetailRow label="Validator Node" value={result.nodeId} />
        </RecapCard>

        {result.interop && (
          <RecapCard
            title="Cross-chain bridge"
            subtitle="MockUSDC bridged from C-Chain via ICM"
            icon={<Link2 className="h-4 w-4" />}
          >
            <DetailRow label="ICM Relayer" value={result.interop.relayerAddress} />
            <DetailRow label="MockUSDC" value={result.interop.mockUsdcAddress} chain="c-chain" />
            <DetailRow label="TokenHome" value={result.interop.tokenHomeAddress} chain="c-chain" />
            <DetailRow label="TokenRemote" value={result.interop.tokenRemoteAddress} chain="l1" />
            <DetailRow label="ICM Registry" value={result.interop.icmRegistryAddress} chain="l1" />
            <DetailRow label="Bridged Amount" value={`${result.interop.bridgedAmount} base units`} />
          </RecapCard>
        )}
      </motion.div>

      {/* Secondary actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
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

// ─── Stats strip cell ──────────────────────────────────────────────

function StatCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-2.5 text-center sm:text-left">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-lg font-semibold leading-none text-zinc-900 dark:text-zinc-100 tabular-nums',
          mono && 'font-mono',
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Recap card — titled section with subtle header ────────────────

function RecapCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { type: 'spring', stiffness: 260, damping: 26 },
        },
      }}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden h-fit"
    >
      <div className="flex items-start gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-900">
        {icon && (
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{subtitle}</p>}
        </div>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-900">{children}</div>
    </motion.div>
  );
}

// ─── Detail row — compact label/value pair with copy button ────────

function chainDotClass(chain: 'p-chain' | 'c-chain' | 'l1'): string {
  return chain === 'p-chain' ? 'bg-blue-500' : chain === 'c-chain' ? 'bg-purple-500' : 'bg-red-500';
}

function chainName(chain: 'p-chain' | 'c-chain' | 'l1'): string {
  return chain === 'p-chain' ? 'P-Chain' : chain === 'c-chain' ? 'C-Chain' : 'L1';
}

function DetailRow({
  label,
  value,
  chain,
  mono,
}: {
  label: string;
  value: string;
  chain?: 'p-chain' | 'c-chain' | 'l1';
  mono?: boolean;
}) {
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
    <div className="group flex items-center gap-2.5 px-3.5 py-2">
      <div className="shrink-0 w-[120px] flex items-center gap-1.5">
        {chain && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', chainDotClass(chain))} />}
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
          {chain ? `${label} · ${chainName(chain)}` : label}
        </span>
      </div>
      <code
        className={cn(
          'flex-1 min-w-0 text-[12px] text-zinc-900 dark:text-zinc-100 truncate select-all',
          mono ? 'font-mono' : 'font-mono',
        )}
        title={value}
      >
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
    </div>
  );
}
