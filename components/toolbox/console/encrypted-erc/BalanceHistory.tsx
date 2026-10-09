'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Eye, EyeOff, RefreshCw } from 'lucide-react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Alert } from '@/components/toolbox/components/Alert';
import { SpecPlate, SpecRow, StatCell, StatStrip } from '@/components/explorer-v2/ui';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { EERCToolShell } from './shared/EERCToolShell';
import { Choice, ChoiceGroup, EmptyBoard, GHOST_ACTION, INLINE_LINK, Panel } from './shared/ui';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import type { ERC20Meta } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Encrypted Balance',
  description:
    'Decrypt your on-chain encrypted balance. The plain amount only exists on your device; the chain stores a Poseidon ciphertext bound to your BabyJubJub public key.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

type Mode = 'standalone' | 'converter';

const FIGURE = 'font-mono text-2xl tabular-nums tracking-tight text-zinc-900 md:text-[1.75rem] dark:text-zinc-50';

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
  const tokenKey = tokens.map((t) => t.address.toLowerCase()).join(',');
  const [token, setToken] = useState<ERC20Meta | undefined>(tokens[0]);

  React.useEffect(() => {
    if (activeMode !== 'converter') return;
    const firstToken = tokens[0];
    if (!firstToken) {
      if (token !== undefined) setToken(undefined);
      return;
    }
    const tokenStillSupported =
      token !== undefined && tokens.some((t) => t.address.toLowerCase() === token.address.toLowerCase());
    if (!tokenStillSupported) setToken(firstToken);
  }, [activeMode, token, tokens, tokenKey]);

  const balance = useEERCBalance(deployment, activeMode ?? 'converter', token);
  const [showRaw, setShowRaw] = useState(false);

  if (modes.length === 0) {
    return (
      <EmptyBoard
        eyebrow="No deployment on this chain"
        action={{ href: '/console/encrypted-erc/deploy', label: 'Deploy your own' }}
      >
        There&apos;s no Encrypted ERC deployment on this chain. Switch to Avalanche Fuji or deploy your own.
      </EmptyBoard>
    );
  }

  const symbol = activeMode === 'standalone' ? 'PRIV' : `e${token?.symbol ?? ''}`;
  const loadingFigure = balance.isLoading && balance.formatted === null;

  return (
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      footerLinks={[
        {
          label: 'balanceOf() source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedUserBalances.sol`,
          icon: <BookOpen />,
        },
      ]}
    >
      {modes.length > 1 && (
        <ChoiceGroup label="Deployment">
          {modes.map((m) => (
            <Choice
              key={m}
              selected={activeMode === m}
              onSelect={() => setActiveMode(m)}
              title={m === 'standalone' ? 'Standalone' : 'Converter'}
              hint={m === 'standalone' ? 'Native private token' : 'Wraps an ERC20'}
            />
          ))}
        </ChoiceGroup>
      )}
      {activeMode === 'converter' && tokens.length > 1 && (
        <ChoiceGroup label="Token" cols={tokens.length > 2 ? 3 : 2}>
          {tokens.map((t) => (
            <Choice
              key={t.address}
              selected={token?.address === t.address}
              onSelect={() => setToken(t)}
              title={t.symbol}
              hint={`${t.address.slice(0, 6)}…${t.address.slice(-4)}`}
            />
          ))}
        </ChoiceGroup>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Balance
          </span>
          <button type="button" onClick={() => balance.refresh()} disabled={balance.isLoading} className={GHOST_ACTION}>
            <RefreshCw className={`h-3 w-3 ${balance.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="border-x border-t border-zinc-200 dark:border-zinc-800">
          <StatStrip cols={2}>
            <StatCell label="Decrypted balance" sub="Only in this browser" even>
              {loadingFigure ? (
                <span className="h-8 w-32 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              ) : (
                <span className={FIGURE}>
                  {balance.formatted !== null ? balance.formatted : balance.hasIdentity ? '—' : 'Register first'}
                  <span className="ml-2 text-sm text-zinc-400 dark:text-zinc-500">{symbol}</span>
                </span>
              )}
            </StatCell>
            <StatCell
              label="History entries"
              sub={balance.raw ? `Nonce ${balance.raw.nonce.toString()}` : 'Nothing stored yet'}
              even
            >
              {loadingFigure ? (
                <span className="h-8 w-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              ) : (
                <span className={FIGURE}>{balance.raw ? balance.raw.amountPCTs.length : '—'}</span>
              )}
            </StatCell>
          </StatStrip>
        </div>
      </div>

      {balance.error && (
        <Alert variant="error">
          {balance.error}
          {balance.validationError && (
            <>
              {' '}
              <Link href="/console/encrypted-erc/register" className={INLINE_LINK}>
                Open Register
              </Link>
              .
            </>
          )}
        </Alert>
      )}

      {!balance.hasIdentity && (
        <Alert variant="warning">
          No BabyJubJub identity in this browser.{' '}
          <Link href="/console/encrypted-erc/register" className={INLINE_LINK}>
            Register
          </Link>{' '}
          first to derive your decryption key.
        </Alert>
      )}

      <Panel
        label="On-chain ciphertext"
        action={
          <button type="button" onClick={() => setShowRaw((v) => !v)} className={GHOST_ACTION}>
            {showRaw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showRaw ? 'Hide' : 'Reveal'}
          </button>
        }
        bodyClassName="py-1"
      >
        {!showRaw ? (
          <p className="select-none py-2 font-mono text-[12px] tracking-[0.2em] text-zinc-300 dark:text-zinc-700">
            ••••••••••••••••••••••••
          </p>
        ) : !balance.raw ? (
          <p className="py-2 font-mono text-[12px] text-zinc-400 dark:text-zinc-500">No ciphertext stored yet.</p>
        ) : (
          <SpecPlate>
            <SpecRow label="EGCT c1">
              <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
                ({balance.raw.eGCT.c1[0].toString().slice(0, 20)}…, {balance.raw.eGCT.c1[1].toString().slice(0, 20)}…)
              </span>
            </SpecRow>
            <SpecRow label="EGCT c2">
              <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
                ({balance.raw.eGCT.c2[0].toString().slice(0, 20)}…, {balance.raw.eGCT.c2[1].toString().slice(0, 20)}…)
              </span>
            </SpecRow>
            <SpecRow label="balancePCT" align="start">
              <ol className="flex min-w-0 flex-col gap-0.5 font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
                {balance.raw.balancePCT.map((v, i) => (
                  <li key={i} className="truncate">
                    <span className="text-zinc-400 dark:text-zinc-500">[{i}]</span> {v.toString()}
                  </li>
                ))}
              </ol>
            </SpecRow>
            <SpecRow label="Meta">
              <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                nonce {balance.raw.nonce.toString()} · tx #{balance.raw.transactionIndex.toString()} ·{' '}
                {balance.raw.amountPCTs.length} history entries
              </span>
            </SpecRow>
          </SpecPlate>
        )}
      </Panel>
    </EERCToolShell>
  );
}

export default withConsoleToolMetadata(BalanceHistory, metadata);
