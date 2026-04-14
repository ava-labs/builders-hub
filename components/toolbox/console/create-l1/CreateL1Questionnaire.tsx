'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ArrowRightLeft,
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
import { AvaxLogo, LayersIcon, DockerLogo, CloudDeployIcon } from './icons';
import Link from 'next/link';
import {
  useCreateL1FlowStore,
  type StartingPoint,
  type VMLocation,
  type ValidatorType,
  type HostingOption,
  type QuestionnaireAnswers,
} from '@/components/toolbox/stores/createL1FlowStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { generateCreateL1Steps, getStepLabel } from './generateSteps';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_P_BALANCE = 0.1; // 0.1 AVAX — pChainBalance from walletStore is in AVAX units

// Q4 (multisig) only shown for PoA + C-Chain — total is dynamic

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
          ? 'border-zinc-600 bg-zinc-800 text-white'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700',
      )}
      style={{
        boxShadow: selected
          ? 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)'
          : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          'absolute top-5 right-5 flex h-5 w-5 items-center justify-center rounded-full transition-all duration-300',
          selected
            ? 'bg-white/20 text-white scale-100'
            : 'border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-transparent scale-90',
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </div>

      {/* Icon */}
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300',
          selected ? 'bg-white/[0.08] text-zinc-200' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
        )}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="space-y-1.5 pr-8">
        <h4
          className={cn(
            'text-[15px] font-semibold leading-tight',
            selected ? 'text-white' : 'text-zinc-900 dark:text-zinc-100',
          )}
        >
          {title}
        </h4>
        <p className={cn('text-sm leading-relaxed', selected ? 'text-zinc-400' : 'text-zinc-500 dark:text-zinc-400')}>
          {description}
        </p>
      </div>

      {/* Recommended */}
      {recommended && (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
            selected
              ? 'bg-white/[0.08] text-zinc-300'
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
            className="absolute inset-y-0 left-0 rounded-full bg-zinc-900 dark:bg-white"
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
  const createChainStore = useCreateChainStore()();
  const toolboxStore = useToolboxStore();

  const [questionIndex, setQuestionIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  // Q1: Starting point, Q2: Validator type, Q3: VM location, Q4: Ownership (conditional), Q5: Hosting
  const [startingPoint, setStartingPoint] = useState<StartingPoint>('new');
  const [validatorType, setValidatorTypeRaw] = useState<ValidatorType>('poa');
  const [vmLocation, setVmLocation] = useState<VMLocation>('l1');

  // Auto-switch VM location to recommended when validator type changes
  const setValidatorType = useCallback((v: ValidatorType) => {
    setValidatorTypeRaw(v);
    setVmLocation(v === 'pos-erc20' ? 'c-chain' : 'l1');
  }, []);
  const [multisig, setMultisig] = useState(false);
  const [hosting, setHosting] = useState<HostingOption>('managed');

  // Q4 (multisig) only for PoA + C-Chain. Q5 (hosting) only for new L1.
  const showMultisigQ = validatorType === 'poa' && vmLocation === 'c-chain';
  const showHostingQ = startingPoint === 'new';

  // Dynamic question count: Q1 + Q2 + Q3 + [Q4 multisig if PoA+C-Chain] + [Q5 hosting if new]
  const totalQuestions = 3 + (showMultisigQ ? 1 : 0) + (showHostingQ ? 1 : 0);

  const previewAnswers: QuestionnaireAnswers = useMemo(
    () => ({
      startingPoint,
      validatorType,
      vmLocation,
      multisig: showMultisigQ ? multisig : false,
      hosting,
    }),
    [startingPoint, validatorType, vmLocation, multisig, showMultisigQ, hosting],
  );

  const previewSteps = useMemo(() => generateCreateL1Steps(previewAnswers), [previewAnswers]);

  // Wallet preflight
  // Only show faucet warning when balance is loaded AND explicitly low.
  // pChainBalance defaults to 0 before fetch — don't warn on unfetched state.
  // The P-Chain step has its own balance check for the truly-zero case.
  const needsFaucet =
    isTestnet && typeof pChainBalance === 'number' && pChainBalance > 0 && pChainBalance < MIN_P_BALANCE;
  const isConnected = !!walletEVMAddress;

  const goNext = useCallback(() => {
    if (questionIndex < totalQuestions) {
      setDirection(1);
      setQuestionIndex((i) => i + 1);
    }
  }, [questionIndex, totalQuestions]);

  const goBack = useCallback(() => {
    if (questionIndex > 0) {
      setDirection(-1);
      setQuestionIndex((i) => i - 1);
    }
  }, [questionIndex]);

  function handleStart() {
    // Clear stale data from previous sessions so steps start fresh
    createChainStore.reset();
    toolboxStore.reset();

    setAnswers(previewAnswers);
    setCurrentStepIndex(0);
    const firstStepKey = previewSteps[0]?.key;
    if (firstStepKey) {
      router.push(`/console/create-l1/${firstStepKey}`);
    }
  }

  // Review page is index === totalQuestions
  const isReview = questionIndex === totalQuestions;

  return (
    <div className="mx-auto max-w-3xl min-h-[60vh] flex flex-col">
      {/* ── Progress ──────────────────────────────────────── */}
      <div className="mb-8">
        <ProgressBar current={questionIndex} total={totalQuestions + 1} />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            {isReview ? 'Review' : `Question ${questionIndex + 1} of ${totalQuestions}`}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Create L1</p>
        </div>
      </div>

      {/* ── Question area ─────────────────────────────────── */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait" custom={direction}>
          {/* Q1: Starting point */}
          {questionIndex === 0 && (
            <motion.div
              key="q-start"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  What would you like to do?
                </h2>
                <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
                  <Link
                    href="/docs/avalanche-l1s"
                    target="_blank"
                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline underline-offset-2 decoration-zinc-300 dark:decoration-zinc-600 transition-colors"
                  >
                    What is an Avalanche L1? →
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <OptionCard
                  id="new"
                  selected={startingPoint === 'new'}
                  onSelect={setStartingPoint}
                  icon={<LayersIcon className="h-5 w-5" />}
                  title="New Layer 1"
                  description="Create a new subnet, chain, and validator manager from the ground up."
                  recommended
                />
                <OptionCard
                  id="convert-existing"
                  selected={startingPoint === 'convert-existing'}
                  onSelect={setStartingPoint}
                  icon={<ArrowRightLeft className="h-5 w-5" />}
                  title="Convert existing subnet"
                  description="Already have a subnet? Convert it directly to an L1."
                />
              </div>
            </motion.div>
          )}

          {/* Q2: Validator management type */}
          {questionIndex === 1 && (
            <motion.div
              key="q-validator"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Validator management
                </h2>
                <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
                  How validators join and leave the network.{' '}
                  <Link
                    href="/academy/avalanche-l1/permissioned-l1s"
                    target="_blank"
                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline underline-offset-2 decoration-zinc-300 dark:decoration-zinc-600 transition-colors"
                  >
                    Compare approaches →
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <OptionCard
                  id="poa"
                  selected={validatorType === 'poa'}
                  onSelect={setValidatorType}
                  icon={<Shield className="h-5 w-5" />}
                  title="Proof of Authority"
                  description="An owner address controls who can validate. Best for private or permissioned networks."
                />
                <OptionCard
                  id="pos-native"
                  selected={validatorType === 'pos-native'}
                  onSelect={setValidatorType}
                  icon={<Coins className="h-5 w-5" />}
                  title="Proof of Stake (Native)"
                  description="Validators stake your L1's native token. Open and permissionless."
                />
                <OptionCard
                  id="pos-erc20"
                  selected={validatorType === 'pos-erc20'}
                  onSelect={setValidatorType}
                  icon={<HandCoins className="h-5 w-5" />}
                  title="Proof of Stake (ERC20)"
                  description="Validators stake an ERC20 token. Flexible tokenomics."
                />
              </div>
            </motion.div>
          )}

          {/* Q3: VM location */}
          {questionIndex === 2 && (
            <motion.div
              key="q-vm"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Validator Manager location
                </h2>
                <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
                  Where the on-chain contract that manages your validators is deployed.{' '}
                  <Link
                    href="/docs/avalanche-l1s/validator-manager/contract"
                    target="_blank"
                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline underline-offset-2 decoration-zinc-300 dark:decoration-zinc-600 transition-colors"
                  >
                    Learn more →
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <OptionCard
                  id="l1"
                  selected={vmLocation === 'l1'}
                  onSelect={setVmLocation}
                  icon={<LayersIcon className="h-5 w-5" />}
                  title="On the L1"
                  description="Included in genesis via proxy contract. Lower gas costs, validators manage their own chain."
                  recommended={validatorType === 'poa' || validatorType === 'pos-native'}
                />
                <OptionCard
                  id="c-chain"
                  selected={vmLocation === 'c-chain'}
                  onSelect={setVmLocation}
                  icon={<AvaxLogo className="h-5 w-5" />}
                  title="On C-Chain"
                  description="Deployed on Avalanche's C-Chain. Simpler bootstrap, required for ERC20 staking."
                  recommended={validatorType === 'pos-erc20'}
                />
              </div>
            </motion.div>
          )}

          {/* Q4: Ownership (only for PoA + C-Chain) */}
          {questionIndex === 3 && showMultisigQ && (
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
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Contract ownership
                </h2>
                <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
                  Who controls the Validator Manager. You can transfer ownership later.{' '}
                  <Link
                    href="/academy/avalanche-l1/permissioned-l1s"
                    target="_blank"
                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline underline-offset-2 decoration-zinc-300 dark:decoration-zinc-600 transition-colors"
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
                  description={
                    vmLocation === 'c-chain'
                      ? 'Transfer ownership to a Safe on C-Chain. Production-ready security.'
                      : 'Requires Safe to be deployed on your L1 first. Safe must index your chain before setup.'
                  }
                />
              </div>
            </motion.div>
          )}

          {/* Q5 (or Q4 if no multisig): Hosting */}
          {showHostingQ && questionIndex === (showMultisigQ ? 4 : 3) && !isReview && (
            <motion.div
              key="q-hosting"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Infrastructure
                </h2>
                <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
                  How your L1 nodes and validators are hosted.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isTestnet && (
                  <OptionCard
                    id="managed"
                    selected={hosting === 'managed'}
                    onSelect={setHosting}
                    icon={<CloudDeployIcon className="h-5 w-5" />}
                    title="Managed"
                    description="One-click hosted nodes and relayer on Fuji testnet. Fastest way to get started."
                    recommended
                  />
                )}
                <OptionCard
                  id="docker"
                  selected={hosting === 'docker'}
                  onSelect={setHosting}
                  icon={<DockerLogo className="h-5 w-5" />}
                  title="Docker"
                  description="Run AvalancheGo in Docker on your own machine or server."
                  recommended={!isTestnet}
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
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Review your setup
                </h2>
                <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
                  Your custom deployment flow based on the choices above.
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
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                  <Droplets className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Low P-Chain balance</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
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
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 dark:bg-white text-[10px] font-bold text-white">
                          <Droplets className="h-3 w-3" />
                        </div>
                        <div className="w-px h-5 bg-zinc-700" />
                      </div>
                      <span className="text-sm text-amber-400 pt-0.5 font-medium">Get testnet AVAX from faucet</span>
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

                {previewSteps.length > 7 && (
                  <p className="mt-5 text-xs text-zinc-500 border-t border-zinc-700 pt-4">
                    This is a comprehensive flow. Each step can also be accessed individually from the{' '}
                    <span className="text-zinc-400">Toolbox</span>.
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
