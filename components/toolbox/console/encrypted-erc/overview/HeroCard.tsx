'use client';

import React, { Fragment, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronRight,
  Globe,
  Key,
  Send,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { cn } from '@/lib/utils';
import { boardItem } from '@/components/console/motion';

/**
 * Top-row hero of the EERC Overview.
 *
 * The card stacks three zones, all sharing one premium chrome (rounded
 * 3xl, diffusion shadow, inner ring-1 refraction):
 *
 *   1. **Status row** — three dot-led pills (network · identity ·
 *      auditor) backed by real on-chain reads. Makes the page feel
 *      like a working dashboard rather than marketing.
 *
 *   2. **Identity zone** — title, subtitle, primary CTA. Decorative
 *      `CiphertextStream` is clipped to this zone so it can't ghost
 *      into the stepper below.
 *
 *   3. **Stepper zone** — connected 5-step progress stepper with a
 *      perpetual pulse on the "next" node so the eye lands on it
 *      without an arrow.
 */
interface HeroCardProps {
  address: string | undefined;
  isRegistered: boolean | null;
  hasIdentity: boolean;
  stepsDone: Set<string>;
  chainName: string | null;
  chainId: number;
  isOnConnectedChain: boolean;
  auditorAddress: `0x${string}` | null;
  auditorLoading: boolean;
  className?: string;
}

interface ProgressStep {
  key: string;
  label: string;
  href: string | null;
  Icon: LucideIcon;
}

const PROGRESS_STEPS: readonly ProgressStep[] = [
  { key: 'connect', label: 'Connect', href: null, Icon: Wallet },
  { key: 'register', label: 'Register', href: '/console/encrypted-erc/register', Icon: Key },
  { key: 'deposit', label: 'Deposit', href: '/console/encrypted-erc/deposit', Icon: ArrowDownToLine },
  { key: 'transfer', label: 'Transfer', href: '/console/encrypted-erc/transfer', Icon: Send },
  { key: 'withdraw', label: 'Withdraw', href: '/console/encrypted-erc/withdraw', Icon: ArrowUpFromLine },
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function HeroCard({
  address,
  isRegistered,
  hasIdentity,
  stepsDone,
  chainName,
  chainId,
  isOnConnectedChain,
  auditorAddress,
  auditorLoading,
  className,
}: HeroCardProps) {
  const { openConnectModal } = useConnectModal();
  const ctaHref = !address
    ? undefined
    : !isRegistered
      ? '/console/encrypted-erc/register'
      : '/console/encrypted-erc/deposit';
  const ctaLabel = !address ? 'Connect wallet' : !isRegistered ? 'Register identity' : 'Deposit & encrypt';

  const doneCount = PROGRESS_STEPS.filter((s) => stepsDone.has(s.key)).length;
  const nextIndex = PROGRESS_STEPS.findIndex((s) => !stepsDone.has(s.key));
  const pct = Math.round((doneCount / PROGRESS_STEPS.length) * 100);
  const nextLabel = nextIndex >= 0 ? PROGRESS_STEPS[nextIndex].label : null;

  const auditorSet = Boolean(auditorAddress && auditorAddress.toLowerCase() !== ZERO_ADDRESS);

  return (
    <motion.div className={className} variants={boardItem}>
      <div
        className="group relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white ring-1 ring-zinc-900/[0.02] transition-colors duration-300 dark:border-zinc-800/80 dark:bg-zinc-950 dark:ring-white/[0.04] hover:border-zinc-300 dark:hover:border-zinc-700"
        style={{
          boxShadow:
            '0 24px 64px -32px rgba(16,185,129,0.10), 0 8px 24px -12px rgba(0,0,0,0.05), inset 0 1px 0 0 rgba(255,255,255,0.06)',
        }}
      >
        <StatusBar
          address={address}
          chainName={chainName}
          chainId={chainId}
          isOnConnectedChain={isOnConnectedChain}
          isRegistered={isRegistered}
          auditorAddress={auditorAddress}
          auditorSet={auditorSet}
          auditorLoading={auditorLoading}
        />

        {/* ── Identity zone ────────────────────────────────────────── */}
        <div className="relative overflow-hidden px-6 py-7 md:px-8 md:py-8">
          <div
            aria-hidden
            className="hidden md:block absolute right-0 top-0 bottom-0 w-[36%] pointer-events-none overflow-hidden mask-fade-left"
          >
            <CiphertextStream />
          </div>

          <div className="relative flex items-start gap-4">
            <div className="relative shrink-0">
              <span
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-emerald-400/25 blur-2xl dark:bg-emerald-400/20"
              />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-white ring-1 ring-emerald-200/70 dark:from-emerald-500/15 dark:to-emerald-500/5 dark:ring-emerald-400/20">
                <svg
                  className="lock-shackle h-5 w-5 text-emerald-600 dark:text-emerald-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                </svg>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold leading-[1.1] tracking-tighter text-zinc-950 dark:text-white md:text-[1.625rem]">
                Private balances, <span className="text-emerald-600 dark:text-emerald-400">public accountability.</span>
              </h1>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Encrypted balances and transfers, with one designated auditor key for compliance. Built on BabyJubJub
                ElGamal + Groth16 zk-SNARKs.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {ctaHref ? (
                  <Link
                    href={ctaHref}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-medium text-white shadow-[0_4px_16px_-4px_rgba(16,185,129,0.5)] transition-all duration-200 hover:bg-emerald-600 hover:shadow-[0_6px_20px_-4px_rgba(16,185,129,0.55)] active:translate-y-px dark:bg-emerald-400 dark:text-zinc-950 dark:shadow-[0_4px_16px_-4px_rgba(16,185,129,0.35)] dark:hover:bg-emerald-300"
                  >
                    {ctaLabel}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConnectModal?.()}
                    disabled={!openConnectModal}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-medium text-white shadow-[0_4px_16px_-4px_rgba(16,185,129,0.5)] transition-all duration-200 hover:bg-emerald-600 hover:shadow-[0_6px_20px_-4px_rgba(16,185,129,0.55)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-400 dark:text-zinc-950 dark:shadow-[0_4px_16px_-4px_rgba(16,185,129,0.35)] dark:hover:bg-emerald-300"
                  >
                    {ctaLabel}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <Link
                  href="/academy/encrypted-erc"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 text-xs font-medium text-zinc-700 backdrop-blur-sm transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-white"
                >
                  <BookOpen className="h-3 w-3" />
                  Learn the protocol
                </Link>
                {hasIdentity && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-tight text-zinc-500 dark:text-zinc-400">
                    <Check className="h-3 w-3 text-emerald-500" />
                    BJJ cached
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stepper zone ─────────────────────────────────────────── */}
        <div className="relative border-t border-zinc-100 bg-zinc-50/50 px-6 py-5 md:px-8 dark:border-zinc-900 dark:bg-zinc-950/60">
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              Your journey
            </span>
            <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              <span className="text-zinc-700 dark:text-zinc-200">
                {doneCount}/{PROGRESS_STEPS.length}
              </span>
              {' · '}
              {pct}%
              {nextLabel && (
                <>
                  {' · next '}
                  <span className="text-zinc-700 dark:text-zinc-200">{nextLabel}</span>
                </>
              )}
            </span>
          </div>
          <Stepper steps={PROGRESS_STEPS} stepsDone={stepsDone} nextIndex={nextIndex} />
        </div>

        <style jsx>{`
          .mask-fade-left {
            -webkit-mask-image: linear-gradient(to right, transparent 0%, black 60%);
            mask-image: linear-gradient(to right, transparent 0%, black 60%);
          }
        `}</style>
      </div>
    </motion.div>
  );
}

interface StatusBarProps {
  address: string | undefined;
  chainName: string | null;
  chainId: number;
  isOnConnectedChain: boolean;
  isRegistered: boolean | null;
  auditorAddress: `0x${string}` | null;
  auditorSet: boolean;
  auditorLoading: boolean;
}

/**
 * Tiny status row above the hero headline. Three dot-led pills
 * separated by a 1px divider in the dark mode ("anti-card overuse" —
 * we read the data as a ribbon, not as boxes). Network · Identity ·
 * Auditor.
 */
function StatusBar({
  address,
  chainName,
  chainId,
  isOnConnectedChain,
  isRegistered,
  auditorAddress,
  auditorSet,
  auditorLoading,
}: StatusBarProps) {
  const networkLabel = chainName ?? (chainId > 0 ? `Chain ${chainId}` : 'No chain');
  const networkTone: StatusTone = isOnConnectedChain ? 'live' : chainId > 0 ? 'inactive' : 'idle';

  const identityTone: StatusTone = !address ? 'idle' : isRegistered ? 'live' : 'inactive';
  const identityLabel = !address ? 'Identity — connect to read' : isRegistered ? 'Registered' : 'Not registered';

  const auditorTone: StatusTone = !address ? 'idle' : auditorLoading ? 'idle' : auditorSet ? 'live' : 'inactive';
  const auditorLabel = !address
    ? 'Auditor — connect to read'
    : auditorLoading
      ? 'Auditor checking…'
      : auditorSet
        ? `Auditor ${auditorAddress?.slice(0, 6)}…${auditorAddress?.slice(-4)}`
        : 'No auditor set';

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-zinc-100 bg-zinc-50/60 px-6 py-2.5 md:px-8 dark:border-zinc-900 dark:bg-white/[0.02]">
      <StatusPill icon={Globe} tone={networkTone} label={networkLabel} />
      <span className="hidden h-3 w-px bg-zinc-200 dark:bg-zinc-800 sm:block" aria-hidden />
      <StatusPill icon={Key} tone={identityTone} label={identityLabel} />
      <span className="hidden h-3 w-px bg-zinc-200 dark:bg-zinc-800 sm:block" aria-hidden />
      <StatusPill icon={ShieldCheck} tone={auditorTone} label={auditorLabel} mono={auditorSet} />
    </div>
  );
}

type StatusTone = 'live' | 'inactive' | 'idle';

function StatusPill({
  icon: Icon,
  tone,
  label,
  mono = false,
}: {
  icon: LucideIcon;
  tone: StatusTone;
  label: string;
  mono?: boolean;
}) {
  const dot =
    tone === 'live'
      ? 'bg-emerald-500 enc-flicker'
      : tone === 'inactive'
        ? 'bg-amber-500'
        : 'bg-zinc-300 dark:bg-zinc-700';
  const text =
    tone === 'live'
      ? 'text-zinc-700 dark:text-zinc-200'
      : tone === 'inactive'
        ? 'text-zinc-600 dark:text-zinc-300'
        : 'text-zinc-400 dark:text-zinc-500';
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium">
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} aria-hidden />
      <Icon className={cn('h-3 w-3 shrink-0', text)} strokeWidth={2} />
      <span className={cn('truncate', mono && 'font-mono tabular-nums tracking-tight', text)} title={label}>
        {label}
      </span>
    </div>
  );
}

interface StepperProps {
  steps: readonly ProgressStep[];
  stepsDone: Set<string>;
  nextIndex: number;
}

function Stepper({ steps, stepsDone, nextIndex }: StepperProps) {
  return (
    <ol className="flex items-start">
      {steps.map((step, i) => {
        const done = stepsDone.has(step.key);
        const next = !done && i === nextIndex;
        const prevDone = i > 0 && stepsDone.has(steps[i - 1].key);
        return (
          <Fragment key={step.key}>
            <li className="relative flex flex-1 flex-col items-center">
              {i > 0 && <Connector side="left" lit={prevDone} />}
              {i < steps.length - 1 && <Connector side="right" lit={done} />}
              <StepNode step={step} done={done} next={next} index={i} />
              <span
                className={cn(
                  'mt-2 truncate text-center text-[11px] tracking-tight',
                  done
                    ? 'font-medium text-zinc-700 dark:text-zinc-300'
                    : next
                      ? 'font-semibold text-zinc-950 dark:text-zinc-50'
                      : 'text-zinc-500 dark:text-zinc-500',
                )}
              >
                {step.label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function Connector({ side, lit }: { side: 'left' | 'right'; lit: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute top-[14px] h-px w-1/2 transition-colors duration-500',
        side === 'left' ? 'left-0' : 'right-0',
        lit ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800',
      )}
    />
  );
}

interface StepNodeProps {
  step: ProgressStep;
  done: boolean;
  next: boolean;
  index: number;
}

function StepNode({ step, done, next, index }: StepNodeProps) {
  const { Icon } = step;
  const stateLabel = done ? 'completed' : next ? 'next' : 'pending';
  const ringColor = done
    ? 'ring-emerald-500/15 dark:ring-emerald-400/15'
    : next
      ? 'ring-zinc-950/10 dark:ring-zinc-50/10'
      : 'ring-transparent';
  const circleClasses = cn(
    'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border ring-4 transition-all',
    ringColor,
    done
      ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-950'
      : next
        ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
        : 'border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500',
  );

  const inner = done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" strokeWidth={2} />;

  if (!step.href) {
    return (
      <div className="relative flex items-center justify-center">
        {next && <NextPulse />}
        <div role="img" aria-label={`${step.label} ${stateLabel}`} className={circleClasses}>
          {inner}
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex items-center justify-center">
      {next && <NextPulse />}
      <Link
        href={step.href}
        aria-label={`${step.label} ${stateLabel}`}
        className={cn(circleClasses, 'cursor-pointer hover:scale-110 hover:shadow-md')}
      >
        {inner}
        <span className="sr-only">Step {index + 1}</span>
      </Link>
    </div>
  );
}

/**
 * Concentric ring expansion behind the "next" stepper circle. Pure CSS
 * animation (no React state) so the perpetual loop never re-renders the
 * stepper. Sized to overlay the 28px circle exactly.
 */
function NextPulse() {
  return <span aria-hidden className="next-pulse absolute h-7 w-7 rounded-full bg-zinc-950/15 dark:bg-zinc-50/20" />;
}

/**
 * Live-rolling pseudo-random EGCT points. The whole strip is decorative
 * — `makeFakeEGCTs` uses a deterministic LCG so the visual stays the
 * same between renders without resorting to actual randomness, and
 * `cipher-roll` (defined in `EERCKeyframes`) translates the column up
 * by 50% on a loop. We render the rows twice so the seam is hidden.
 */
function CiphertextStream() {
  const rows = useMemo(() => makeFakeEGCTs(24), []);
  return (
    <div className="h-full relative">
      <div className="cipher-roll font-mono text-[10px] leading-5 whitespace-nowrap pr-6 pl-4 pt-4 text-emerald-600/40 dark:text-emerald-400/65">
        {[...rows, ...rows].map((r, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-zinc-400 dark:text-zinc-600">[{String(i).padStart(2, '0')}]</span>
            <span>c1.x={r[0]}</span>
            <span>c1.y={r[1]}</span>
            <span>c2.x={r[2]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function makeFakeEGCTs(n: number): string[][] {
  let seed = 0x9e3779b1;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  };
  const hex = () =>
    Array.from({ length: 8 }, () => next().toString(16).padStart(8, '0'))
      .join('')
      .slice(0, 8);
  return Array.from({ length: n }, () => [hex(), hex(), hex(), hex()]);
}
