'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Loader2,
  Minus,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react';
import { Board, BoardHeader, HashChip, MUTED, idInk } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { L1_BLUEPRINT, api, errorText, type DeploymentView, type NextAction } from './api';
import { syncDeployedRegistry, syncLaunchedL1 } from './console-sync';
import { WalletPicker } from '@/components/console-wallets/WalletPicker';
import { studioSignerScope, useDeployRunner } from './useDeployRunner';
import { Appear, Bone, Button, LABEL, Notice, Pill, WorkingMark, shortId, timeAgo } from './ui';

/* ------------------------------------------------------------------ */
/* Shared marks for the Deploy, Networks and Production tabs.          */

const DOT = {
  idle: 'bg-zinc-400 dark:bg-zinc-500',
  live: 'bg-[#0061E2] dark:bg-[#5f9dff]',
  good: 'bg-emerald-500 dark:bg-emerald-400',
  warn: 'bg-amber-400',
  bad: 'bg-red-600 dark:bg-red-400',
} as const;

export type MarkTone = keyof typeof DOT;

/** A status as a dot and a short word: quieter than a bordered pill, so a list scans by colour first. */
export function StatusMark({
  tone,
  pulse = false,
  children,
  className,
}: {
  tone: MarkTone;
  /** A ping ring, for work that is happening right now. */
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        tone === 'bad' ? 'text-red-700 dark:text-red-300' : 'text-zinc-600 dark:text-zinc-300',
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden',
              DOT[tone],
            )}
          />
        )}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', DOT[tone])} />
      </span>
      {children}
    </span>
  );
}

/** A deployment's state in the Plan tab's words, so every tab names it the same way. */
const DEPLOYMENT_STATUS: Record<string, [MarkTone, string]> = {
  proposed: ['warn', 'Not deployed'],
  running: ['warn', 'In progress'],
  succeeded: ['good', 'Deployed'],
  failed: ['bad', 'Failed'],
  cancelled: ['idle', 'Cancelled'],
};

export const deploymentStatus = (status: string): [MarkTone, string] => DEPLOYMENT_STATUS[status] ?? ['idle', status];

/** A closed "How this works" for the explanation a state does not need up front. */
export function HowItWorks({ children, label = 'How this works' }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="group">
      <summary
        className={cn(
          LABEL,
          'flex w-fit cursor-pointer select-none list-none items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 [&::-webkit-details-marker]:hidden',
        )}
      >
        <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
        {label}
      </summary>
      <div className="mt-2 max-w-prose pl-4 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {children}
      </div>
    </details>
  );
}

/** The step marks: a check when done, the red square on the current step, a hollow square still to come. */
export function StepMarker({ status, current, busy = false }: { status?: string; current: boolean; busy?: boolean }) {
  if (status === 'done') return <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (status === 'skipped') return <Minus className="h-3.5 w-3.5 text-zinc-400" />;
  if (status === 'failed') return <CircleAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
  if (current && busy) return <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-900 dark:text-zinc-100" />;
  if (current) return <span className="h-2 w-2 bg-[#E6212F]" />;
  return <span className="h-2 w-2 border border-zinc-300 dark:border-zinc-700" />;
}

/** Network keys to the names the builder reads, from every blueprint's network choices. */
export function networkNamesOf(
  blueprints: { networks: Record<string, { allowed: { key: string; name: string }[] }> }[],
) {
  const names: Record<string, string> = {};
  for (const b of blueprints)
    for (const role of Object.values(b.networks)) for (const n of role.allowed) names[n.key] ??= n.name;
  return names;
}

/* ------------------------------------------------------------------ */

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = cn('inline-flex items-center gap-1 font-mono text-[11px] underline-offset-2 hover:underline', idInk);
  return href.startsWith('/') ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

type JobTx = { label: string | null; chain: string; hash: string; url: string | null };
type JobStep = { label: string; status: 'done' | 'current' | 'pending' | 'failed'; txs?: JobTx[] };

const CHAIN_TAG: Record<string, string> = { 'p-chain': 'P', 'c-chain': 'C', l1: 'L1' };

/** Quick L1 names two of its steps by the P-Chain's Subnet object; builders read them as L1 steps. */
const JOB_LABEL: Record<string, string> = {
  'Creating Subnet': 'Creating the L1',
  'Converting Subnet to L1': 'Converting to an L1',
};
const jobLabel = (label: string) => JOB_LABEL[label] ?? label;

function TxLine({ tx }: { tx: JobTx }) {
  return (
    <span className="flex min-w-0 items-center gap-2 font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">
      <span className="w-5 shrink-0 text-zinc-400">{CHAIN_TAG[tx.chain] ?? tx.chain}</span>
      {tx.url ? (
        <Link href={tx.url} className={cn(idInk, 'shrink-0')} title={tx.hash}>
          {shortId(tx.hash, 10, 8)}
        </Link>
      ) : (
        <span className="shrink-0" title={tx.hash}>
          {shortId(tx.hash, 10, 8)}
        </span>
      )}
      {tx.label && <span className="min-w-0 truncate">{tx.label}</span>}
    </span>
  );
}

/** A platform job's own steps, marked the way the deploy steps are, each with the transactions it signed. */
function JobSteps({ steps }: { steps: JobStep[] }) {
  return (
    <span className="flex flex-col gap-1">
      {steps.map((s) => (
        <span key={s.label} className="flex flex-col gap-0.5">
          <span
            className={cn(
              'flex items-center gap-2 font-mono text-[11px]',
              s.status === 'pending'
                ? 'text-zinc-400 dark:text-zinc-500'
                : s.status === 'failed'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-700 dark:text-zinc-300',
            )}
          >
            <span className="flex w-4 shrink-0 justify-center">
              {s.status === 'current' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <StepMarker status={s.status} current={false} />
              )}
            </span>
            {jobLabel(s.label)}
          </span>
          {s.txs && s.txs.length > 0 && (
            <span className="flex flex-col gap-0.5 pl-6">
              {s.txs.map((tx) => (
                <TxLine key={tx.hash} tx={tx} />
              ))}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** Folded when everything finished, open when something didn't. */
function JobStepsSummary({ steps }: { steps: JobStep[] }) {
  const done = steps.filter((s) => s.status === 'done').length;
  return (
    <details className="group" open={done < steps.length}>
      <summary
        className={cn(
          LABEL,
          'flex w-fit cursor-pointer select-none list-none items-center gap-1 [&::-webkit-details-marker]:hidden',
        )}
      >
        <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
        Launch steps · {done} of {steps.length} done
      </summary>
      <div className="mt-2">
        <JobSteps steps={steps} />
      </div>
    </details>
  );
}

/**
 * A running platform job at a glance: the step it is on, in motion, and where that sits in the whole. The status
 * text and every step with its transactions fold under Show steps. A step that failed while another still runs
 * (the node wait) is left for Studio to finish, so the bar shows it as not done, not as an alarm.
 */
function JobProgress({ steps, detail, link }: { steps: JobStep[]; detail: string; link?: string }) {
  const reduced = useReducedMotion();
  const working = steps.some((s) => s.status === 'current');
  const at = (['current', 'failed', 'pending'] as const)
    .map((status) => steps.findIndex((s) => s.status === status))
    .find((i) => i >= 0);
  const index = at ?? steps.length - 1;
  const step = steps[index];
  const done = steps.filter((s) => s.status === 'done').length;
  if (!step) return null;
  return (
    <span className="flex flex-col gap-3">
      <span role="status" aria-live="polite" className="flex items-center gap-3">
        {working ? <WorkingMark size="md" /> : <StepMarker status={step.status} current={false} />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={step.label}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'text-[14px] font-medium',
              step.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100',
            )}
          >
            {jobLabel(step.label)}
          </motion.span>
        </AnimatePresence>
      </span>
      <Progress
        steps={steps.map((s, i) => ({
          id: String(i),
          state: { status: s.status === 'failed' && working ? 'pending' : s.status },
        }))}
        currentId={String(index)}
        finished={false}
        busy={working}
      />
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
        {done} of {steps.length} done
        {link && <ActionLink href={link}>Track it</ActionLink>}
      </span>
      <details className="group">
        <summary
          className={cn(
            LABEL,
            'flex w-fit cursor-pointer select-none list-none items-center gap-1 [&::-webkit-details-marker]:hidden',
          )}
        >
          <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          Show steps
        </summary>
        <span className="mt-3 flex flex-col gap-3">
          <span className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{detail}</span>
          <JobSteps steps={steps} />
        </span>
      </details>
    </span>
  );
}

/** A one-line live status under the current step; the step's own marker carries the spinner. */
function LiveLine({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
      {children}
    </span>
  );
}

/** What the current step needs right now, shown under that step so the eye stays in one place. */
function StepAction({
  action,
  busy,
  silent,
  onConfirm,
  onSkip,
  onConfirmProduction,
}: {
  action: Exclude<NextAction, { kind: 'done' }>;
  busy: boolean;
  /** A Console wallet signs, so there is no wallet popup to confirm. */
  silent: boolean;
  onConfirm: (stepId: string) => void;
  onSkip: (stepId: string) => void;
  onConfirmProduction: () => void;
}) {
  switch (action.kind) {
    case 'tx':
      return busy ? (
        <LiveLine>
          {silent ? 'Your Console wallet is signing this step.' : 'Confirm this transaction in your wallet.'}
        </LiveLine>
      ) : null;
    case 'pending':
      return <LiveLine>Waiting for the transaction to be mined.</LiveLine>;
    case 'wait':
      return action.progress?.length ? (
        <JobProgress steps={action.progress} detail={action.detail} link={action.link} />
      ) : (
        <LiveLine>
          <span>{action.detail}</span>
          {action.link && <ActionLink href={action.link}>Track it</ActionLink>}
        </LiveLine>
      );
    case 'manual':
      return (
        <span className="flex flex-col gap-3">
          <span className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">{action.detail}</span>
          <span className="flex flex-wrap items-center gap-3">
            {action.canConfirm && <Button onClick={() => onConfirm(action.stepId)}>Mark as done</Button>}
            {action.link && <ActionLink href={action.link}>Open</ActionLink>}
            {action.canSkip && (
              <Button variant="ghost" onClick={() => onSkip(action.stepId)}>
                Skip optional step
              </Button>
            )}
          </span>
        </span>
      );
    case 'blocked':
      return (
        <span className="flex flex-col gap-2">
          <Notice tone="bad">This step cannot run yet. {action.detail}</Notice>
          {action.canSkip && (
            <span>
              <Button variant="ghost" onClick={() => onSkip(action.stepId)}>
                Skip optional step
              </Button>
            </span>
          )}
        </span>
      );
    case 'confirm-production':
      return (
        <span className="flex flex-col gap-3 border border-zinc-900 p-4 dark:border-zinc-100">
          <span className={LABEL}>Production transaction · {action.network}</span>
          <pre className="overflow-x-auto bg-zinc-50 p-3 font-mono text-[11px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {`${action.display.contract}${action.display.function ? `.${action.display.function}` : ' (deploy)'}(${action.display.args.map((a) => JSON.stringify(a)).join(', ')})${
              action.request.value !== '0' ? `\nvalue: ${action.request.value} wei` : ''
            }${action.request.to ? `\nto: ${action.request.to}` : ''}`}
          </pre>
          <span>
            <Button onClick={onConfirmProduction} busy={busy}>
              Confirm and sign
            </Button>
          </span>
        </span>
      );
  }
}

/** One segment per step: ink when done, the red accent on the current step, a light sweep across it while it runs. */
function Progress({
  steps,
  currentId,
  finished,
  busy,
}: {
  steps: { id: string; state: { status?: string } | null }[];
  currentId?: string;
  finished: boolean;
  busy: boolean;
}) {
  return (
    <div className="flex gap-px" aria-hidden>
      {steps.map((s) => {
        const status = s.state?.status;
        const current = s.id === currentId && !finished && status !== 'failed';
        return (
          <span
            key={s.id}
            className={cn(
              'relative h-[3px] flex-1 overflow-hidden transition-colors duration-500',
              status === 'done'
                ? 'bg-zinc-900 dark:bg-zinc-100'
                : status === 'skipped'
                  ? 'bg-zinc-300 dark:bg-zinc-600'
                  : status === 'failed'
                    ? 'bg-red-600 dark:bg-red-400'
                    : current
                      ? 'bg-[#E6212F]'
                      : 'bg-zinc-200 dark:bg-zinc-800',
            )}
          >
            {current && busy && (
              <span
                data-studio-bone
                className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/40"
                style={{ animation: 'studio-bone-sweep 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite' }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

/** A quiet success line: a check and one sentence, no tinted box. */
function Done({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
      <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>{children}</span>
    </p>
  );
}

/** A skeleton bar for a Board's tinted surface, where the default bar would vanish. */
export function BoardBone({ className, delay }: { className?: string; delay?: number }) {
  return <Bone className={cn('bg-zinc-200/80 dark:bg-zinc-800', className)} delay={delay} />;
}

/* The runner's geometry, shared by the skeleton so the two line up to the pixel. */
// Title and action side by side above the progress bar; on a phone the action goes under the bar.
const HEADER = 'grid grid-cols-1 gap-3 px-5 pb-4 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6 md:px-6';
const HEADER_ACTION = 'order-3 flex items-start sm:order-none sm:col-start-2 sm:row-start-1';
const HEADER_BAR = 'order-2 sm:order-none sm:col-span-2';
const STEP_ROW = 'flex items-center gap-3 px-5 py-2.5 md:px-6';
const STEP_NUMBER = 'hidden w-5 shrink-0 font-mono text-[10px] sm:block';
// The step title's left edge: no number column on a phone.
const STEP_INDENT = 'pb-3 pl-12 pr-5 sm:pl-20 md:pl-[5.25rem] md:pr-6';
const FOOTER = 'flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-1.5 md:px-6';
const SECTION = 'flex flex-col gap-3 px-5 py-4 md:px-6';

/** The runner's shape while its deployment loads, so nothing moves when the steps arrive. */
export function RunnerSkeleton({
  rows = 4,
  steps,
  finished = false,
  wallet = false,
  pinned = false,
  checks = finished ? 3 : 0,
  failed = false,
}: {
  /** How many steps the plan has. */
  rows?: number;
  /** The plan's steps, when known, so a title that wraps on a phone gets a second line. */
  steps?: { title: string; optional?: boolean }[];
  /** A finished deployment shows its checks and no run controls. */
  finished?: boolean;
  /** The signing wallet still has to be set up, so its section shows above the steps. */
  wallet?: boolean;
  /** A step already ran, so the wallet section is one line naming the wallet that signed it. */
  pinned?: boolean;
  /** How many check results to draw under the steps. */
  checks?: number;
  /** A check failed, so the failure line shows above the checks. */
  failed?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading deployment">
      <Board>
        <div className={HEADER}>
          <span className="flex min-w-0 flex-col">
            <span className="flex h-[22px] items-center">
              <BoardBone className="h-4 w-44" />
            </span>
            <span className="mt-1 flex h-4 items-center">
              <BoardBone className="h-2.5 w-24" delay={0.04} />
            </span>
            <span className="mt-1 flex h-4 items-center">
              <BoardBone className="h-2.5 w-72 max-w-full" delay={0.04} />
            </span>
            <span className="flex h-4 items-center sm:hidden">
              <BoardBone className="h-2.5 w-20" delay={0.04} />
            </span>
          </span>
          {!finished && (
            <span className={HEADER_ACTION}>
              <BoardBone className="h-8 w-40" delay={0.08} />
            </span>
          )}
          <BoardBone className={cn(HEADER_BAR, 'h-[3px] w-full')} />
        </div>
        {wallet && !finished && (
          <div className={SECTION}>
            <span className="flex h-4 items-center justify-between">
              <BoardBone className="h-2.5 w-28" />
              <BoardBone className="h-2.5 w-16" />
            </span>
            {pinned ? (
              <span className="flex h-[21px] items-center">
                <BoardBone className="h-3 w-96 max-w-full" delay={0.04} />
              </span>
            ) : (
              <>
                {/* The picker's card, its two buttons and its key line, which all wrap on a phone. */}
                <BoardBone className="h-[132px] w-full sm:h-20" delay={0.04} />
                <span className="flex flex-wrap gap-2">
                  <BoardBone className="h-8 w-56" delay={0.08} />
                  <BoardBone className="h-8 w-32" delay={0.08} />
                </span>
                <span className="flex h-[33px] flex-col justify-center gap-2 sm:h-4">
                  <BoardBone className="h-2.5 w-64 max-w-full" delay={0.12} />
                  <BoardBone className="h-2.5 w-36 sm:hidden" delay={0.12} />
                </span>
              </>
            )}
          </div>
        )}
        {Array.from({ length: steps?.length ?? rows }).map((_, i) => {
          // A title that wraps on a phone: about 34 characters fit beside the marker, an "optional" tag takes 9.
          const long = !!steps && steps[i].title.length + (steps[i].optional ? 9 : 0) > 34;
          return (
            <div key={i} className={STEP_ROW}>
              <span className={STEP_NUMBER}>
                <BoardBone className="h-2.5 w-5" delay={i * 0.04} />
              </span>
              <span className="flex w-4 shrink-0 justify-center">
                <BoardBone className="h-2 w-2" delay={i * 0.04} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex h-5 items-center">
                  <BoardBone className="h-3 w-52 max-w-full" delay={i * 0.04} />
                </span>
                {long && (
                  <span className="flex h-5 items-center sm:hidden">
                    <BoardBone className="h-3 w-24" delay={i * 0.04} />
                  </span>
                )}
              </span>
            </div>
          );
        })}
        {!finished && (
          <div className={FOOTER}>
            <BoardBone className="h-2.5 w-56 max-w-[60%]" />
            <BoardBone className="h-2.5 w-28" delay={0.04} />
          </div>
        )}
      </Board>
      {failed && <Bone className="h-[41px] w-full" />}
      {checks > 0 && (
        <Board>
          <div className="flex min-h-9 items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-5 py-2 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/40">
            <BoardBone className="h-2.5 w-14" />
            <BoardBone className="h-2.5 w-16" />
          </div>
          {Array.from({ length: checks }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-2.5 md:px-6">
              <BoardBone className="h-3.5 w-3.5" delay={i * 0.04} />
              <span className="flex h-5 min-w-0 flex-1 items-center">
                <BoardBone className="h-3 w-72 max-w-full" delay={i * 0.04} />
              </span>
            </div>
          ))}
        </Board>
      )}
    </div>
  );
}

/** The last view of each deployment, so coming back to a tab paints it at once while it refreshes. */
const VIEWS = new Map<string, DeploymentView>();

const DEFAULT_SKIP = 'Skipped by the builder';
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Steps one deployment. `autoStart` runs it without a click; it also picks a
 * run back up after the panel remounts, e.g. when the builder switches tabs
 * during an L1 launch.
 */
export function Runner({
  projectId,
  deploymentId,
  autoStart,
  onChanged,
  onFinishSetup,
  onReplan,
  onPromote,
  networkNames,
  skeleton,
}: {
  projectId: string;
  deploymentId: string;
  autoStart: boolean;
  onChanged: () => void;
  /** Plans what a launch that stopped early left undone. */
  onFinishSetup?: () => Promise<void>;
  /** Opens the plan, for a deployment that ended and has to be planned again. */
  onReplan?: () => void;
  /** Opens the Production tab, for a testnet deployment that succeeded. */
  onPromote?: () => void;
  /** Network keys to names, so a step reads "Avalanche Fuji C-Chain", not its key. */
  networkNames?: Record<string, string>;
  /** What the panel already knows of the deployment, so the skeleton has its shape. */
  skeleton?: {
    rows?: number;
    steps?: { title: string; optional?: boolean }[];
    finished?: boolean;
    started?: boolean;
    checks?: number;
    failed?: boolean;
  };
}) {
  const runner = useDeployRunner(projectId, deploymentId, onChanged);
  const { view } = runner;
  const reduced = useReducedMotion();
  const started = useRef(false);
  const stepsRef = useRef<HTMLDivElement>(null);
  // Painted from the cache, so the content is already in place and does not fade in again.
  const [warm] = useState(() => VIEWS.has(deploymentId));
  const [paused, setPaused] = useState(false);
  const [addedToConsole, setAddedToConsole] = useState<{ name: string; relayer: boolean } | null>(null);
  const [registrySaved, setRegistrySaved] = useState<string | null>(null);
  const [nodesAdded, setNodesAdded] = useState(0);
  const nodesChecked = useRef(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  // Launches bound before Studio registered nodes itself still get them listed under Testnet Nodes.
  useEffect(() => {
    if (view?.status !== 'succeeded' || view.blueprintId !== L1_BLUEPRINT || nodesChecked.current) return;
    nodesChecked.current = true;
    api<{ added: number }>(`/api/studio/projects/${projectId}/deployments/${deploymentId}/nodes`, { method: 'POST' })
      .then((r) => setNodesAdded(r.added))
      .catch(() => {});
  }, [view?.status, view?.blueprintId, projectId, deploymentId]);

  useEffect(() => {
    if (!view) return;
    VIEWS.set(view.id, view);
    const synced = syncLaunchedL1(view);
    if (synced?.added) setAddedToConsole(synced);
    const registry = syncDeployedRegistry(view);
    if (registry) setRegistrySaved(registry.name);
  }, [view]);

  useEffect(() => {
    if (
      autoStart &&
      (view?.status === 'proposed' || view?.status === 'running') &&
      runner.address &&
      !started.current
    ) {
      started.current = true;
      void runner.run({ continuous: true });
    }
  }, [autoStart, runner, view?.status]);

  const action = runner.action && runner.action.kind !== 'done' ? runner.action : null;
  // A card that asks for a click: bring its step into view, clear of the sticky tabs, wherever the click was.
  const askStepId =
    action && (action.kind === 'manual' || action.kind === 'blocked' || action.kind === 'confirm-production')
      ? action.stepId
      : null;
  useEffect(() => {
    if (!askStepId) return;
    stepsRef.current
      ?.querySelector<HTMLElement>(`[data-step="${CSS.escape(askStepId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [askStepId, reduced]);

  const shown = view ?? VIEWS.get(deploymentId) ?? null;
  if (!shown) {
    return runner.error ? (
      <Notice tone="bad">{runner.error}</Notice>
    ) : (
      <RunnerSkeleton
        rows={skeleton?.rows}
        steps={skeleton?.steps}
        finished={skeleton?.finished}
        wallet={runner.wallet.ready && !!runner.wallet.needs}
        pinned={skeleton?.started}
        checks={skeleton?.checks}
        failed={skeleton?.failed}
      />
    );
  }
  const finished = ['succeeded', 'failed', 'cancelled'].includes(shown.status);
  const currentIndex = shown.steps.findIndex((s) => s.state?.status !== 'done' && s.state?.status !== 'skipped');
  const current = currentIndex >= 0 ? shown.steps[currentIndex] : undefined;
  const currentId = current?.id;
  const currentFailed = current?.state?.status === 'failed';
  const production = shown.stage === 'production';
  const done = shown.steps.filter((s) => s.state?.status === 'done').length;
  const skipped = shown.steps.filter((s) => s.state?.status === 'skipped').length;
  const stepNumber = (id: string) => pad(shown.steps.findIndex((s) => s.id === id) + 1);

  // The network most steps run on goes in the header; a step names its network only when it differs.
  const uses = new Map<string, number>();
  for (const s of shown.steps) uses.set(s.network, (uses.get(s.network) ?? 0) + 1);
  const mainNetwork = [...uses].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mainName = mainNetwork ? networkNames?.[mainNetwork] : undefined;

  // A launch Studio kept after the service stopped: done as a step, but with its own steps left over.
  const unfinished =
    shown.status === 'succeeded'
      ? shown.steps.flatMap((s) =>
          s.state?.warning ? (s.state.progress ?? []).filter((p) => p.status !== 'done').map((p) => p.label) : [],
        )
      : [];
  const finishSetup = async () => {
    if (!onFinishSetup) return;
    setFinishing(true);
    setFinishError(null);
    try {
      await onFinishSetup();
    } catch (e) {
      setFinishError(errorText(e));
    } finally {
      setFinishing(false);
    }
  };

  const start = (options: { continuous: boolean; confirmProduction?: boolean }) => {
    setPaused(false);
    void runner.run(options);
  };
  const pause = () => {
    setPaused(true);
    runner.stop();
  };

  const actionStepId = action && shown.steps.some((s) => s.id === action.stepId) ? action.stepId : null;
  // A card that asks for a click of its own makes the run button the second choice.
  const actionLeads =
    (action?.kind === 'manual' && action.canConfirm) || action?.kind === 'confirm-production' ? true : false;
  const stepAction = action && (
    <StepAction
      action={action}
      busy={runner.busy}
      silent={runner.wallet.signer?.kind === 'console'}
      onConfirm={(id) => void runner.confirmManual(id)}
      onSkip={(id) => void runner.skip(id, DEFAULT_SKIP)}
      onConfirmProduction={() => start({ continuous: false, confirmProduction: true })}
    />
  );

  const [tone, word] = runner.busy
    ? (['live', 'Running'] as [MarkTone, string])
    : finished
      ? deploymentStatus(shown.status)
      : currentFailed && currentId
        ? (['bad', `Step ${stepNumber(currentId)} failed`] as [MarkTone, string])
        : askStepId && actionStepId
          ? (['warn', `Step ${stepNumber(askStepId)} needs you`] as [MarkTone, string])
          : paused
            ? (['warn', 'Paused'] as [MarkTone, string])
            : deploymentStatus(shown.status);

  const runLabel =
    shown.status === 'proposed'
      ? production
        ? 'Start production deployment'
        : 'Deploy to testnet'
      : currentFailed
        ? `Retry step ${pad(currentIndex + 1)}`
        : 'Continue';

  // The deployment's one action sits beside its title, so it is in view however long the plan is.
  const headerAction = finished ? (
    (shown.status === 'failed' || shown.status === 'cancelled') && onReplan ? (
      <Button variant={shown.status === 'failed' ? 'primary' : 'secondary'} onClick={onReplan}>
        <RotateCcw className="h-3.5 w-3.5" /> Plan again
      </Button>
    ) : shown.status === 'succeeded' && !production && onPromote ? (
      <Button variant="secondary" onClick={onPromote}>
        Promote to production <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    ) : null
  ) : runner.busy ? (
    <Button variant="secondary" onClick={pause}>
      <Square className="h-3 w-3" /> Pause
    </Button>
  ) : (
    <Button
      variant={actionLeads ? 'secondary' : 'primary'}
      onClick={() => start({ continuous: !production })}
      disabled={!runner.wallet.signer}
    >
      {currentFailed ? <RotateCcw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {runLabel}
    </Button>
  );

  const needsWallet = !finished && runner.wallet.ready && !!runner.wallet.needs;
  // Pinned to a browser wallet, the picker has nothing to choose: one line says which wallet to connect.
  const pinnedBrowser = runner.wallet.pinned && runner.wallet.choice === 'browser' ? runner.wallet.pinned : null;
  const signerLine = runner.wallet.signer
    ? runner.wallet.signer.kind === 'console'
      ? `Signs with ${runner.wallet.wallet?.label ?? 'your Console wallet'} ${shortId(runner.wallet.signer.address)}, no popups`
      : `Signs with your browser wallet ${shortId(runner.wallet.signer.address)}`
    : null;

  const checks = shown.checks.length > 0 && (
    <Board>
      <BoardHeader
        label="Checks"
        action={
          <span className={cn(MUTED, 'text-[11px]')}>
            {shown.checks.filter((c) => c.passed).length} of {shown.checks.length} passed
          </span>
        }
      />
      {shown.checks.map((c, i) => (
        <div key={`${c.after}-${i}`} className="flex items-start gap-3 px-5 py-2.5 md:px-6">
          {c.passed ? (
            <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <CircleAlert className="mt-[3px] h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span className="min-w-0 flex-1 text-[13px] leading-5 text-zinc-800 dark:text-zinc-200">
            {c.description}
            {!c.passed && (
              <span className={cn(MUTED, 'block break-words text-[11px] leading-4')}>
                {c.error ?? `got ${JSON.stringify(c.actual)}`}
              </span>
            )}
          </span>
        </div>
      ))}
    </Board>
  );

  const body = (
    <>
      <Board>
        <div className={HEADER}>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3
                className="min-w-0 text-[15px] font-medium leading-[22px] tracking-tight text-zinc-900 sm:truncate dark:text-zinc-50"
                title={`Deployment ${shown.id}`}
              >
                {shown.plan.title}
              </h3>
              {production && <Pill tone="prod">production</Pill>}
            </div>
            <p className="mt-1 flex flex-col items-start gap-1 leading-4">
              <StatusMark tone={tone} pulse={runner.busy}>
                {word}
              </StatusMark>
              {/* Each part stays whole, so a phone breaks the line at a separator. */}
              <span className={cn(MUTED, 'text-[11px]')}>
                <span className="whitespace-nowrap">{mainName ?? (production ? 'mainnet' : 'testnet')} ·</span>{' '}
                <span className="whitespace-nowrap">
                  {skipped > 0 ? `${done} done, ${skipped} skipped` : `${done} of ${shown.steps.length} done`} ·
                </span>{' '}
                <span className="whitespace-nowrap">
                  {finished && shown.completedAt ? `finished ${timeAgo(shown.completedAt)}` : timeAgo(shown.createdAt)}
                </span>
              </span>
            </p>
          </div>
          {headerAction && <div className={HEADER_ACTION}>{headerAction}</div>}
          <div className={HEADER_BAR}>
            <Progress steps={shown.steps} currentId={currentId} finished={finished} busy={runner.busy} />
          </div>
        </div>

        {needsWallet && (
          <div className={SECTION}>
            <span className="flex items-center justify-between gap-4">
              <span className={LABEL}>Signing wallet</span>
              <StatusMark tone="warn">Needed</StatusMark>
            </span>
            {pinnedBrowser ? (
              <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                This deployment is signed by{' '}
                <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100" title={pinnedBrowser}>
                  {shortId(pinnedBrowser)}
                </span>
                .{' '}
                {runner.wallet.needs === 'mismatch'
                  ? 'Switch your browser wallet to it.'
                  : 'Connect that wallet from the header.'}
              </p>
            ) : (
              <WalletPicker scope={studioSignerScope(projectId)} pinnedAddress={shown.signer} />
            )}
          </div>
        )}

        <div ref={stepsRef} className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {shown.steps.map((step, i) => {
            const isCurrent = step.id === currentId && !finished;
            const status = step.state?.status;
            const quiet = (!status && !isCurrent) || status === 'skipped';
            const reason = status === 'skipped' && step.state?.reason !== DEFAULT_SKIP ? step.state?.reason : null;
            const otherNetwork = step.network !== mainNetwork ? (networkNames?.[step.network] ?? step.network) : null;
            const note = [otherNetwork, reason].filter(Boolean).join(' · ');
            // Beside the title on wide screens, under it on a phone, so the title keeps its width.
            const links = (step.state?.address || step.txUrl) && (
              <>
                {step.state?.address && (
                  <HashChip value={step.state.address} href={step.addressUrl ?? undefined} len={6} />
                )}
                {step.txUrl && (
                  <a
                    href={step.txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('font-mono text-[11px]', idInk)}
                  >
                    tx
                  </a>
                )}
              </>
            );
            return (
              <div
                key={step.id}
                data-step={step.id}
                className={cn(
                  'relative scroll-mb-6 scroll-mt-32 transition-colors lg:scroll-mt-24',
                  isCurrent && 'bg-zinc-50 dark:bg-zinc-900/60',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCurrent && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-[#E6212F]" />}
                <div className={STEP_ROW}>
                  <span className={cn(STEP_NUMBER, isCurrent ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400')}>
                    {pad(i + 1)}
                  </span>
                  <span className="flex w-4 shrink-0 justify-center">
                    <StepMarker status={status} current={isCurrent} busy={isCurrent && runner.busy} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-[13px] leading-5',
                        quiet ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-50',
                        isCurrent && 'font-medium',
                      )}
                    >
                      {step.title}
                      {(status === 'skipped' || step.optional) && (
                        <span className="ml-2 whitespace-nowrap font-mono text-[10px] font-normal uppercase tracking-[0.08em] text-zinc-400">
                          {status === 'skipped' ? 'skipped' : 'optional'}
                        </span>
                      )}
                    </span>
                    {note && <span className={cn(MUTED, 'block break-words text-[11px] leading-4')}>{note}</span>}
                    {links && step.state?.address && (
                      <span className="mt-1 flex items-center gap-3 sm:hidden">{links}</span>
                    )}
                  </span>
                  {links && (
                    // A lone "tx" fits beside the title on a phone too; an address goes under it there.
                    <span
                      className={cn('shrink-0 items-center gap-3', step.state?.address ? 'hidden sm:flex' : 'flex')}
                    >
                      {links}
                    </span>
                  )}
                </div>
                {(step.state?.error || step.state?.warning) && (
                  <div className={STEP_INDENT}>
                    <Notice tone={step.state.error ? 'bad' : 'warn'}>{step.state.error ?? step.state.warning}</Notice>
                  </div>
                )}
                {step.state?.progress && step.state.progress.length > 0 && (
                  <div className={STEP_INDENT}>
                    <JobStepsSummary steps={step.state.progress} />
                  </div>
                )}
                {step.state?.evidence &&
                  step.state.evidence.length > 0 &&
                  !step.state.progress?.some((s) => s.txs?.length) && (
                    <div className={cn(STEP_INDENT, 'flex flex-col gap-1')}>
                      <span className={LABEL}>Signed by the Quick L1 service</span>
                      {step.state.evidence.map((tx) => (
                        <TxLine key={tx.hash} tx={tx} />
                      ))}
                    </div>
                  )}
                {actionStepId === step.id && stepAction && <div className={STEP_INDENT}>{stepAction}</div>}
              </div>
            );
          })}
        </div>

        {!finished && (
          <div className={FOOTER}>
            <span className={cn(MUTED, 'min-w-0 text-[11px]')}>{signerLine}</span>
            <Button
              variant="ghost"
              className="h-7 px-1.5 max-sm:-ml-1.5 sm:-mr-1.5"
              onClick={() => void runner.cancel()}
              disabled={runner.busy}
            >
              Cancel deployment
            </Button>
          </div>
        )}
      </Board>

      {!actionStepId && stepAction}
      {runner.error && <Notice tone="bad">{runner.error}</Notice>}
      {shown.status === 'failed' && <Notice tone="bad">A check failed: fix the cause, then plan again.</Notice>}

      {checks}

      {(nodesAdded > 0 || addedToConsole || registrySaved) && (
        <div className="flex flex-col gap-1.5">
          {nodesAdded > 0 && (
            <Done>
              Added {nodesAdded === 1 ? 'its validator node' : `its ${nodesAdded} validator nodes`} to{' '}
              <Link href="/console/testnet-infra/nodes" className={idInk}>
                Testnet Nodes
              </Link>
              .
            </Done>
          )}
          {addedToConsole && (
            <Done>
              Added {addedToConsole.name} to your console. Find it in{' '}
              <Link href="/console/my-l1" className={idInk}>
                My L1
              </Link>
              {addedToConsole.relayer ? ', ' : ' and '}
              <Link href="/console/testnet-infra/nodes" className={idInk}>
                Testnet Nodes
              </Link>
              {addedToConsole.relayer && (
                <>
                  {' '}
                  and{' '}
                  <Link href="/console/testnet-infra/icm-relayer" className={idInk}>
                    ICM Relayer
                  </Link>
                </>
              )}
              .
            </Done>
          )}
          {registrySaved && (
            <Done>Saved the registry to {registrySaved} in your console, so the ICM and ICTT tools use it.</Done>
          )}
        </div>
      )}

      {unfinished.length > 0 && (
        <Board>
          <BoardHeader label="Launch not finished" action={<StatusMark tone="warn">Needs action</StatusMark>} />
          <div className="flex flex-col gap-3 px-5 py-4 md:px-6">
            <div className="flex flex-col gap-1">
              <p className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">
                Your L1 is live, but {unfinished.length} of its launch steps did not finish.
              </p>
              <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Your wallet deploys the ICM registry, then Studio checks for a relayer.
              </p>
            </div>
            <HowItWorks>
              Not done: {unfinished.join(', ')}. Quick L1 can&apos;t resume a job, so Studio finishes what the L1 needs
              for ICM. The demo MockUSDC bridge isn&apos;t redone; the ICTT bridge blueprint sets one up for your own
              token.
            </HowItWorks>
            {onFinishSetup && (
              <span>
                <Button busy={finishing} onClick={() => void finishSetup()}>
                  Finish the remaining steps
                </Button>
              </span>
            )}
            {finishError && <Notice tone="bad">{finishError}</Notice>}
          </div>
        </Board>
      )}
    </>
  );

  return warm ? (
    <div className="flex flex-col gap-4">{body}</div>
  ) : (
    <Appear className="flex flex-col gap-4">{body}</Appear>
  );
}
