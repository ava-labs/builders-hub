'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';
import { cn } from '@/lib/utils';
import { STATUS_STYLES, type StepStatus } from './eerc-step-styles';

/**
 * Persistent cross-tool tabs for the Encrypted ERC pages. Mounted by
 * `EERCToolShell` on every leaf page, by the Overview hub, and above the
 * Deposit step flow, so every tool is one click away.
 */

type Step = {
  key: string;
  href: string;
  title: string;
  isActive: (pathname: string) => boolean;
};

const STEPS: Step[] = [
  {
    key: 'overview',
    href: '/console/encrypted-erc/overview',
    title: 'Overview',
    isActive: (p) => p === '/console/encrypted-erc' || p.startsWith('/console/encrypted-erc/overview'),
  },
  {
    key: 'register',
    href: '/console/encrypted-erc/register',
    title: 'Register',
    isActive: (p) => p.startsWith('/console/encrypted-erc/register'),
  },
  {
    key: 'deposit',
    href: '/console/encrypted-erc/deposit',
    title: 'Deposit',
    isActive: (p) => p.startsWith('/console/encrypted-erc/deposit'),
  },
  {
    key: 'transfer',
    href: '/console/encrypted-erc/transfer',
    title: 'Transfer',
    isActive: (p) => p.startsWith('/console/encrypted-erc/transfer'),
  },
  {
    key: 'withdraw',
    href: '/console/encrypted-erc/withdraw',
    title: 'Withdraw',
    isActive: (p) => p.startsWith('/console/encrypted-erc/withdraw'),
  },
  {
    key: 'balance',
    href: '/console/encrypted-erc/balance',
    title: 'Balance',
    isActive: (p) => p.startsWith('/console/encrypted-erc/balance'),
  },
  {
    key: 'auditor',
    href: '/console/encrypted-erc/auditor',
    title: 'Auditor',
    isActive: (p) => p.startsWith('/console/encrypted-erc/auditor'),
  },
  {
    key: 'set-auditor',
    href: '/console/encrypted-erc/deploy/auditor',
    title: 'Set auditor',
    isActive: (p) => p.startsWith('/console/encrypted-erc/deploy/auditor'),
  },
];

function resolveStatus(key: string, stepsDone: Set<string>): StepStatus | undefined {
  if (key === 'register') return stepsDone.has('register') ? 'done' : stepsDone.has('connect') ? 'next' : undefined;
  if (key === 'deposit') return stepsDone.has('deposit') ? 'done' : stepsDone.has('register') ? 'next' : undefined;
  if (key === 'transfer' || key === 'withdraw' || key === 'balance')
    return stepsDone.has('deposit') ? 'available' : undefined;
  if (key === 'auditor' || key === 'set-auditor') return stepsDone.has('register') ? 'available' : undefined;
  return undefined;
}

export function EERCStepNav() {
  const pathname = usePathname();
  const { address } = useAccount();
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  const deployment = standalone.deployment ?? converter.deployment;

  const balanceDeployment = converter.deployment ?? standalone.deployment;
  const balanceMode: 'standalone' | 'converter' = converter.deployment ? 'converter' : 'standalone';
  const balanceToken = balanceMode === 'converter' ? converter.deployment?.supportedTokens?.[0] : undefined;
  const balance = useEERCBalance(balanceDeployment, balanceMode, balanceToken);

  const reg = useEERCRegistration(deployment);
  const isRegistered = reg.status === 'registered';

  const stepsDone = useMemo(() => {
    const set = new Set<string>();
    if (address) set.add('connect');
    if (isRegistered) set.add('register');
    if (balance.decryptedCents && balance.decryptedCents > 0n) set.add('deposit');
    return set;
  }, [address, isRegistered, balance.decryptedCents]);

  return (
    <nav
      aria-label="Encrypted ERC tools"
      className="nav-plain mb-6 flex items-end gap-5 overflow-x-auto border-b border-zinc-200 [scrollbar-width:none] sm:gap-6 dark:border-zinc-800 [&::-webkit-scrollbar]:hidden"
    >
      {STEPS.map((step) => (
        <StepTab
          key={step.key}
          step={step}
          active={step.isActive(pathname ?? '')}
          status={resolveStatus(step.key, stepsDone)}
        />
      ))}
    </nav>
  );
}

function StepTab({ step, active, status }: { step: Step; active: boolean; status?: StepStatus }) {
  const statusMeta = status ? STATUS_STYLES[status] : null;
  return (
    <Link
      href={step.href}
      aria-current={active ? 'page' : undefined}
      onClick={active ? (e) => e.preventDefault() : undefined}
      title={statusMeta ? `${step.title}: ${statusMeta.label}` : undefined}
      className="group/tab -mb-px block shrink-0 no-underline! hover:no-underline!"
    >
      <span
        className={cn(
          'flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition-colors',
          active
            ? 'border-[#E6212F] text-zinc-900 dark:text-zinc-50'
            : 'border-transparent text-zinc-500 group-hover/tab:border-zinc-400 group-hover/tab:text-zinc-900 dark:text-zinc-400 dark:group-hover/tab:border-zinc-600 dark:group-hover/tab:text-zinc-50',
        )}
      >
        {step.title}
        {status === 'done' && <Check aria-hidden className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
        {status === 'next' && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#E6212F]" />}
        {statusMeta && <span className="sr-only">: {statusMeta.label}</span>}
      </span>
    </Link>
  );
}
