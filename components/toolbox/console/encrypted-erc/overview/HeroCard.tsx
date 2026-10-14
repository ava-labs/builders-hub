'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { HashChip, StatCell, StatStrip } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { ArrowLink, EYEBROW, FRAME } from '../shared/ui';
import { DecryptText } from '@/components/console/decrypt-text';

/**
 * Top of the Encrypted ERC overview: the headline and next action, a status
 * strip (network · identity · auditor) backed by on-chain reads, and the
 * journey as a segmented track in the step-flow's voice.
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
}

const PROGRESS_STEPS: readonly ProgressStep[] = [
  { key: 'connect', label: 'Connect', href: null },
  { key: 'register', label: 'Register', href: '/console/encrypted-erc/register' },
  { key: 'deposit', label: 'Deposit', href: '/console/encrypted-erc/deposit' },
  { key: 'transfer', label: 'Transfer', href: '/console/encrypted-erc/transfer' },
  { key: 'withdraw', label: 'Withdraw', href: '/console/encrypted-erc/withdraw' },
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const PRIMARY_CTA =
  'group/cta inline-flex h-10 items-center gap-2 border border-zinc-900 bg-zinc-900 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';

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
  const ctaLabel = !address ? 'Connect wallet' : !isRegistered ? 'Register identity' : 'Deposit and encrypt';

  const doneCount = PROGRESS_STEPS.filter((s) => stepsDone.has(s.key)).length;
  const nextIndex = PROGRESS_STEPS.findIndex((s) => !stepsDone.has(s.key));
  const nextLabel = nextIndex >= 0 ? PROGRESS_STEPS[nextIndex].label : null;

  const auditorSet = Boolean(auditorAddress && auditorAddress.toLowerCase() !== ZERO_ADDRESS);
  const networkLabel = chainName ?? (chainId > 0 ? `Chain ${chainId}` : 'No chain');

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <div className="flex flex-col gap-3">
        <p className={EYEBROW}>Encrypted ERC</p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
          <DecryptText text="Private balances, public accountability." />
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Balances and transfers stay encrypted on-chain. One auditor key can read amounts for compliance. Built on
          BabyJubJub ElGamal and Groth16 proofs.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
          {ctaHref ? (
            <Link href={ctaHref} className={PRIMARY_CTA}>
              {ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openConnectModal?.()}
              disabled={!openConnectModal}
              className={PRIMARY_CTA}
            >
              {ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          <ArrowLink href="/academy/encrypted-erc">Learn the protocol</ArrowLink>
          {hasIdentity && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              BabyJubJub key cached in this browser
            </span>
          )}
        </div>
      </div>

      <div className="border-x border-t border-zinc-200 dark:border-zinc-800">
        <StatStrip cols={3}>
          <StatCell
            label="Network"
            live={isOnConnectedChain}
            sub={isOnConnectedChain ? 'Deployment found' : 'No deployment'}
            even
          >
            <span
              className={cn(
                'truncate font-mono text-[17px] tracking-tight',
                isOnConnectedChain ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-500',
              )}
              title={networkLabel}
            >
              {networkLabel}
            </span>
          </StatCell>
          <StatCell
            label="Identity"
            sub={!address ? 'Connect to read' : isRegistered ? 'Public key on the Registrar' : 'Register to receive'}
            even
          >
            <span
              className={cn(
                'font-mono text-[17px] tracking-tight',
                address && isRegistered ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-500',
              )}
            >
              {!address ? '—' : isRegistered ? 'Registered' : 'Not registered'}
            </span>
          </StatCell>
          <StatCell
            label="Auditor"
            sub={
              !address
                ? 'Connect to read'
                : auditorLoading
                  ? 'Checking'
                  : auditorSet
                    ? 'Can read amounts'
                    : 'Transfers revert until set'
            }
            even
          >
            {!address ? (
              <span className="font-mono text-[17px] text-zinc-400 dark:text-zinc-500">—</span>
            ) : auditorLoading ? (
              <span className="h-6 w-32 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            ) : auditorSet && auditorAddress ? (
              <HashChip value={auditorAddress} len={8} className="[&>span]:text-[15px]" />
            ) : (
              <span className="font-mono text-[17px] tracking-tight text-amber-700 dark:text-amber-400">Not set</span>
            )}
          </StatCell>
        </StatStrip>
      </div>

      <section className={FRAME}>
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <p className={EYEBROW}>Your journey</p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] tabular-nums text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-900 dark:text-zinc-50">{doneCount}</span> of {PROGRESS_STEPS.length} done
            {nextLabel && (
              <>
                <span className="mx-2 text-zinc-300 dark:text-zinc-700">/</span>
                Next <span className="text-zinc-900 dark:text-zinc-50">{nextLabel}</span>
              </>
            )}
          </p>
        </div>
        <Journey steps={PROGRESS_STEPS} stepsDone={stepsDone} nextIndex={nextIndex} />
      </section>
    </div>
  );
}

function Journey({
  steps,
  stepsDone,
  nextIndex,
}: {
  steps: readonly ProgressStep[];
  stepsDone: Set<string>;
  nextIndex: number;
}) {
  return (
    <ol className="grid grid-cols-5 gap-1 px-4 pb-4 pt-4">
      {steps.map((step, i) => {
        const done = stepsDone.has(step.key);
        const next = !done && i === nextIndex;
        const state = done ? 'completed' : next ? 'next' : 'pending';
        const label = (
          <>
            <span
              aria-hidden
              className={cn(
                'block h-1 transition-colors',
                done ? 'bg-zinc-900 dark:bg-zinc-100' : next ? 'bg-[#E6212F]' : 'bg-zinc-200 dark:bg-zinc-800',
              )}
            />
            <span className="mt-2.5 flex min-w-0 items-baseline gap-1.5">
              <span
                className={cn(
                  'shrink-0 font-mono text-[10px] font-bold tabular-nums',
                  done
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : next
                      ? 'text-[#E6212F]'
                      : 'text-zinc-400 dark:text-zinc-600',
                )}
              >
                {done ? (
                  <Check className="inline h-3 w-3 -translate-y-px" aria-hidden />
                ) : (
                  String(i + 1).padStart(2, '0')
                )}
              </span>
              <span
                className={cn(
                  'truncate text-[12.5px] decoration-zinc-400 underline-offset-4',
                  next
                    ? 'font-medium text-zinc-900 dark:text-zinc-50'
                    : done
                      ? 'text-zinc-600 dark:text-zinc-300'
                      : 'text-zinc-400 dark:text-zinc-500',
                  step.href &&
                    'group-hover/step:text-zinc-900 group-hover/step:underline dark:group-hover/step:text-zinc-50',
                )}
              >
                {step.label}
              </span>
              {step.href && (
                <ArrowRight className="h-3 w-3 shrink-0 -translate-x-1 self-center text-[#E6212F] opacity-0 transition-all group-hover/step:translate-x-0 group-hover/step:opacity-100" />
              )}
            </span>
            <span className="sr-only">: {state}</span>
          </>
        );
        return (
          <li key={step.key} className="min-w-0">
            {step.href ? (
              <Link href={step.href} className="group/step block">
                {label}
              </Link>
            ) : (
              <div>{label}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
