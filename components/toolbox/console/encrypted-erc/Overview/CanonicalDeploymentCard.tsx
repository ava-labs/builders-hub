'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { listKnownChains } from '@/lib/eerc/deployments';
import { cn } from '@/lib/utils';
import { boardItem } from '@/components/console/motion';
import { TileShell } from './TileShell';

const FUJI_CHAIN_ID = 43113;

/**
 * Status card for the canonical deployment of EERC on the chain the
 * user is currently connected to.
 *
 * Earlier this card hardcoded `chainId === 43113`, which made it lie on
 * any non-Fuji wallet (it always showed "Fuji demo" with green dots even
 * when the user was on a chain with no deployment at all). The new logic
 * is:
 *   1. If the connected chain has a known deployment → show its status,
 *      label badge as "Your chain".
 *   2. Otherwise, if Fuji has a deployment → fall back to it as a demo,
 *      label badge as "Fuji demo".
 *   3. Otherwise → render an empty state with a link to the Deploy
 *      wizard.
 */
interface CanonicalDeploymentCardProps {
  className?: string;
}

export function CanonicalDeploymentCard({ className }: CanonicalDeploymentCardProps) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const known = listKnownChains();
  const onChain = known.find((k) => k.chainId === walletChainId && k.modes.length > 0);
  const fuji = known.find((k) => k.chainId === FUJI_CHAIN_ID && k.modes.length > 0);
  const target = onChain ?? fuji;
  const isOnConnectedChain = Boolean(onChain);

  return (
    <motion.div className={className} variants={boardItem}>
      <TileShell className="h-full">
        {!target ? (
          <EmptyState walletChainId={walletChainId} />
        ) : (
          <DeploymentStatus
            chainId={target.chainId}
            chainName={target.chainName}
            modes={target.modes}
            isOnConnectedChain={isOnConnectedChain}
          />
        )}
      </TileShell>
    </motion.div>
  );
}

interface DeploymentStatusProps {
  chainId: number;
  chainName: string;
  modes: ReturnType<typeof listKnownChains>[number]['modes'];
  isOnConnectedChain: boolean;
}

function DeploymentStatus({ chainId, chainName, modes, isOnConnectedChain }: DeploymentStatusProps) {
  const hasStandalone = modes.includes('standalone');
  const hasConverter = modes.includes('converter');

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'inline-block w-2 h-2 rounded-full',
            modes.length > 0 ? 'bg-emerald-500 enc-flicker' : 'bg-zinc-300 dark:bg-zinc-700',
          )}
        />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {isOnConnectedChain ? chainName : `${chainName} demo`}
        </h3>
        <span
          className={cn(
            'ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border',
            isOnConnectedChain
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300'
              : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300',
          )}
        >
          {isOnConnectedChain ? 'Your chain' : `${chainId}`}
        </span>
      </div>
      <div className="space-y-2 text-xs">
        <ModeRow label="Standalone" deployed={hasStandalone} />
        <ModeRow label="Converter" deployed={hasConverter} />
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Wrapped tokens</span>
          <span className="font-mono text-zinc-700 dark:text-zinc-300">
            {chainId === FUJI_CHAIN_ID ? 'WAVAX' : 'see deployment'}
          </span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <Link
          href="/console/encrypted-erc/balance"
          className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Explore deployment
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </>
  );
}

function ModeRow({ label, deployed }: { label: string; deployed: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span
        className={cn(
          'font-mono',
          deployed ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600',
        )}
      >
        {deployed ? 'deployed' : 'pending'}
      </span>
    </div>
  );
}

function EmptyState({ walletChainId }: { walletChainId: number }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No deployment</h3>
        {walletChainId > 0 && (
          <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {walletChainId}
          </span>
        )}
      </div>
      <div className="rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 p-3 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
        No EERC deployment is registered for this chain yet.{' '}
        <Link
          href="/console/encrypted-erc/deploy"
          className="underline text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Deploy your own
        </Link>{' '}
        or switch to a chain with a known deployment.
      </div>
    </>
  );
}
