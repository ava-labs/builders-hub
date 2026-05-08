'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Note } from '@/components/toolbox/components/Note';
import { InspectorShell } from './InspectorShell';
import { useDeploySourceToken } from '../hooks/useDeploySourceToken';
import { truncateAddress } from '../utils/explorer-url';
import type { Address, BridgePhase, BridgeStatus } from '../types';

type Mode = 'skip' | 'deploy-test' | 'wrapped-native';

interface TokenInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  status: BridgeStatus;
  /** Address selected so far (from legacy migration or prior deploy). */
  underlyingTokenAddress: Address | null;
  /** Persist the chosen token address into local component state of the parent. */
  onTokenSelected: (address: Address | null) => void;
}

export function TokenInspector({
  onPhaseChange,
  status,
  underlyingTokenAddress,
  onTokenSelected,
}: TokenInspectorProps) {
  const selectedL1 = useSelectedL1();
  const { walletEVMAddress } = useWalletStore();
  const [mode, setMode] = useState<Mode>(underlyingTokenAddress ? 'skip' : 'deploy-test');
  const [pasted, setPasted] = useState<string>(underlyingTokenAddress ?? '');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const { deployExampleErc20, isDeploying, error } = useDeploySourceToken();

  const handlePasteSubmit = () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(pasted)) {
      setPasteError('Enter a valid EVM address (0x… 40 hex chars).');
      return;
    }
    setPasteError(null);
    onTokenSelected(pasted as Address);
  };

  const handleDeploy = async () => {
    const addr = await deployExampleErc20();
    if (addr) onTokenSelected(addr);
  };

  return (
    <InspectorShell
      phase="token"
      status={status}
      onPhaseChange={onPhaseChange}
      description="Pick the token you want to bridge. Paste an address you already deployed, or deploy a test ERC-20 to play with."
      footer={
        underlyingTokenAddress && (
          <button
            type="button"
            onClick={() => onPhaseChange('home')}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Continue to Home
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <ModeCard
          mode="skip"
          activeMode={mode}
          onActivate={() => setMode('skip')}
          title="I have an existing token"
          description="Paste the deployed ERC-20 address. Make sure the wallet is on the Home chain."
        >
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Token contract address</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                spellCheck={false}
                value={pasted}
                onChange={(e) => setPasted(e.target.value.trim())}
                placeholder="0x…"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={!pasted}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Use
              </button>
            </div>
            {pasteError && <p className="text-[11px] text-red-600 dark:text-red-400">{pasteError}</p>}
            {underlyingTokenAddress && (
              <SelectedTokenChip address={underlyingTokenAddress} chainName={selectedL1?.name} />
            )}
          </div>
        </ModeCard>

        <ModeCard
          mode="deploy-test"
          activeMode={mode}
          onActivate={() => setMode('deploy-test')}
          title="Deploy a test ERC-20"
          description="One-click deploy of ExampleERC20 — 1,000,000 tokens minted to your wallet."
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Deployed by {walletEVMAddress ? truncateAddress(walletEVMAddress) : 'your wallet'} on{' '}
              {selectedL1?.name ?? 'the Home chain'}.
            </span>
            <button
              type="button"
              onClick={handleDeploy}
              disabled={isDeploying}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {isDeploying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              )}
              {isDeploying ? 'Deploying…' : 'Deploy ERC-20'}
            </button>
          </div>
          {error && (
            <Note variant="destructive" className="mt-2">
              <span className="text-xs">{error.message}</span>
            </Note>
          )}
        </ModeCard>

        <ModeCard
          mode="wrapped-native"
          activeMode={mode}
          onActivate={() => setMode('wrapped-native')}
          title="Bridge a native token"
          description="Wrap your chain's native gas token before bridging. Best handled in the legacy view for now."
        >
          <Link
            href="/console/ictt/legacy/setup/deploy-wrapped-native"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-white"
          >
            Open wrapped-native flow in legacy
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </ModeCard>
      </div>
    </InspectorShell>
  );
}

interface ModeCardProps {
  mode: Mode;
  activeMode: Mode;
  onActivate: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
}

function ModeCard({ mode, activeMode, onActivate, title, description, children }: ModeCardProps) {
  const isActive = mode === activeMode;
  return (
    <article
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isActive
          ? 'border-zinc-300 bg-zinc-50/60 ring-1 ring-zinc-300/50 dark:border-zinc-700 dark:bg-zinc-800/30 dark:ring-zinc-700/40'
          : 'border-zinc-200 hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/20',
      )}
    >
      <button
        type="button"
        onClick={onActivate}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-pressed={isActive}
      >
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
            isActive
              ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
              : 'border-zinc-300 dark:border-zinc-600',
          )}
        >
          {isActive && <Check className="h-2.5 w-2.5" />}
        </span>
      </button>
      {isActive && <div className="mt-3">{children}</div>}
    </article>
  );
}

function SelectedTokenChip({ address, chainName }: { address: Address; chainName?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs dark:bg-emerald-950/20">
      <div className="flex flex-col">
        <span className="font-medium text-emerald-800 dark:text-emerald-300">Token selected</span>
        <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">on {chainName ?? 'Home chain'}</span>
      </div>
      <code className="flex items-center gap-1 font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
        {truncateAddress(address)}
        <CopyTinyButton value={address} />
      </code>
    </div>
  );
}

function CopyTinyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') {
          void window.navigator.clipboard.writeText(value);
        }
      }}
      className="rounded p-0.5 text-emerald-700/70 transition-colors hover:bg-emerald-200/40 dark:text-emerald-400/80"
      aria-label="Copy address"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}
