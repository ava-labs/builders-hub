'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Layers,
  ArrowRightLeft,
  Server,
  Link2,
  Shield,
  Coins,
  HandCoins,
  User,
  Users,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  Droplets,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import {
  useCreateL1FlowStore,
  type StartingPoint,
  type VMLocation,
  type ValidatorType,
  type QuestionnaireAnswers,
} from '@/components/toolbox/stores/createL1FlowStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { generateCreateL1Steps, getStepLabel } from './generateSteps';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_P_BALANCE = BigInt(0.1e9); // 0.1 AVAX in nAVAX

const TOTAL_QUESTIONS = 4;

// ---------------------------------------------------------------------------
// Framer variants
// ---------------------------------------------------------------------------

const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
    transition: { duration: 0.2 },
  }),
};

// ---------------------------------------------------------------------------
// Option card
// ---------------------------------------------------------------------------

interface OptionCardProps<T extends string> {
  id: T;
  selected: boolean;
  onSelect: (id: T) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  recommended?: boolean;
}

function OptionCard<T extends string>({
  id,
  selected,
  onSelect,
  icon,
  title,
  description,
  recommended,
}: OptionCardProps<T>) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(id)}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative flex flex-col items-start gap-4 rounded-2xl border p-6 text-left transition-all duration-200 w-full',
        selected
          ? 'border-blue-500/60 bg-gradient-to-br from-blue-50 via-blue-50/50 to-white dark:from-blue-950/40 dark:via-blue-950/20 dark:to-zinc-900'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700',
      )}
      style={{
        boxShadow: selected
          ? '0 0 0 1px rgba(59,130,246,0.15), 0 4px 16px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.8)'
          : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
        className={cn(
          'absolute top-5 right-5 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300',
          selected
            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30 scale-100'
            : 'border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-transparent scale-90',
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </div>

      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300',
          selected
            ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
        )}
      >
        {icon}
      </div>

      <div className="space-y-1.5 pr-8">
        <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">{title}</h4>
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>

      {recommended && (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
            selected
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500',
          )}
        >
          <Sparkles className="h-3 w-3" />
          Recommended
        </span>
      )}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="relative h-1 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-blue-500"
            initial={false}
            animate={{ width: i <= current ? '100%' : '0%' }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function CreateL1Questionnaire() {
  const router = useRouter();
  const setAnswers = useCreateL1FlowStore((s) => s.setAnswers);
  const setCurrentStepIndex = useCreateL1FlowStore((s) => s.setCurrentStepIndex);

  const { isTestnet, pChainBalance, walletEVMAddress } = useWalletStore();

  const [questionIndex, setQuestionIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const [startingPoint, setStartingPoint] = useState<StartingPoint>('new');
  const [vmLocation, setVmLocation] = useState<VMLocation>('l1');
  const [validatorType, setValidatorType] = useState<ValidatorType>('poa');
  const [multisig, setMultisig] = useState(false);

  const previewAnswers: QuestionnaireAnswers = useMemo(
    () => ({ startingPoint, vmLocation, validatorType, multisig }),
    [startingPoint, vmLocation, validatorType, multisig],
  );

  const previewSteps = useMemo(() => generateCreateL1Steps(previewAnswers), [previewAnswers]);

  // Wallet preflight — determine if extra steps are needed
  const needsFaucet = isTestnet && pChainBalance !== undefined && BigInt(pChainBalance || 0) < MIN_P_BALANCE;
  const isConnected = !!walletEVMAddress;

  const goNext = useCallback(() => {
    if (questionIndex < TOTAL_QUESTIONS) {
      setDirection(1);
      setQuestionIndex((i) => i + 1);
    }
  }, [questionIndex]);

  const goBack = useCallback(() => {
    if (questionIndex > 0) {
      setDirection(-1);
      setQuestionIndex((i) => i - 1);
    }
  }, [questionIndex]);

  function handleStart() {
    setAnswers(previewAnswers);
    setCurrentStepIndex(0);
    const firstStepKey = previewSteps[0]?.key;
    if (firstStepKey) {
      router.push(`/console/create-l1/${firstStepKey}`);
    }
  }

  // Review page is index === TOTAL_QUESTIONS
  const isReview = questionIndex === TOTAL_QUESTIONS;

  return (
    <div className="mx-auto max-w-3xl min-h-[60vh] flex flex-col">
      {/* ── Progress ──────────────────────────────────────── */}
      <div className="mb-8">
        <ProgressBar current={questionIndex} total={TOTAL_QUESTIONS + 1} />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            {isReview ? 'Review' : `Question ${questionIndex + 1} of ${TOTAL_QUESTIONS}`}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Create L1</p>
        </div>
      </div>

      {/* ── Question area ─────────────────────────────────── */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait" custom={direction}>
          {questionIndex === 0 && (
            <motion.div
              key="q0"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  What are you building?
                </h2>
                <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
                  Choose your starting point.{' '}
                  <Link
                    href="/docs/avalanche-l1s"
                    target="_blank"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    What is an L1? →
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <OptionCard
                  id="new"
                  selected={startingPoint === 'new'}
                  onSelect={(v) => {
                    setStartingPoint(v);
                  }}
                  icon={<Layers className="h-5 w-5" />}
                  title="New L1 from scratch"
                  description="Create a subnet, chain, and convert to L1 — the full setup."
                  recommended
                />
                <OptionCard
                  id="convert-existing"
                  selected={startingPoint === 'convert-existing'}
                  onSelect={(v) => {
                    setStartingPoint(v);
                  }}
                  icon={<ArrowRightLeft className="h-5 w-5" />}
                  title="Convert existing subnet"
                  description="Already have a subnet? Skip creation and convert it to an L1."
                />
              </div>
            </motion.div>
          )}

          {questionIndex === 1 && (
            <motion.div
              key="q1"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Where should the Validator Manager live?
                </h2>
                <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
                  The contract that manages who can validate your L1.{' '}
                  <Link
                    href="/docs/avalanche-l1s/validator-manager/contract"
                    target="_blank"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    Learn about Validator Managers →
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <OptionCard
                  id="l1"
                  selected={vmLocation === 'l1'}
                  onSelect={(v) => {
                    setVmLocation(v);
                  }}
                  icon={<Server className="h-5 w-5" />}
                  title="On the L1 itself"
                  description="Proxy predeployed in genesis. Validators validate their own chain. Lower gas costs."
                  recommended
                />
                <OptionCard
                  id="c-chain"
                  selected={vmLocation === 'c-chain'}
                  onSelect={(v) => {
                    setVmLocation(v);
                  }}
                  icon={<Link2 className="h-5 w-5" />}
                  title="On C-Chain"
                  description="Deploy to C-Chain first. Simpler bootstrap, but higher gas costs."
                />
              </div>
            </motion.div>
          )}

          {questionIndex === 2 && (
            <motion.div
              key="q2"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  How should validators be managed?
                </h2>
                <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
                  This determines who can join and leave the validator set.{' '}
                  <Link
                    href="/academy/avalanche-l1/permissioned-l1s"
                    target="_blank"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    PoA vs PoS guide →
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <OptionCard
                  id="poa"
                  selected={validatorType === 'poa'}
                  onSelect={(v) => {
                    setValidatorType(v);
                  }}
                  icon={<Shield className="h-5 w-5" />}
                  title="Proof of Authority"
                  description="Owner controls validators directly."
                />
                <OptionCard
                  id="pos-native"
                  selected={validatorType === 'pos-native'}
                  onSelect={(v) => {
                    setValidatorType(v);
                  }}
                  icon={<Coins className="h-5 w-5" />}
                  title="PoS (Native)"
                  description="Stake the L1's native token."
                />
                <OptionCard
                  id="pos-erc20"
                  selected={validatorType === 'pos-erc20'}
                  onSelect={(v) => {
                    setValidatorType(v);
                  }}
                  icon={<HandCoins className="h-5 w-5" />}
                  title="PoS (ERC20)"
                  description="Stake an ERC20 token."
                />
              </div>
            </motion.div>
          )}

          {questionIndex === 3 && (
            <motion.div
              key="q3"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Who owns the Validator Manager?
                </h2>
                <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
                  You can always transfer ownership later.{' '}
                  <Link
                    href="/academy/avalanche-l1/permissioned-l1s"
                    target="_blank"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    Security best practices →
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <OptionCard
                  id="no"
                  selected={!multisig}
                  onSelect={() => setMultisig(false)}
                  icon={<User className="h-5 w-5" />}
                  title="Single wallet"
                  description="Your connected wallet. Fast and simple."
                  recommended
                />
                <OptionCard
                  id="yes"
                  selected={multisig}
                  onSelect={() => setMultisig(true)}
                  icon={<Users className="h-5 w-5" />}
                  title="Gnosis Safe multisig"
                  description="Better security for production."
                />
              </div>
            </motion.div>
          )}

          {isReview && (
            <motion.div
              key="review"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Ready to build</h2>
                <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
                  Here&apos;s your custom deployment flow.
                </p>
              </div>

              {/* Wallet preflight warnings */}
              {!isConnected && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                  <Wallet className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Wallet not connected</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Connect your wallet to begin. A faucet step will be added if you need testnet AVAX.
                    </p>
                  </div>
                </div>
              )}
              {isConnected && needsFaucet && (
                <div className="flex items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
                  <Droplets className="h-5 w-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Low P-Chain balance</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      A faucet step has been added to your flow. You&apos;ll need AVAX for P-Chain transactions.
                    </p>
                  </div>
                </div>
              )}

              {/* Dark timeline card */}
              <div
                className="rounded-2xl border border-zinc-700 bg-zinc-800 p-6"
                style={{
                  boxShadow:
                    'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
                }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-white">Deployment steps</h3>
                  <span className="text-sm text-zinc-400 tabular-nums">
                    {previewSteps.length + (needsFaucet ? 1 : 0)} steps
                  </span>
                </div>

                <div className="space-y-0">
                  {needsFaucet && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                          <Droplets className="h-3 w-3" />
                        </div>
                        <div className="w-px h-5 bg-zinc-700" />
                      </div>
                      <span className="text-sm text-blue-400 pt-0.5 font-medium">Get testnet AVAX from faucet</span>
                    </div>
                  )}
                  {previewSteps.map((step, idx) => (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-300">
                          {idx + 1 + (needsFaucet ? 1 : 0)}
                        </div>
                        {idx < previewSteps.length - 1 && <div className="w-px h-5 bg-zinc-700" />}
                      </div>
                      <span className="text-sm text-zinc-300 pt-0.5">{getStepLabel(step.key)}</span>
                    </div>
                  ))}
                </div>

                {(validatorType !== 'poa' || multisig) && (
                  <p className="mt-5 text-xs text-zinc-500 border-t border-zinc-700 pt-4">
                    {validatorType !== 'poa' && (
                      <>
                        After →{' '}
                        <span className="text-zinc-400">
                          {validatorType === 'pos-native' ? 'Native' : 'ERC20'} Staking Manager Setup
                        </span>
                        .{' '}
                      </>
                    )}
                    {multisig && (
                      <>
                        Then → <span className="text-zinc-400">Multisig Setup</span>.
                      </>
                    )}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ────────────────────────────────────── */}
      <div className="mt-10 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={questionIndex === 0}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200',
            questionIndex === 0
              ? 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
              : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800',
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {isReview ? (
          <motion.button
            type="button"
            onClick={handleStart}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="group inline-flex items-center gap-3 rounded-xl bg-zinc-900 dark:bg-white px-8 py-3.5 text-base font-semibold text-white dark:text-zinc-900"
            style={{
              boxShadow: '0 4px 14px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)';
            }}
          >
            Start deployment
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </motion.button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-white px-6 py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
