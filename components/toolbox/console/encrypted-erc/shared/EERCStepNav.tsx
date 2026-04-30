'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, UserCheck } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';
import { loadIdentity } from '@/lib/eerc/identity';
import { cn } from '@/lib/utils';

/**
 * Persistent cross-tool nav for the Encrypted ERC sub-pages. Same visual
 * language as Overview's row-3 ActionTiles (animated icons, per-step
 * accent colours, Done / Next / Ready status pills) but tightened for
 * a strip that lives at the top of every tool page — smaller padding,
 * one-line subtitle, no trailing chevron, so it doesn't dominate the
 * page chrome the way the full-size version did.
 */

type StepStatus = 'done' | 'next' | 'available';
type Accent = 'emerald' | 'blue' | 'violet' | 'rose' | 'amber';

type Step = {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  accent: Accent;
  Icon: React.ComponentType;
  isActive: (pathname: string) => boolean;
};

const STEPS: Step[] = [
  {
    key: 'register',
    href: '/console/encrypted-erc/register',
    title: 'Register',
    subtitle: 'One wallet sig → BJJ identity',
    accent: 'emerald',
    Icon: KeyAnim,
    isActive: (p) => p.startsWith('/console/encrypted-erc/register'),
  },
  {
    key: 'deposit',
    href: '/console/encrypted-erc/deposit',
    title: 'Deposit',
    subtitle: 'Wrap an ERC20 → encrypted',
    accent: 'blue',
    Icon: ArrowDownAnim,
    isActive: (p) => p.startsWith('/console/encrypted-erc/deposit'),
  },
  {
    key: 'transfer',
    href: '/console/encrypted-erc/transfer',
    title: 'Private Transfer',
    subtitle: 'ZK proof, hidden amount',
    accent: 'violet',
    Icon: SendAnim,
    isActive: (p) => p.startsWith('/console/encrypted-erc/transfer'),
  },
  {
    key: 'withdraw',
    href: '/console/encrypted-erc/withdraw',
    title: 'Withdraw',
    subtitle: 'Burn encrypted → ERC20 out',
    accent: 'rose',
    Icon: ArrowUpAnim,
    isActive: (p) => p.startsWith('/console/encrypted-erc/withdraw'),
  },
  {
    key: 'balance',
    href: '/console/encrypted-erc/balance',
    title: 'Balance & History',
    subtitle: 'Decrypt + view raw ciphertext',
    accent: 'amber',
    Icon: EyeAnim,
    isActive: (p) => p.startsWith('/console/encrypted-erc/balance'),
  },
  {
    key: 'auditor',
    href: '/console/encrypted-erc/auditor',
    title: 'Auditor View',
    subtitle: 'Decrypt compliance events',
    accent: 'emerald',
    Icon: ShieldCheck,
    isActive: (p) => p.startsWith('/console/encrypted-erc/auditor'),
  },
  {
    key: 'set-auditor',
    href: '/console/encrypted-erc/deploy/auditor',
    title: 'Set Auditor',
    subtitle: 'Designate auditor BJJ key',
    accent: 'violet',
    Icon: UserCheck,
    isActive: (p) => p.startsWith('/console/encrypted-erc/deploy/auditor'),
  },
];

// Tints for the icon tile, matched to Overview's ActionTile palette so
// the row reads as the same family across the two surfaces.
const ACCENT_BG: Record<Accent, string> = {
  emerald: 'group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20',
  blue: 'group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20',
  violet: 'group-hover:bg-violet-50 dark:group-hover:bg-violet-900/20',
  rose: 'group-hover:bg-rose-50 dark:group-hover:bg-rose-900/20',
  amber: 'group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20',
};
const ACCENT_ICON: Record<Accent, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  blue: 'text-blue-600 dark:text-blue-400',
  violet: 'text-violet-600 dark:text-violet-400',
  rose: 'text-rose-600 dark:text-rose-400',
  amber: 'text-amber-600 dark:text-amber-400',
};

const STATUS_STYLES: Record<StepStatus, { label: string; className: string }> = {
  done: {
    label: 'Done',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300',
  },
  next: {
    label: 'Next',
    className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  },
  available: {
    label: 'Ready',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300',
  },
};

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

  const [hasIdentity, setHasIdentity] = useState(false);
  useEffect(() => {
    if (!address || !deployment) {
      setHasIdentity(false);
      return;
    }
    setHasIdentity(loadIdentity(address, deployment.registrar) !== null);
  }, [address, deployment, reg.identity]);
  void hasIdentity;

  const stepsDone = useMemo(() => {
    const set = new Set<string>();
    if (address) set.add('connect');
    if (isRegistered) set.add('register');
    if (balance.decryptedCents && balance.decryptedCents > 0n) set.add('deposit');
    return set;
  }, [address, isRegistered, balance.decryptedCents]);

  return (
    <>
      {/* Local global animations — identical to Overview.tsx so the same
          icon hover behaviours work whether the user is on the hub page
          or a leaf tool page. Keyframe names are intentionally shared
          across both files; styled-jsx merges duplicate global rules. */}
      <style jsx global>{`
        .eerc-step-key {
          transition: transform 0.55s ease-in-out;
        }
        .group:hover .eerc-step-key {
          animation: eercStepKeyWobble 0.55s ease-in-out;
        }
        @keyframes eercStepKeyWobble {
          0%,
          100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-12deg);
          }
          75% {
            transform: rotate(12deg);
          }
        }
        .eerc-step-down {
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .group:hover .eerc-step-down {
          transform: translateY(2px);
        }
        .eerc-step-up {
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .group:hover .eerc-step-up {
          transform: translateY(-2px);
        }
        .eerc-step-send {
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .group:hover .eerc-step-send {
          transform: translate(2px, -2px);
        }
        .eerc-step-eye {
          transform-origin: center;
        }
        @keyframes eercStepEyeBlink {
          0%,
          100% {
            transform: scaleY(1);
          }
          45%,
          50% {
            transform: scaleY(0.15);
          }
        }
        .group:hover .eerc-step-eye {
          animation: eercStepEyeBlink 0.6s ease-in-out;
        }
      `}</style>
      <nav aria-label="Encrypted ERC steps" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mb-5">
        {STEPS.map((step) => {
          const active = step.isActive(pathname ?? '');
          const status = resolveStatus(step.key, stepsDone);
          return <StepCard key={step.key} step={step} active={active} status={status} />;
        })}
      </nav>
    </>
  );
}

function StepCard({ step, active, status }: { step: Step; active: boolean; status?: StepStatus }) {
  const { Icon } = step;
  const statusMeta = status ? STATUS_STYLES[status] : null;

  // Tightened version of Overview's ActionTile: p-3 (vs p-4), 8x8 icon
  // tile (vs 9x9), text-[12px] title (vs text-sm), one-line subtitle.
  // Active card uses a stronger zinc border + subtly elevated bg —
  // chromatic-silent so the corner status badges stay the only signal
  // colour.
  const wrapperClass = cn(
    'group relative h-full rounded-xl border p-3 transition-colors duration-200',
    active
      ? 'border-zinc-400 dark:border-zinc-500 bg-zinc-50 dark:bg-zinc-800/80'
      : 'border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm hover:border-zinc-300 dark:hover:border-zinc-700',
  );

  const content = (
    <motion.div
      whileHover={active ? undefined : { y: -1 }}
      transition={{ type: 'spring' as const, stiffness: 420, damping: 26 }}
      className={wrapperClass}
      style={{
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.03)',
      }}
    >
      {statusMeta && (
        <span
          className={cn(
            'absolute right-2 top-2 rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none',
            statusMeta.className,
          )}
        >
          {statusMeta.label}
        </span>
      )}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors',
          active ? 'bg-zinc-200 dark:bg-zinc-700' : cn('bg-zinc-100 dark:bg-zinc-800', ACCENT_BG[step.accent]),
        )}
      >
        <span className={cn('[&_svg]:w-3.5 [&_svg]:h-3.5', ACCENT_ICON[step.accent])}>
          <Icon />
        </span>
      </div>
      <h3 className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100 leading-tight">{step.title}</h3>
      <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug truncate">{step.subtitle}</p>
    </motion.div>
  );

  if (active) {
    return (
      <div aria-current="page" className="block h-full">
        {content}
      </div>
    );
  }
  return (
    <Link href={step.href} aria-label={`Go to ${step.title}`} className="block h-full">
      {content}
    </Link>
  );
}

// ─── Animated step icons (mirror Overview.tsx so the row reads the same
// on both surfaces) ─────────────────────────────────────────────────────
function KeyAnim() {
  return (
    <svg
      className="eerc-step-key"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21 2-9.6 9.6" />
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-2 2 2 2" />
      <path d="m17 6 2 2" />
    </svg>
  );
}

function ArrowDownAnim() {
  return (
    <svg
      className="eerc-step-down"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v16" />
      <path d="m19 11-7 7-7-7" />
      <path d="M5 22h14" />
    </svg>
  );
}

function ArrowUpAnim() {
  return (
    <svg
      className="eerc-step-up"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22V6" />
      <path d="m5 13 7-7 7 7" />
      <path d="M5 2h14" />
    </svg>
  );
}

function SendAnim() {
  return (
    <svg
      className="eerc-step-send"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function EyeAnim() {
  return (
    <svg
      className="eerc-step-eye"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
