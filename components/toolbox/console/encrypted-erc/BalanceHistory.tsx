'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BookOpen, RefreshCw } from 'lucide-react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { EERCToolShell } from './shared/EERCToolShell';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import type { ERC20Meta } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Encrypted Balance',
  description:
    'Decrypt your on-chain encrypted balance. The plaintext amount only exists on your device — the chain stores a Poseidon ciphertext bound to your BabyJubJub public key.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

type Mode = 'standalone' | 'converter';

function BalanceHistory() {
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  // Order favours converter because that's the path the Deposit / Transfer /
  // Withdraw flows actually use on Fuji and on most user-deployed L1s. Putting
  // standalone first historically meant Balance defaulted to the empty
  // standalone contract while the user's tokens were sitting in the converter
  // one — the "balance always zero" UX bug.
  const modes: Mode[] = [];
  if (converter.isReady) modes.push('converter');
  if (standalone.isReady) modes.push('standalone');
  const modesKey = modes.join(',');

  const [activeMode, setActiveMode] = useState<Mode | null>(modes[0] ?? null);

  // Recover from the case where `modes[0]` was undefined on first render
  // (chainId was 0 before wallet finished connecting), and ensure activeMode
  // always points at one of the currently-available modes.
  // modesKey collapses the modes array into a stable string dep so identity
  // churn doesn't re-trigger this effect every render.
  React.useEffect(() => {
    if (modes.length === 0) return;
    if (activeMode === null || !modes.includes(activeMode)) {
      setActiveMode(modes[0]);
    }
  }, [modesKey, activeMode]);

  const deployment = activeMode === 'standalone' ? standalone.deployment : converter.deployment;
  const tokens = deployment?.supportedTokens ?? [];
  const [token, setToken] = useState<ERC20Meta | undefined>(tokens[0]);

  React.useEffect(() => {
    if (activeMode === 'converter' && !token && tokens[0]) setToken(tokens[0]);
  }, [activeMode, token, tokens]);

  const balance = useEERCBalance(deployment, activeMode ?? 'converter', token);
  const [showRaw, setShowRaw] = useState(false);

  if (modes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm">
        <p className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">No Encrypted ERC deployment on this chain.</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Switch to Avalanche Fuji or{' '}
          <Link href="/console/encrypted-erc/deploy" className="underline">
            deploy your own
          </Link>
          .
        </p>
      </div>
    );
  }

  const symbol = activeMode === 'standalone' ? 'PRIV' : `e${token?.symbol ?? ''}`;

  return (
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      footerLinks={[
        {
          label: 'balanceOf() source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedUserBalances.sol`,
          icon: <BookOpen className="w-3.5 h-3.5" />,
        },
      ]}
    >
      {(modes.length > 1 || tokens.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          {modes.length > 1 && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/60">
              {modes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveMode(m)}
                  className={
                    activeMode === m
                      ? 'px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'px-3 py-1.5 text-xs font-medium rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }
                >
                  {m === 'standalone' ? 'Standalone' : 'Converter'}
                </button>
              ))}
            </div>
          )}
          {activeMode === 'converter' &&
            tokens.length > 1 &&
            tokens.map((t) => (
              <button
                key={t.address}
                type="button"
                onClick={() => setToken(t)}
                className={
                  token?.address === t.address
                    ? 'px-3 py-1 text-xs rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'px-3 py-1 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }
              >
                {t.symbol}
              </button>
            ))}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Decrypted balance
          </div>
          <div className="font-mono text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {balance.isLoading
              ? '…'
              : balance.formatted !== null
                ? balance.formatted
                : balance.hasIdentity
                  ? '—'
                  : 'register first'}
            <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-2 font-normal">{symbol}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => balance.refresh()}
          disabled={balance.isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${balance.isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {balance.error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 text-xs text-red-700 dark:text-red-400">
          {balance.error}
        </div>
      )}

      {!balance.hasIdentity && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          No cached BabyJubJub identity.{' '}
          <Link href="/console/encrypted-erc/register" className="underline font-medium">
            Register
          </Link>{' '}
          first to derive your decryption key.
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline transition-colors w-fit"
      >
        {showRaw ? 'Hide' : 'Show'} raw on-chain ciphertext
      </button>

      {showRaw && balance.raw && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-3 text-[11px] font-mono">
          <div>
            <div className="text-zinc-500 dark:text-zinc-400 mb-1">EGCT c1</div>
            <div className="text-zinc-700 dark:text-zinc-300 break-all">
              ({balance.raw.eGCT.c1[0].toString().slice(0, 20)}…, {balance.raw.eGCT.c1[1].toString().slice(0, 20)}…)
            </div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-zinc-400 mb-1">EGCT c2</div>
            <div className="text-zinc-700 dark:text-zinc-300 break-all">
              ({balance.raw.eGCT.c2[0].toString().slice(0, 20)}…, {balance.raw.eGCT.c2[1].toString().slice(0, 20)}…)
            </div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-zinc-400 mb-1">balancePCT (7 elements)</div>
            <div className="text-zinc-700 dark:text-zinc-300 space-y-0.5">
              {balance.raw.balancePCT.map((v, i) => (
                <div key={i} className="truncate">
                  [{i}] {v.toString()}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-[10px]">
            nonce {balance.raw.nonce.toString()} · tx #{balance.raw.transactionIndex.toString()} ·{' '}
            {balance.raw.amountPCTs.length} history entries
          </div>
        </div>
      )}
    </EERCToolShell>
  );
}

export default withConsoleToolMetadata(BalanceHistory, metadata);
