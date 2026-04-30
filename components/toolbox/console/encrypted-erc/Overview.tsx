'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronRight,
  EyeOff,
  Key,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';
import { listKnownChains } from '@/lib/eerc/deployments';
import { loadIdentity } from '@/lib/eerc/identity';
import { cn } from '@/lib/utils';
import { boardContainer, boardItem } from '@/components/console/motion';

function Overview() {
  const { address } = useAccount();
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  const deployment = standalone.deployment ?? converter.deployment;

  // Pick the matching deployment + mode for the balance read so the Journey
  // card's "deposit" step green-lights against whichever mode the user
  // actually has deployed:
  //   - Fuji canonical → both deployments exist + share a Registrar; we
  //     prefer converter because /deposit + /withdraw are converter-only
  //     flows, and the Journey's deposit step links to those routes.
  //   - Custom L1 (converter only) → uses converter, same as Fuji.
  //   - Custom L1 (standalone only) → falls back to standalone so the
  //     identity loaded by `useEERCBalance(loadIdentity → registrar)`
  //     matches what `useEERCRegistration(deployment)` registered against.
  //   - No deployment → undefined; balance hook short-circuits to null.
  const balanceDeployment = converter.deployment ?? standalone.deployment;
  const balanceMode: 'standalone' | 'converter' = converter.deployment ? 'converter' : 'standalone';
  const balanceToken = balanceMode === 'converter' ? converter.deployment?.supportedTokens?.[0] : undefined;
  const balance = useEERCBalance(balanceDeployment, balanceMode, balanceToken);

  // Registration status comes from `useEERCRegistration`, which calls
  // `Registrar.getUserPublicKey` against the chain — so the Journey card
  // shows ✓ for "register" only when the on-chain pubkey is actually set.
  // The previous implementation conflated cached-locally with registered-
  // on-chain, which incorrectly green-lit users who had derived a key but
  // never submitted the registration tx.
  const reg = useEERCRegistration(deployment);
  const isRegistered = reg.status === 'registered';

  // hasIdentity tracks the localStorage cache independently — useful for
  // the hero badge ("BJJ cached"), which describes browser state, not the
  // on-chain registrar.
  const [hasIdentity, setHasIdentity] = useState(false);

  useEffect(() => {
    if (!address || !deployment) {
      setHasIdentity(false);
      return;
    }
    const cached = loadIdentity(address, deployment.registrar);
    setHasIdentity(cached !== null);
  }, [address, deployment, reg.identity]);

  const stepsDone = useMemo(() => {
    const set = new Set<string>();
    if (address) set.add('connect');
    if (isRegistered) set.add('register');
    if (balance.decryptedCents && balance.decryptedCents > 0n) set.add('deposit');
    return set;
  }, [address, isRegistered, balance.decryptedCents]);

  const known = listKnownChains();

  return (
    <div className="relative -m-4 md:-m-8 p-4 md:p-8">
      <style jsx global>{`
        /* Encrypted-ERC specific animations */
        @keyframes encFlicker {
          0%,
          100% {
            opacity: 1;
          }
          4% {
            opacity: 0.65;
          }
          6% {
            opacity: 1;
          }
        }
        .enc-flicker {
          animation: encFlicker 4.2s ease-in-out infinite;
        }

        @keyframes ciphertextRoll {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }
        .cipher-roll {
          animation: ciphertextRoll 12s linear infinite;
        }

        /* Lock shackle lift on hover */
        .lock-shackle path:nth-child(1) {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform-origin: center bottom;
        }
        .group:hover .lock-shackle path:nth-child(1) {
          transform: translateY(-2px);
        }

        /* Eye closed ↔ open flip */
        @keyframes eyeBlink {
          0%,
          100% {
            transform: scaleY(1);
          }
          45% {
            transform: scaleY(0.15);
          }
          50% {
            transform: scaleY(0.15);
          }
        }
        .group:hover .eye-blink {
          animation: eyeBlink 0.6s ease-in-out;
        }

        /* Send icon slide */
        .send-icon {
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .group:hover .send-icon {
          transform: translate(2px, -2px);
        }

        /* Arrow slides */
        .arrow-down {
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .group:hover .arrow-down {
          transform: translateY(2px);
        }
        .arrow-up {
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .group:hover .arrow-up {
          transform: translateY(-2px);
        }

        /* Shield pulse */
        @keyframes shieldPulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }
        .group:hover .shield-pulse {
          animation: shieldPulse 0.8s ease-in-out;
        }

        /* Key wobble */
        @keyframes keyWobble {
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
        .group:hover .key-wobble {
          animation: keyWobble 0.55s ease-in-out;
        }

        /* Sparkle twinkle */
        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        .twinkle-a {
          animation: twinkle 2.4s ease-in-out infinite;
        }
        .twinkle-b {
          animation: twinkle 2.4s ease-in-out 0.8s infinite;
        }
        .twinkle-c {
          animation: twinkle 2.4s ease-in-out 1.6s infinite;
        }
      `}</style>

      <div
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(148 163 184 / 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(148 163 184 / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      <motion.div className="relative max-w-6xl mx-auto" variants={boardContainer} initial="hidden" animate="visible">
        <motion.div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3" variants={boardItem}>
          {/* ROW 1: Hero (6 cols) */}
          <HeroCard address={address} isRegistered={isRegistered} hasIdentity={hasIdentity} />
        </motion.div>

        <motion.div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3" variants={boardContainer}>
          {/* ROW 2: Journey (4) + Canonical Deployment (2) */}
          <motion.div className="md:col-span-4" variants={boardItem}>
            <JourneyCard stepsDone={stepsDone} />
          </motion.div>
          <motion.div className="md:col-span-2" variants={boardItem}>
            <CanonicalDeploymentCard known={known} />
          </motion.div>
        </motion.div>

        {/* ROW 3: Bubble-nav for every sub-tool that used to live in the sidebar. */}
        <motion.div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-3" variants={boardContainer}>
          <motion.div variants={boardItem}>
            <ActionTile
              href="/console/encrypted-erc/register"
              accent="emerald"
              title="Register"
              subtitle="One wallet sig → BJJ identity"
              icon={<KeyIcon />}
              status={stepsDone.has('register') ? 'done' : stepsDone.has('connect') ? 'next' : undefined}
            />
          </motion.div>
          <motion.div variants={boardItem}>
            <ActionTile
              href="/console/encrypted-erc/deposit"
              accent="blue"
              title="Deposit"
              subtitle="Wrap an ERC20 → encrypted"
              icon={<DepositIcon />}
              status={stepsDone.has('deposit') ? 'done' : stepsDone.has('register') ? 'next' : undefined}
            />
          </motion.div>
          <motion.div variants={boardItem}>
            <ActionTile
              href="/console/encrypted-erc/transfer"
              accent="violet"
              title="Private Transfer"
              subtitle="ZK proof, hidden amount"
              icon={<SendIconAnim />}
              status={stepsDone.has('deposit') ? 'available' : undefined}
            />
          </motion.div>
          <motion.div variants={boardItem}>
            <ActionTile
              href="/console/encrypted-erc/withdraw"
              accent="rose"
              title="Withdraw"
              subtitle="Burn encrypted → ERC20 out"
              icon={<WithdrawIcon />}
              status={stepsDone.has('deposit') ? 'available' : undefined}
            />
          </motion.div>
          <motion.div variants={boardItem}>
            <ActionTile
              href="/console/encrypted-erc/balance"
              accent="amber"
              title="Balance & History"
              subtitle="Decrypt + view raw ciphertext"
              icon={<EyeIconAnim />}
              status={stepsDone.has('deposit') ? 'available' : undefined}
            />
          </motion.div>
          <motion.div variants={boardItem}>
            <ActionTile
              href="/console/encrypted-erc/auditor"
              accent="emerald"
              title="Auditor View"
              subtitle="Decrypt compliance events"
              icon={<ShieldCheck />}
              status={stepsDone.has('register') ? 'available' : undefined}
            />
          </motion.div>
          <motion.div variants={boardItem}>
            <ActionTile
              href="/console/encrypted-erc/deploy/auditor"
              accent="violet"
              title="Set Auditor"
              subtitle="Designate auditor BJJ key"
              icon={<UserCheck />}
              status={stepsDone.has('register') ? 'available' : undefined}
            />
          </motion.div>
        </motion.div>

        {/* ROW 4: Compare (3) + Concept (3) */}
        <motion.div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3" variants={boardContainer}>
          <motion.div className="md:col-span-3" variants={boardItem}>
            <CompareCard />
          </motion.div>
          <motion.div className="md:col-span-3" variants={boardItem}>
            <ConceptCard />
          </motion.div>
        </motion.div>

        {/* ROW 5: Compliance context + deploy-your-own */}
        <motion.div className="grid grid-cols-1 md:grid-cols-6 gap-3" variants={boardContainer}>
          <motion.div className="md:col-span-3" variants={boardItem}>
            <AuditorCard />
          </motion.div>
          <motion.div className="md:col-span-3" variants={boardItem}>
            <DeployYourOwnCard />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HERO
// ---------------------------------------------------------------------------
function HeroCard({
  address,
  isRegistered,
  hasIdentity,
}: {
  address?: string;
  isRegistered: boolean | null;
  hasIdentity: boolean;
}) {
  const ctaHref = !address
    ? undefined
    : !isRegistered
      ? '/console/encrypted-erc/register'
      : '/console/encrypted-erc/deposit';
  const ctaLabel = !address ? 'Connect wallet' : !isRegistered ? 'Register to start' : 'Deposit & encrypt';

  return (
    <motion.div className="md:col-span-6 p-px" variants={boardItem}>
      <div
        className="group relative h-full rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-4 overflow-hidden transition-all duration-200 hover:border-zinc-600"
        style={{
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
        }}
      >
        {/* Right-aligned rolling ciphertext strip — narrower so the title can
            breathe and the whole hero stays above the fold on 1366×768.
            Hidden below md because at ≤360px it overlaps the headline and
            forces "accountability." onto its own orphan line. */}
        <div className="hidden md:block absolute right-0 top-0 bottom-0 w-[35%] pointer-events-none overflow-hidden mask-fade-left">
          <CiphertextStream />
        </div>

        <div className="relative flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0 transition-colors group-hover:bg-white/[0.14]">
            <svg
              className="lock-shackle w-5 h-5 text-emerald-400"
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

          <div className="flex-1 min-w-0 md:max-w-[60%]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 enc-flicker" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">Live on Fuji</span>
              </span>
              {hasIdentity && (
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                  <Check className="w-3 h-3 text-emerald-400" />
                  BJJ cached
                </span>
              )}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-white mb-1 leading-tight">
              Private balances, <span className="text-emerald-400">public accountability.</span>
            </h1>
            <p className="text-xs text-zinc-400 max-w-md leading-relaxed mb-3">
              BabyJubJub ElGamal + Groth16 zk-SNARKs hide on-chain balances and amounts. A designated auditor key
              decrypts for compliance.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {ctaHref ? (
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-1.5 bg-emerald-400 text-zinc-900 hover:bg-emerald-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  {ctaLabel}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg text-xs font-medium">
                  {ctaLabel}
                </span>
              )}
              <Link
                href="/academy/encrypted-erc"
                className="inline-flex items-center gap-1.5 border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                Learn the protocol
              </Link>
            </div>
          </div>
        </div>

        <style jsx>{`
          .mask-fade-left {
            -webkit-mask-image: linear-gradient(to right, transparent 0%, black 40%);
            mask-image: linear-gradient(to right, transparent 0%, black 40%);
          }
        `}</style>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// CIPHERTEXT STREAM — live-rolling pseudo-random EGCT points
// ---------------------------------------------------------------------------
function CiphertextStream() {
  // Seeded deterministic pseudo-random so the stream doesn't flicker between renders
  // but still *looks* cryptographically scrambled. 24 rows is enough for a full column
  // plus one-cycle tail (cipher-roll animates -50% to create an infinite loop).
  const rows = useMemo(() => makeFakeEGCTs(24), []);
  return (
    <div className="h-full relative">
      <div className="cipher-roll font-mono text-[10px] text-emerald-400/70 leading-5 whitespace-nowrap pr-6 pl-4 pt-4">
        {[...rows, ...rows].map((r, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-zinc-600">[{String(i).padStart(2, '0')}]</span>
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
  // Simple LCG for deterministic "random" display — not for anything real.
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

// ---------------------------------------------------------------------------
// JOURNEY — 5 step tracker with real user progress
// ---------------------------------------------------------------------------
function JourneyCard({ stepsDone }: { stepsDone: Set<string> }) {
  const steps = [
    { key: 'connect', label: 'Connect wallet', href: null, icon: null },
    { key: 'register', label: 'Register BJJ identity', href: '/console/encrypted-erc/register', icon: Key },
    { key: 'deposit', label: 'Deposit & encrypt', href: '/console/encrypted-erc/deposit', icon: ArrowDownToLine },
    { key: 'transfer', label: 'Private transfer', href: '/console/encrypted-erc/transfer', icon: Send },
    { key: 'withdraw', label: 'Withdraw & decrypt', href: '/console/encrypted-erc/withdraw', icon: ArrowUpFromLine },
  ];
  const doneCount = steps.filter((s) => stepsDone.has(s.key)).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <TileShell>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500 twinkle-a" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Your journey on Fuji</h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          {doneCount}/{steps.length} · {pct}%
        </span>
      </div>

      {/* Thin progress bar */}
      <div className="h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const done = stepsDone.has(s.key);
          const nextUp = !done && i === doneCount;
          const Icon = s.icon;
          const content = (
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors',
                s.href ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer' : '',
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0',
                  done
                    ? 'bg-emerald-500 text-white'
                    : nextUp
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500',
                )}
              >
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-sm flex-1',
                  done
                    ? 'text-zinc-500 dark:text-zinc-500 line-through'
                    : nextUp
                      ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                      : 'text-zinc-500 dark:text-zinc-400',
                )}
              >
                {s.label}
              </span>
              {Icon && !done && (
                <Icon
                  className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    nextUp ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-300 dark:text-zinc-700',
                  )}
                />
              )}
              {s.href && !done && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-zinc-300 dark:text-zinc-700" />}
            </div>
          );
          return <li key={s.key}>{s.href ? <Link href={s.href}>{content}</Link> : content}</li>;
        })}
      </ol>
    </TileShell>
  );
}

// ---------------------------------------------------------------------------
// CANONICAL DEPLOYMENT — status badge + address
// ---------------------------------------------------------------------------
function CanonicalDeploymentCard({ known }: { known: ReturnType<typeof listKnownChains> }) {
  const fuji = known.find((k) => k.chainId === 43113);
  const active = fuji && fuji.modes.length > 0;
  return (
    <TileShell className="h-full">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'inline-block w-2 h-2 rounded-full',
            active ? 'bg-emerald-500 enc-flicker' : 'bg-zinc-300 dark:bg-zinc-700',
          )}
        />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Fuji demo</h3>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          43113
        </span>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Standalone</span>
          <span
            className={cn(
              'font-mono',
              fuji?.modes.includes('standalone')
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-zinc-400 dark:text-zinc-600',
            )}
          >
            {fuji?.modes.includes('standalone') ? 'deployed' : 'pending'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Converter</span>
          <span
            className={cn(
              'font-mono',
              fuji?.modes.includes('converter')
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-zinc-400 dark:text-zinc-600',
            )}
          >
            {fuji?.modes.includes('converter') ? 'deployed' : 'pending'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Wrapped tokens</span>
          <span className="font-mono text-zinc-700 dark:text-zinc-300">WAVAX</span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <Link
          href="/console/encrypted-erc/balance"
          className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Explore deployment
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </TileShell>
  );
}

// ---------------------------------------------------------------------------
// COMPARE — public ERC20 vs encrypted ERC event row
// ---------------------------------------------------------------------------
function CompareCard() {
  return (
    <TileShell className="h-full">
      <div className="flex items-center gap-2 mb-3">
        <EyeOff className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">What a block explorer sees</h3>
      </div>
      <div className="space-y-2.5">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Public ERC20</div>
          <code className="block font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all">
            Transfer(0xALICE, 0xBOB, <span className="text-red-500">1500000000</span>)
          </code>
        </div>
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
          <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
            Encrypted ERC
          </div>
          <code className="block font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all">
            PrivateTransfer(0xALICE, 0xBOB, auditorPCT=
            <span className="text-emerald-600 dark:text-emerald-400">[???,???,???]</span>)
          </code>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
        Same sender and recipient are visible both times — eERC doesn't obfuscate <em>who</em>, only <em>how much</em>.
        The 7-element auditorPCT is Poseidon-encrypted; only the auditor's key can reveal the amount.
      </p>
    </TileShell>
  );
}

// ---------------------------------------------------------------------------
// CONCEPT — how it works diagram (small)
// ---------------------------------------------------------------------------
function ConceptCard() {
  return (
    <TileShell className="h-full">
      <div className="flex items-center gap-2 mb-3">
        <Lock className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Three primitives, one ERC</h3>
      </div>
      <ul className="space-y-2.5 text-xs">
        <PrimitiveRow
          letter="E"
          title="ElGamal on BabyJubJub"
          desc="Partially-homomorphic encryption of the running balance. Adds and subtracts without decryption."
        />
        <PrimitiveRow
          letter="P"
          title="Poseidon ciphertext (PCT)"
          desc="Per-tx ciphertext of the amount, encrypted to user + auditor. Enables precise decryption on demand."
        />
        <PrimitiveRow
          letter="G"
          title="Groth16 SNARK"
          desc="5 circuits (register / mint / transfer / withdraw / burn) prove correctness of each operation."
        />
      </ul>
      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <Link
          href="/academy/encrypted-erc"
          className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Full Academy course
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </TileShell>
  );
}

function PrimitiveRow({ letter, title, desc }: { letter: string; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 w-6 h-6 rounded-md bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 flex items-center justify-center text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300">
        {letter}
      </div>
      <div className="min-w-0">
        <div className="font-medium text-zinc-800 dark:text-zinc-200">{title}</div>
        <div className="text-zinc-500 dark:text-zinc-400 leading-relaxed">{desc}</div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// AUDITOR compliance showcase card
// ---------------------------------------------------------------------------
function AuditorCard() {
  return (
    <Link href="/console/encrypted-erc/auditor" className="block h-full">
      <TileShell className="h-full group cursor-pointer">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
            <ShieldCheck className="w-4 h-4 text-zinc-600 dark:text-zinc-300 shield-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Compliance by design</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              One designated BabyJubJub key can decrypt every transaction. Not the contract owner, not a backend — the
              auditor and only the auditor. Rotatable.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </TileShell>
    </Link>
  );
}

function DeployYourOwnCard() {
  return (
    <Link href="/console/encrypted-erc/deploy" className="block h-full">
      <TileShell className="h-full group cursor-pointer">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
            <svg
              className="w-4 h-4 text-zinc-600 dark:text-zinc-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Deploy on your L1</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Six-step wizard. Library, five verifiers, Registrar, EncryptedERC, register + auditor — all wired up for
              your chain.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </TileShell>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// ACTION TILE — row-3 quick actions
// ---------------------------------------------------------------------------
const ACCENT_BG: Record<string, string> = {
  emerald: 'group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20',
  blue: 'group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20',
  violet: 'group-hover:bg-violet-50 dark:group-hover:bg-violet-900/20',
  rose: 'group-hover:bg-rose-50 dark:group-hover:bg-rose-900/20',
  amber: 'group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20',
};
const ACCENT_ICON: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  blue: 'text-blue-600 dark:text-blue-400',
  violet: 'text-violet-600 dark:text-violet-400',
  rose: 'text-rose-600 dark:text-rose-400',
  amber: 'text-amber-600 dark:text-amber-400',
};

type ActionTileStatus = 'done' | 'next' | 'available';

const STATUS_STYLES: Record<ActionTileStatus, { label: string; className: string }> = {
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

function ActionTile({
  href,
  title,
  subtitle,
  icon,
  accent,
  status,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: 'emerald' | 'blue' | 'violet' | 'rose' | 'amber';
  status?: ActionTileStatus;
}) {
  const statusMeta = status ? STATUS_STYLES[status] : null;

  return (
    <Link href={href} className="block h-full">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
        className="group relative h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-4 cursor-pointer transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)';
        }}
      >
        {statusMeta && (
          <span
            className={cn(
              'absolute right-3 top-3 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
              statusMeta.className,
            )}
          >
            {statusMeta.label}
          </span>
        )}
        <div
          className={cn(
            'w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 transition-colors',
            ACCENT_BG[accent],
          )}
        >
          <span className={cn('[&_svg]:w-4 [&_svg]:h-4', ACCENT_ICON[accent])}>{icon}</span>
        </div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{subtitle}</p>
      </motion.div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SVG micro-icons (with hover animations)
// ---------------------------------------------------------------------------
function KeyIcon() {
  return (
    <svg
      className="key-wobble"
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

function DepositIcon() {
  return (
    <svg
      className="arrow-down"
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

function WithdrawIcon() {
  return (
    <svg
      className="arrow-up"
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

function SendIconAnim() {
  return (
    <svg
      className="send-icon"
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

function EyeIconAnim() {
  return (
    <svg
      className="eye-blink"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transformOrigin: 'center' }}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// TileShell — matches bento card geometry exactly
// ---------------------------------------------------------------------------
function TileShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
      className={cn(
        'relative h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-4 transition-colors duration-200 hover:border-zinc-300 dark:hover:border-zinc-700',
        className,
      )}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)' }}
    >
      {children}
    </motion.div>
  );
}

export default Overview;
