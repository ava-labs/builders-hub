'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Board, BoardHeader, MUTED } from '@/components/explorer-v2/ui';
import { FundWallet } from '@/components/console-wallets/FundWallet';
import { NETWORKS, catalogChain } from '@/components/console-wallets/chains';
import { useChainFunds, type FundChain } from '@/components/console-wallets/useChainFunds';
import { WalletPicker } from '@/components/console-wallets/WalletPicker';
import { BROWSER_ONLY_SHORT } from '@/components/console-wallets/flows';
import { useConsoleSigner } from '@/lib/console-wallets/react';
import { cn } from '@/lib/utils';
import type { BlueprintCard, DeploymentView, ProjectOverview } from './api';
import { studioSignerScope } from './useDeployRunner';
import { Notice, Pill, shortId } from './ui';

/** Rough gas per step kind, for the funding estimate only. */
const GAS = { deploy: 2_000_000n, call: 150_000n } as const;

const L1_NOTE = "Your L1's genesis gives its native token to the signer, so a fresh launch needs no funding here.";

/** The chains a plan signs on, with a rough gas need each. Before a plan, the blueprint's default networks. */
function fundChains(overview: ProjectOverview, blueprint: BlueprintCard | undefined, view: DeploymentView | null) {
  const out = new Map<number, FundChain>();
  const l1Id = overview.project.runtime?.[overview.project.stage]?.l1?.evmChainId;
  const chainIdOf = (key: string) => (key === 'l1' ? l1Id : NETWORKS[key]?.evmChainId) ?? null;

  if (view) {
    for (const [id, c] of Object.entries(view.chains)) {
      out.set(Number(id), { ...c, chainId: Number(id), note: Number(id) === l1Id ? L1_NOTE : undefined });
    }
    for (const step of view.steps) {
      if (step.kind !== 'deploy' && step.kind !== 'call') continue;
      if (step.state?.status === 'done' || step.state?.status === 'skipped') continue;
      const id = chainIdOf(step.network);
      const chain = id === null ? undefined : out.get(id);
      if (chain) chain.gasUnits = (chain.gasUnits ?? 0n) + GAS[step.kind];
    }
    return [...out.values()];
  }

  const keyOf = (role: string) => overview.project.networks?.[role] ?? blueprint?.networks[role]?.default ?? role;
  for (const role of Object.keys(blueprint?.networks ?? {})) {
    const key = keyOf(role);
    const chain = key === 'l1' ? null : catalogChain(key);
    if (chain) out.set(chain.chainId, chain);
  }
  for (const step of blueprint?.outline ?? []) {
    if (step.optional || (step.kind !== 'deploy' && step.kind !== 'call')) continue;
    const id = chainIdOf(keyOf(step.role));
    const chain = id === null ? undefined : out.get(id);
    if (chain) chain.gasUnits = (chain.gasUnits ?? 0n) + GAS[step.kind];
  }
  return [...out.values()];
}

/**
 * The project's signer and what it holds on each chain the work needs: the
 * open plan's chains, or before planning, the blueprint's. Only a Console
 * wallet is checked; a browser wallet is the builder's own to top up.
 */
export function useStudioFunding(
  overview: ProjectOverview,
  blueprint: BlueprintCard | undefined,
  view: DeploymentView | null,
) {
  const signer = useConsoleSigner(studioSignerScope(overview.project.id), { pinnedAddress: view?.signer ?? null });
  const chains = useMemo(() => fundChains(overview, blueprint, view), [overview, blueprint, view]);
  const wallet = signer.wallet;
  const funds = useChainFunds(wallet?.address, wallet ? chains : []);
  return { signer, chains, funds, wallet, short: wallet ? funds.short : [], checked: !wallet || funds.checked };
}

export type StudioFunding = ReturnType<typeof useStudioFunding>;

/**
 * Step one of every Studio flow: who signs. A deployment that already has a
 * signer stays with it; otherwise the choice is saved for the project.
 */
export function StudioWalletStep({
  overview,
  view,
  funding: fundingState,
}: {
  overview: ProjectOverview;
  view: DeploymentView | null;
  funding: StudioFunding;
}) {
  const pinnedAddress = view?.signer ?? null;
  const { signer: state, chains, funds, short } = fundingState;
  const [editing, setEditing] = useState(false);
  const [funding, setFunding] = useState(false);
  const isShort = short.length > 0;
  // A wallet that can't pay for the work opens its funding panel instead of waiting to be asked.
  useEffect(() => {
    if (isShort) setFunding(true);
  }, [isShort]);

  const ready = state.ready && !!state.choice && !state.needs;
  const open = !ready || editing;
  const wallet = state.wallet;
  const who = wallet
    ? `${wallet.label} · ${shortId(wallet.address)}`
    : state.choice === 'browser' && state.browserAddress
      ? `Browser wallet · ${shortId(state.browserAddress)}`
      : 'Not chosen yet';

  return (
    <Board>
      <BoardHeader
        label="Step 1 · Signing wallet"
        action={
          ready ? (
            <span className="flex items-center gap-2">
              {wallet && !wallet.backedUp && <Pill tone="warn">not backed up</Pill>}
              {isShort && <Pill tone="warn">needs funds</Pill>}
              <Pill tone="good">{wallet ? 'console wallet · unlocked' : 'browser wallet'}</Pill>
            </span>
          ) : (
            <Pill tone="warn">choose first</Pill>
          )
        }
      />
      <div className="flex flex-col gap-4 px-5 py-4 md:px-6">
        {!open ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[13px] text-zinc-900 dark:text-zinc-50">{who}</span>
            <span className={cn(MUTED, 'text-[11.5px]')}>
              {wallet
                ? 'Signs each step without a popup while unlocked.'
                : 'You confirm each transaction in your wallet.'}
            </span>
            <span className="flex-1" />
            {!pinnedAddress && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              Choose who signs this project&apos;s transactions before you plan. A Console wallet signs every step
              without a popup; your browser wallet asks you to confirm each one.
            </p>
            <WalletPicker scope={studioSignerScope(overview.project.id)} pinnedAddress={pinnedAddress} />
            {ready && editing && (
              <div>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Done
                </button>
              </div>
            )}
          </>
        )}

        {wallet && (
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setFunding((f) => !f)}
              aria-expanded={funding}
              className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', funding && 'rotate-90')} />
              Fund this wallet
              {chains.length > 0 && ` · ${chains.length} chain${chains.length === 1 ? '' : 's'}`}
            </button>
            {funding && isShort && (
              <Notice tone="warn">
                Fund this wallet before you plan: it doesn&apos;t hold enough for the work on{' '}
                {short.map((c) => c.name).join(', ')}. Balances refresh every 15 seconds.
              </Notice>
            )}
            {funding && <FundWallet address={wallet.address} chains={chains} funds={funds} />}
            {!funding && (
              <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300">{BROWSER_ONLY_SHORT}</span>
            )}
          </div>
        )}
      </div>
    </Board>
  );
}
