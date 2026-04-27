'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
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
  Link2,
  Link2Off,
  PlayCircle,
  X,
  Zap,
  Settings2,
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
import { getCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { generateCreateL1Steps, getResumeStepKey, getStepLabel } from './generateSteps';

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
  const savedAnswers = useCreateL1FlowStore((s) => s.answers);
  const savedStepIndex = useCreateL1FlowStore((s) => s.currentStepIndex);

  // Resume hint — surfaced as an opt-in banner on Q1 when an in-progress
  // flow exists. We intentionally *don't* auto-redirect: network/store
  // resets can leave stale `answers` in localStorage, and bouncing the user
  // past the questionnaire against their will makes those resets confusing.
  // One click to resume is a fair price for keeping the reset affordance
  // working the way users expect.
  const resumeStepKey = useMemo(() => getResumeStepKey(savedAnswers, savedStepIndex), [savedAnswers, savedStepIndex]);
  const resetFlow = useCreateL1FlowStore((s) => s.reset);

  const { isTestnet, pChainBalance } = useWalletStore();
  const toolboxStore = useToolboxStore();

  // Setup-mode gate: before any questionnaire question, ask whether the
  // user wants a one-click Basic deploy or the full Advanced flow. `null`
  // means the user hasn't chosen yet; 'advanced' continues into the
  // existing Q1+ questions. `pendingSetupMode` is the transient card
  // selection — committed to `setupMode` (or routed away) only when the
  // user hits Continue, matching the typeform flow on every other Q.
  const [setupMode, setSetupMode] = useState<'basic' | 'advanced' | null>(null);
  const [pendingSetupMode, setPendingSetupMode] = useState<'basic' | 'advanced' | null>(null);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  // Q1: Validator type, Q2: VM location, Q3: Interop, Q4: Ownership (conditional), Q5: Hosting
  // Convert-existing flow was dropped — the questionnaire only creates new L1s now.
  const startingPoint: StartingPoint = 'new';
  const [validatorType, setValidatorTypeRaw] = useState<ValidatorType>('poa');
  const [vmLocation, setVmLocation] = useState<VMLocation>('l1');

  // Auto-switch VM location to recommended when validator type changes
  const setValidatorType = useCallback((v: ValidatorType) => {
    setValidatorTypeRaw(v);
    setVmLocation(v === 'pos-erc20' ? 'c-chain' : 'l1');
  }, []);
  const [multisig, setMultisig] = useState(false);
  // Advanced flow defaults to Docker — users who opted into Advanced are
  // typically running their own infra. Managed remains the Basic flow's
  // implicit choice.
  const [hosting, setHosting] = useState<HostingOption>('docker');
  const [interoperability, setInteroperability] = useState(true);

  // Multisig only for PoA + C-Chain. Hosting and interop always shown
  // now that convert-existing is gone (both were gated on startingPoint='new').
  const showMultisigQ = validatorType === 'poa' && vmLocation === 'c-chain';
  const showHostingQ = true;
  const showInteropQ = true;

  // Dynamic question count — base 2 (validator + vm location) plus any
  // conditional questions that are currently applicable.
  const totalQuestions = 2 + (showMultisigQ ? 1 : 0) + (showInteropQ ? 1 : 0) + (showHostingQ ? 1 : 0);

  const previewAnswers: QuestionnaireAnswers = useMemo(
    () => ({
      startingPoint,
      validatorType,
      vmLocation,
      multisig: showMultisigQ ? multisig : false,
      hosting,
      interoperability,
    }),
    [startingPoint, validatorType, vmLocation, multisig, showMultisigQ, hosting, interoperability, showInteropQ],
  );

  const previewSteps = useMemo(() => generateCreateL1Steps(previewAnswers), [previewAnswers]);

  // Wallet preflight
  // Only show faucet warning when balance is loaded AND explicitly low.
  // pChainBalance defaults to 0 before fetch — don't warn on unfetched state.
  // The P-Chain step has its own balance check for the truly-zero case.
  const needsFaucet =
    isTestnet && typeof pChainBalance === 'number' && pChainBalance > 0 && pChainBalance < MIN_P_BALANCE;

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
    } else {
      // At the first question, Back returns to the Basic vs Advanced chooser.
      setSetupMode(null);
    }
  }, [questionIndex]);

  function handleStart() {
    // Clear stale data from previous sessions so steps start fresh
    getCreateChainStore(Boolean(isTestnet)).getState().reset();
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

  // Setup-mode chooser — rendered as the first question in the typeform
  // flow, with the same progress bar / Back / Continue chrome as every
  // other question. Card selection is pending until the user hits
  // Continue; at that point we either route to /basic or flip into the
  // Advanced questionnaire.
  if (setupMode === null) {
    const totalSteps = totalQuestions + 1; // +1 for this chooser
    const handleContinue = () => {
      if (pendingSetupMode === 'basic') {
        router.push('/console/create-l1/basic');
      } else if (pendingSetupMode === 'advanced') {
        setSetupMode('advanced');
      }
    };

    return (
      <div className="mx-auto max-w-3xl min-h-[60vh] flex flex-col">
        {/* Testnet suggestion — mirror the Q1 behavior so the preflight
            hint surfaces on the very first screen. */}
        {!isTestnet && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">
              We recommend starting on <span className="font-semibold">Fuji testnet</span> for development. Switch
              networks in the top-right corner.
            </p>
          </div>
        )}

        {/* Progress bar — chooser is step 1 of totalSteps */}
        <div className="mb-8">
          <ProgressBar current={0} total={totalSteps + 1} />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Question 1 of {totalSteps}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Create L1</p>
          </div>
        </div>

        {/* Question area — animated like the rest of the flow */}
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key="q-setup-mode"
              custom={1}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Choose a setup
                </h2>
                <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
                  Basic is a one-click deploy with sensible defaults. Advanced opens up every configuration option.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <OptionCard
                  id="basic"
                  selected={pendingSetupMode === 'basic'}
                  onSelect={setPendingSetupMode}
                  icon={<Zap className="h-5 w-5" />}
                  title="Basic setup"
                  description="One-click deploy with sensible defaults. Subnet, genesis, a managed validator node, and the Validator Manager — handled."
                  recommended
                />
                <OptionCard
                  id="advanced"
                  selected={pendingSetupMode === 'advanced'}
                  onSelect={setPendingSetupMode}
                  icon={<Settings2 className="h-5 w-5" />}
                  title="Advanced setup"
                  description="Configure each precompile, pick PoA / PoS Native / PoS ERC20, manage multisig keys, choose Docker or managed infra."
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation — same shape as Q2+ */}
        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!pendingSetupMode}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors shadow-sm',
              pendingSetupMode
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed',
            )}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl min-h-[60vh] flex flex-col">
      {/* Testnet suggestion for new users on mainnet */}
      {!isTestnet && questionIndex === 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
          <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            We recommend starting on <span className="font-semibold">Fuji testnet</span> for development. Switch
            networks in the top-right corner.
          </p>
        </div>
      )}

      {/* Resume banner — only on Q1, when an in-progress flow is detected.
          Clicking "Resume" jumps the user to the step they left off on;
          dismissing clears the flow store so the banner disappears and
          normal questionnaire flow resumes. */}
      {questionIndex === 0 && resumeStepKey && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
          <PlayCircle className="h-5 w-5 text-zinc-600 dark:text-zinc-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Resume your previous flow</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              Pick up at{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{getStepLabel(resumeStepKey)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/console/create-l1/${resumeStepKey}`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            Resume
            <ArrowRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={resetFlow}
            title="Dismiss — start a new flow"
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Progress ──────────────────────────────────────── */}
      {/* The Basic vs Advanced chooser counts as Q1, so the Advanced
          questionnaire picks up from Q2 onward. `+1` shifts both the
          displayed index and the total. */}
      <div className="mb-8">
        <ProgressBar current={questionIndex + 1} total={totalQuestions + 2} />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            {isReview ? 'Review' : `Question ${questionIndex + 2} of ${totalQuestions + 1}`}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Create L1</p>
        </div>
      </div>

      {/* ── Question area ─────────────────────────────────── */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait" custom={direction}>
          {/* Q1: Validator management type */}
          {questionIndex === 0 && (
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

          {/* Q2: VM location */}
          {questionIndex === 1 && (
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

          {/* Q3: Interoperability */}
          {showInteropQ && questionIndex === 2 && !isReview && (
            <motion.div
              key="q-interop"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Interoperability
                </h2>
                <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
                  Bake the Warp precompile and Teleporter (ICM) messenger into your L1&apos;s genesis so it can send and
                  receive cross-chain messages.{' '}
                  <Link
                    href="/docs/cross-chain"
                    target="_blank"
                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline underline-offset-2 decoration-zinc-300 dark:decoration-zinc-600 transition-colors"
                  >
                    What is ICM? →
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <OptionCard
                  id="yes"
                  selected={interoperability}
                  onSelect={() => setInteroperability(true)}
                  icon={<Link2 className="h-5 w-5" />}
                  title="Enable cross-chain messaging"
                  description="Includes the Warp precompile and pre-deploys the Teleporter messenger. Required for ICM, bridges, and ICTT."
                  recommended
                />
                <OptionCard
                  id="no"
                  selected={!interoperability}
                  onSelect={() => setInteroperability(false)}
                  icon={<Link2Off className="h-5 w-5" />}
                  title="Isolated L1"
                  description="Skips Warp and Teleporter. Smaller genesis, but your chain can't message other Avalanche L1s."
                />
              </div>
            </motion.div>
          )}

          {/* Q4: Ownership (only for PoA + C-Chain) */}
          {questionIndex === (showInteropQ ? 3 : 2) && showMultisigQ && (
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

          {/* Q5 (index depends on which earlier questions are shown): Hosting */}
          {showHostingQ && questionIndex === 2 + (showInteropQ ? 1 : 0) + (showMultisigQ ? 1 : 0) && !isReview && (
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

              {needsFaucet && (
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
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200"
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
