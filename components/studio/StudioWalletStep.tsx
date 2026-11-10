'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, KeyRound, Plus, Settings2, Upload } from 'lucide-react';
import { getAddress } from 'viem';
import { HashChip, SectionHeader } from '@/components/explorer-v2/ui';
import {
  ConsoleWalletsDialog,
  WalletDialogs,
  type WalletDialog,
} from '@/components/console-wallets/ConsoleWalletsManager';
import { FundWallet } from '@/components/console-wallets/FundWallet';
import { NETWORKS, catalogChain } from '@/components/console-wallets/chains';
import { useChainFunds, type FundChain } from '@/components/console-wallets/useChainFunds';
import { getActiveConsoleWallet } from '@/lib/console-wallets/core-provider';
import { readChoice, useConsoleSigner } from '@/lib/console-wallets/react';
import { isUnlocked, type WalletInfo } from '@/lib/console-wallets/vault';
import { cn } from '@/lib/utils';
import type { BlueprintCard, DeploymentView, ProjectOverview } from './api';
import { studioSignerScope } from './useDeployRunner';
import { Appear, Bone, Button, shortId, type Tone } from './ui';

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

const DOT: Record<Tone, string> = {
  neutral: 'bg-zinc-300 dark:bg-zinc-600',
  good: 'bg-emerald-500 dark:bg-emerald-400',
  warn: 'bg-amber-500 dark:bg-amber-400',
  bad: 'bg-red-600 dark:bg-red-400',
  info: 'bg-[#0061E2] dark:bg-[#5f9dff]',
  prod: 'bg-zinc-900 dark:bg-zinc-100',
};

/** A state as a dot and a short word: amber when the builder has something to do, emerald when it is done. */
export function StatusMark({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300',
        className,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[tone])} />
      {children}
    </span>
  );
}

/** The dot alone, for a line of text that carries its own words. */
export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[tone], className)} />;
}

/**
 * Whether content that replaces its skeleton should fade in. Only when the
 * skeleton was on screen long enough to see: content that is ready at once,
 * as on a tab switch, shows without a second fade over the pane's own.
 */
export function useFadeIn(loading: boolean) {
  const since = useRef<number | null>(null);
  const fade = useRef(false);
  if (loading) {
    since.current ??= performance.now();
  } else if (since.current !== null) {
    fade.current = performance.now() - since.current > 120;
    since.current = null;
  }
  return fade.current;
}

/** Fades in when its content arrived late or when `id` changes later; content there at mount shows at once. */
export function Arrive({
  id,
  fade,
  className,
  children,
}: {
  id: string;
  fade: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [first] = useState(id);
  return fade || id !== first ? (
    <Appear key={id} className={className}>
      {children}
    </Appear>
  ) : (
    <div className={className}>{children}</div>
  );
}

const CARD = 'flex min-w-0 flex-col border transition-colors';
const CARD_ON = 'border-zinc-900 dark:border-zinc-100';
const CARD_OFF = 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600';
const CARD_STILL = 'border-zinc-200 dark:border-zinc-800';
const PICK = 'flex w-full min-w-0 flex-col gap-1 px-4 py-3 text-left disabled:cursor-default';
const LINE = 'text-[12.5px] leading-snug text-zinc-500 dark:text-zinc-400';
const TEXT_ACTION =
  'font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';
const SAVE_KEY = cn(TEXT_ACTION, 'text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200');
const DISCLOSURE =
  'inline-flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';
const BROWSER_ONLY_LINE = 'A Console wallet lives in this browser only. Save its key, or you lose it.';

/** "A", "A and B", "A, B and C". */
const andList = (items: string[]) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
        on ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-300 dark:border-zinc-700',
      )}
    >
      {on && <span className="h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
    </span>
  );
}

/** One option's first line: its mark, its name, and its state on the right. */
function OptionHead({ lead, title, state }: { lead: React.ReactNode; title: string; state?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {lead}
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{title}</span>
      {state}
    </span>
  );
}

/** The step's height at rest, per project and plan signer, so coming back to the tab holds the same space. */
const restingHeight = new Map<string, number>();

type Shape = { open: boolean; fund: boolean };

/**
 * What the step will most likely show once the wallets load, from what the
 * browser already knows: the saved choice, the header's Console wallet, the
 * connected address and which keys are unlocked in this tab.
 */
function likelyShape(scope: string, pinned: string | null, browserAddress: string | null): Shape {
  if (typeof window === 'undefined') return { open: true, fund: false };
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (pinned) return { open: !(browserAddress && same(browserAddress, pinned)), fund: false };
  const choice = getActiveConsoleWallet() ?? readChoice(scope);
  if (!choice) return { open: true, fund: false };
  if (choice === 'browser') return { open: !browserAddress, fund: false };
  return { open: !isUnlocked(choice), fund: true };
}

/** Holds the step's place while the wallets load: the two option cards, or the one summary row. */
function WalletSkeleton({ shape, height }: { shape: Shape; height?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading wallets"
      style={height ? { height } : undefined}
      className="flex flex-col gap-3 overflow-hidden"
    >
      {shape.open ? (
        <div className="grid flex-1 items-stretch gap-2 @xl:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={cn(
                'flex flex-col gap-2.5 border border-zinc-200 px-4 py-3.5 dark:border-zinc-800',
                i === 0 ? 'min-h-[66px]' : 'min-h-[104px]',
              )}
            >
              <span className="flex items-center gap-2.5">
                <Bone className="h-3.5 w-3.5 shrink-0" delay={i * 0.06} />
                <Bone className="h-3 w-28" delay={0.02 + i * 0.06} />
              </span>
              <Bone className="ml-6 h-2.5 w-44 max-w-[70%]" delay={0.04 + i * 0.06} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-[46px] shrink-0 items-center gap-3 border border-zinc-200 px-4 dark:border-zinc-800">
          <Bone className="h-3 w-28" />
          <Bone className="h-3 w-24" delay={0.08} />
          <span className="flex-1" />
          <Bone className="h-3 w-14" delay={0.16} />
        </div>
      )}
      {shape.fund && <Bone className="h-2.5 w-40 shrink-0" delay={0.2} />}
    </div>
  );
}

/**
 * Step one of every Studio flow: who signs. A deployment that already has a
 * signer stays with it; otherwise the choice is saved for the project.
 */
export function StudioWalletStep({
  overview,
  view,
  funding: fundingState,
  pending = false,
}: {
  overview: ProjectOverview;
  view: DeploymentView | null;
  funding: StudioFunding;
  /** The open plan is still loading, so its signer is not known yet. */
  pending?: boolean;
}) {
  const pinnedAddress = view?.signer ?? null;
  const { signer: state, chains, funds, short } = fundingState;
  const [editing, setEditing] = useState(false);
  const [funding, setFunding] = useState(false);
  const [dialog, setDialog] = useState<WalletDialog>(null);
  const [manage, setManage] = useState(false);
  const isShort = short.length > 0;

  const loading = pending || !state.ready;
  const ready = state.ready && !!state.choice && !state.needs;
  const open = !ready || editing;
  const wallet = state.wallet;
  const pinned = state.pinned;
  const address = wallet?.address ?? (state.choice === 'browser' ? state.browserAddress : null);
  // The header's Console wallet stands in for the browser wallet's address; that is not a browser wallet connected.
  const browserAddress =
    state.browserAddress && !state.wallets.some((w) => getAddress(w.address) === getAddress(state.browserAddress!))
      ? state.browserAddress
      : null;

  const scope = studioSignerScope(overview.project.id);
  const heightKey = `${scope}:${pinnedAddress ?? ''}`;
  const [guess] = useState(() => likelyShape(scope, pinnedAddress, state.browserAddress));
  const fade = useFadeIn(loading);
  const body = useRef<HTMLDivElement>(null);
  const resting = !loading && !editing && !funding;
  useEffect(() => {
    const el = body.current;
    if (!el || !resting) return;
    const save = () => restingHeight.set(heightKey, el.offsetHeight);
    save();
    const observer = new ResizeObserver(save);
    observer.observe(el);
    return () => observer.disconnect();
  }, [heightKey, resting]);

  // A plan that has ended needs no signature, so its wallet's state is shown without the amber call to act.
  const ended = view?.status === 'succeeded' || view?.status === 'failed' || view?.status === 'cancelled';
  // The balances are read on every visit; until they answer, the funding words wait instead of flipping.
  const checking = !!wallet && !fundingState.checked;
  const need: [Tone, string] | null = loading
    ? null
    : state.needs === 'choose'
      ? ['warn', 'Choose one']
      : state.needs === 'connect'
        ? ['warn', 'Not connected']
        : state.needs === 'unlock'
          ? ['warn', 'Locked']
          : state.needs === 'mismatch'
            ? ['warn', 'Other address']
            : checking
              ? null
              : isShort
                ? ['warn', 'Needs funds']
                : wallet && !wallet.backedUp
                  ? ['warn', 'Key not saved']
                  : ['good', 'Ready'];
  const status: [Tone, string] | null = need && ended && need[0] === 'warn' ? ['neutral', need[1]] : need;

  const showBrowser = !pinned || state.choice === 'browser';
  const listed = state.wallets.filter((w) => !pinned || getAddress(w.address) === pinned);
  const unsaved = listed.some((w) => !w.backedUp);
  const options = (showBrowser ? 1 : 0) + Math.max(listed.length, pinned ? 0 : 1);

  const browserLine = pinned
    ? ended
      ? `This plan was signed by ${shortId(pinned)}.`
      : state.needs === 'mismatch'
        ? `This plan is signed by ${shortId(pinned)}. Switch your browser wallet to it.`
        : `This plan is signed by ${shortId(pinned)}. Connect it from the header.`
    : state.choice === 'browser' && !browserAddress
      ? 'Connect it from the header first.'
      : 'You confirm each transaction.';

  const walletCard = (w: WalletInfo) => {
    const on = state.choice === w.id;
    return (
      <div key={w.id} className={cn(CARD, on ? CARD_ON : pinned ? CARD_STILL : CARD_OFF)}>
        <button
          type="button"
          role="radio"
          aria-checked={on}
          disabled={!!pinned}
          onClick={() => state.choose(w.id)}
          className={PICK}
        >
          <OptionHead
            lead={<Radio on={on} />}
            title={w.label}
            state={
              w.unlocked ? (
                <StatusMark tone="good">Unlocked</StatusMark>
              ) : (
                <StatusMark tone={on ? 'warn' : 'neutral'}>Locked</StatusMark>
              )
            }
          />
          <span className={cn(LINE, 'pl-6')}>
            <span className="font-mono text-[11.5px] text-zinc-600 dark:text-zinc-300">{shortId(w.address)}</span> ·{' '}
            {pinned ? 'This plan is signed by this wallet.' : 'Signs each step without a popup.'}
          </span>
        </button>
        {((on && !w.unlocked) || !w.backedUp) && (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 pl-10 pr-4">
            {on && !w.unlocked && (
              <Button variant="secondary" className="h-7" onClick={() => setDialog({ kind: 'unlock', wallet: w })}>
                Unlock
              </Button>
            )}
            {!w.backedUp && (
              <button type="button" className={SAVE_KEY} onClick={() => setDialog({ kind: 'show', wallet: w })}>
                Save key
              </button>
            )}
          </span>
        )}
      </div>
    );
  };

  const picker = (
    <>
      <div
        role="radiogroup"
        aria-label="Signing wallet"
        className={cn('grid items-stretch gap-2', options > 1 && '@xl:grid-cols-2')}
      >
        {showBrowser && (
          <div className={cn(CARD, state.choice === 'browser' ? CARD_ON : pinned ? CARD_STILL : CARD_OFF)}>
            <button
              type="button"
              role="radio"
              aria-checked={state.choice === 'browser'}
              disabled={!!pinned}
              onClick={() => state.choose('browser')}
              className={PICK}
            >
              <OptionHead
                lead={<Radio on={state.choice === 'browser'} />}
                title="Browser wallet"
                state={
                  browserAddress ? (
                    <span className="font-mono text-[11.5px] text-zinc-600 dark:text-zinc-300">
                      {shortId(browserAddress)}
                    </span>
                  ) : state.choice === 'browser' ? undefined : (
                    <StatusMark>Not connected</StatusMark>
                  )
                }
              />
              <span className={cn(LINE, 'pl-6')}>{browserLine}</span>
            </button>
          </div>
        )}
        {listed.map(walletCard)}
        {listed.length === 0 && !pinned && (
          <div className={cn(CARD, CARD_STILL)}>
            <span className="flex flex-col gap-1 px-4 pt-3">
              <OptionHead lead={<KeyRound className="h-3.5 w-3.5 shrink-0 text-zinc-400" />} title="Console wallet" />
              <span className={cn(LINE, 'pl-6')}>Signs each step without a popup.</span>
            </span>
            <span className="flex flex-wrap items-center gap-2 pb-3 pl-10 pr-4 pt-2.5">
              <Button variant="secondary" className="h-7" onClick={() => setDialog({ kind: 'create' })}>
                <Plus className="h-3.5 w-3.5" /> Create
              </Button>
              <Button variant="ghost" className="h-7 px-2" onClick={() => setDialog({ kind: 'import' })}>
                <Upload className="h-3.5 w-3.5" /> Import key
              </Button>
            </span>
          </div>
        )}
      </div>
      {unsaved && (
        <p className={cn(LINE, 'flex items-start gap-2')}>
          <Dot tone="warn" className="mt-[6px]" />
          {BROWSER_ONLY_LINE}
        </p>
      )}
      {(listed.length > 0 && !pinned) || (ready && editing) ? (
        <div className="flex flex-wrap items-center gap-1">
          {listed.length > 0 && !pinned && (
            <>
              <Button variant="ghost" className="h-7 px-2" onClick={() => setDialog({ kind: 'create' })}>
                <Plus className="h-3.5 w-3.5" /> New Console wallet
              </Button>
              <Button variant="ghost" className="h-7 px-2" onClick={() => setDialog({ kind: 'import' })}>
                <Upload className="h-3.5 w-3.5" /> Import key
              </Button>
              <Button variant="ghost" className="h-7 px-2" onClick={() => setManage(true)}>
                <Settings2 className="h-3.5 w-3.5" /> Manage
              </Button>
            </>
          )}
          {ready && editing && (
            <Button variant="secondary" className="ml-auto h-7" onClick={() => setEditing(false)}>
              Done
            </Button>
          )}
        </div>
      ) : null}
    </>
  );

  const summary = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
        {wallet ? wallet.label : 'Browser wallet'}
      </span>
      {address && <HashChip value={address} len={6} className="[&>span]:text-[12px]" />}
      <span className={cn(LINE, 'hidden @lg:inline')}>
        {wallet ? 'Signs each step without a popup.' : 'You confirm each transaction.'}
      </span>
      <span className="flex-1" />
      {wallet && !wallet.backedUp && (
        <button type="button" className={SAVE_KEY} onClick={() => setDialog({ kind: 'show', wallet })}>
          Save key
        </button>
      )}
      {pinnedAddress ? (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
          Set by this plan
        </span>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className={TEXT_ACTION}>
          Change
        </button>
      )}
    </div>
  );

  // Funding stays one quiet line: the shortfall in amber with a way to fix it, or a closed disclosure when nothing is short.
  const fund = wallet && !editing && (
    <div className="flex flex-col gap-3">
      {checking ? (
        <span role="status" aria-label="Checking the balance" className="flex h-[17px] items-center">
          <Bone className="h-2.5 w-52" />
        </span>
      ) : isShort ? (
        <p className={cn(LINE, 'flex items-start gap-2')}>
          <Dot tone="warn" className="mt-[6px]" />
          <span>
            Needs gas on {andList(short.map((c) => c.name))}.{' '}
            <button
              type="button"
              onClick={() => setFunding((f) => !f)}
              aria-expanded={funding}
              className={cn(TEXT_ACTION, 'ml-1')}
            >
              {funding ? 'Hide' : 'Fund'}
            </button>
          </span>
        </p>
      ) : (
        <button type="button" onClick={() => setFunding((f) => !f)} aria-expanded={funding} className={DISCLOSURE}>
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', funding && 'rotate-90')} />
          Fund this wallet
          {chains.length > 0 && ` · ${chains.length} chain${chains.length === 1 ? '' : 's'}`}
        </button>
      )}
      {funding && (
        <Appear className="border-zinc-200 @lg:border-l @lg:pl-4 dark:border-zinc-800">
          <FundWallet address={wallet.address} chains={chains} funds={funds} />
        </Appear>
      )}
    </div>
  );

  return (
    <section aria-label="Signing wallet" className="@container flex flex-col gap-3">
      <SectionHeader
        label="Signing wallet"
        action={
          status ? <StatusMark tone={status[0]}>{status[1]}</StatusMark> : <Bone className="h-2.5 w-20" delay={0.1} />
        }
      />
      <div ref={body} style={loading || checking ? { minHeight: restingHeight.get(heightKey) } : undefined}>
        {loading ? (
          <WalletSkeleton shape={guess} height={restingHeight.get(heightKey)} />
        ) : (
          <Arrive id={open ? 'pick' : 'set'} fade={fade} className="flex flex-col gap-3">
            {open ? picker : summary}
            {fund}
          </Arrive>
        )}
      </div>
      <WalletDialogs open={dialog} setOpen={setDialog} onCreated={(w) => !pinned && state.choose(w.id)} />
      {manage && <ConsoleWalletsDialog onClose={() => setManage(false)} />}
    </section>
  );
}
