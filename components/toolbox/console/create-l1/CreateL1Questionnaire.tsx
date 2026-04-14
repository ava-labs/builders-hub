'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
  Sparkles,
  Check,
} from 'lucide-react';
import {
  useCreateL1FlowStore,
  type StartingPoint,
  type VMLocation,
  type ValidatorType,
  type QuestionnaireAnswers,
} from '@/components/toolbox/stores/createL1FlowStore';
import { generateCreateL1Steps, getStepLabel } from './generateSteps';

// ---------------------------------------------------------------------------
// Framer variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
};

// ---------------------------------------------------------------------------
// Option card — premium, tactile
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
        'relative flex flex-col items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200',
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
      {/* Selection ring */}
      <div
        className={cn(
          'absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300',
          selected
            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30 scale-100'
            : 'border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-transparent scale-90',
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </div>

      {/* Icon */}
      <div
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300',
          selected
            ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
        )}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="space-y-1.5 pr-6">
        <h4 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">{title}</h4>
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>

      {/* Recommended */}
      {recommended && (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase transition-colors duration-200',
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
// Question section
// ---------------------------------------------------------------------------

interface QuestionSectionProps {
  number: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function QuestionSection({ number, title, subtitle, children }: QuestionSectionProps) {
  return (
    <motion.div className="space-y-5" variants={itemVariants}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-sm font-bold text-white dark:text-zinc-900 shadow-sm">
            {number}
          </span>
          <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        </div>
        {subtitle && <p className="ml-11 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function CreateL1Questionnaire() {
  const router = useRouter();
  const setAnswers = useCreateL1FlowStore((s) => s.setAnswers);
  const setCurrentStepIndex = useCreateL1FlowStore((s) => s.setCurrentStepIndex);

  const [startingPoint, setStartingPoint] = useState<StartingPoint>('new');
  const [vmLocation, setVmLocation] = useState<VMLocation>('l1');
  const [validatorType, setValidatorType] = useState<ValidatorType>('poa');
  const [multisig, setMultisig] = useState(false);

  const previewAnswers: QuestionnaireAnswers = useMemo(
    () => ({ startingPoint, vmLocation, validatorType, multisig }),
    [startingPoint, vmLocation, validatorType, multisig],
  );

  const previewSteps = useMemo(() => generateCreateL1Steps(previewAnswers), [previewAnswers]);

  function handleStart() {
    setAnswers(previewAnswers);
    setCurrentStepIndex(0);
    const firstStepKey = previewSteps[0]?.key;
    if (firstStepKey) {
      router.push(`/console/create-l1/${firstStepKey}`);
    }
  }

  return (
    <motion.div className="mx-auto max-w-4xl" variants={containerVariants} initial="hidden" animate="visible">
      {/* ── Hero ──────────────────────────────────────────── */}
      <motion.div className="mb-12" variants={itemVariants}>
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">
          Builder Console
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
          Create an Avalanche L1
        </h1>
        <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
          Configure your L1 in under a minute. We&apos;ll generate a custom deployment flow tailored to your
          architecture.
        </p>
      </motion.div>

      {/* ── Questions ─────────────────────────────────────── */}
      <div className="space-y-8">
        <QuestionSection
          number={1}
          title="Starting point"
          subtitle="Are you creating a brand new network or converting an existing one?"
        >
          <OptionCard
            id="new"
            selected={startingPoint === 'new'}
            onSelect={setStartingPoint}
            icon={<Layers className="h-5 w-5" />}
            title="New L1 from scratch"
            description="Create a subnet, deploy a chain with custom genesis, and convert to L1."
            recommended
          />
          <OptionCard
            id="convert-existing"
            selected={startingPoint === 'convert-existing'}
            onSelect={setStartingPoint}
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="Convert existing subnet"
            description="You already have a subnet. Skip creation and convert directly."
          />
        </QuestionSection>

        <QuestionSection
          number={2}
          title="Validator Manager location"
          subtitle="Where should the contract that manages your validators live?"
        >
          <OptionCard
            id="l1"
            selected={vmLocation === 'l1'}
            onSelect={setVmLocation}
            icon={<Server className="h-5 w-5" />}
            title="On the L1 itself"
            description="Proxy predeployed in genesis. Validators validate their own chain. Lower gas."
            recommended
          />
          <OptionCard
            id="c-chain"
            selected={vmLocation === 'c-chain'}
            onSelect={setVmLocation}
            icon={<Link2 className="h-5 w-5" />}
            title="On C-Chain"
            description="Deploy to C-Chain first, then create the L1. Simpler bootstrap."
          />
        </QuestionSection>

        <QuestionSection
          number={3}
          title="Validator management"
          subtitle="How should validators be added and removed from the network?"
        >
          <OptionCard
            id="poa"
            selected={validatorType === 'poa'}
            onSelect={setValidatorType}
            icon={<Shield className="h-5 w-5" />}
            title="Proof of Authority"
            description="Owner controls validators. Best for private or permissioned networks."
          />
          <OptionCard
            id="pos-native"
            selected={validatorType === 'pos-native'}
            onSelect={setValidatorType}
            icon={<Coins className="h-5 w-5" />}
            title="Proof of Stake (Native)"
            description="Validators stake the native token. Open and permissionless."
          />
          <OptionCard
            id="pos-erc20"
            selected={validatorType === 'pos-erc20'}
            onSelect={setValidatorType}
            icon={<HandCoins className="h-5 w-5" />}
            title="Proof of Stake (ERC20)"
            description="Validators stake an ERC20 token. Flexible tokenomics."
          />
        </QuestionSection>

        <QuestionSection number={4} title="Ownership" subtitle="Who controls the validator manager contract?">
          <OptionCard
            id="no"
            selected={!multisig}
            onSelect={() => setMultisig(false)}
            icon={<User className="h-5 w-5" />}
            title="Single wallet"
            description="Your connected wallet is the admin. Fast and simple."
            recommended
          />
          <OptionCard
            id="yes"
            selected={multisig}
            onSelect={() => setMultisig(true)}
            icon={<Users className="h-5 w-5" />}
            title="Gnosis Safe multisig"
            description="Transfer ownership to a Safe. Better security for production."
          />
        </QuestionSection>
      </div>

      {/* ── Flow Preview (dark card, matching homepage) ────── */}
      <motion.div
        className="mt-12 rounded-2xl border border-zinc-700 bg-zinc-800 p-6"
        variants={itemVariants}
        style={{
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Your deployment flow</h3>
          <span className="text-sm text-zinc-400 tabular-nums">{previewSteps.length} steps</span>
        </div>

        {/* Timeline */}
        <div className="space-y-0">
          {previewSteps.map((step, idx) => (
            <div key={step.key} className="flex items-start gap-3">
              {/* Dot + line */}
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-300">
                  {idx + 1}
                </div>
                {idx < previewSteps.length - 1 && <div className="w-px h-5 bg-zinc-700" />}
              </div>
              <span className="text-sm text-zinc-300 pt-0.5">{getStepLabel(step.key)}</span>
            </div>
          ))}
        </div>

        {/* PoS / multisig note */}
        {(validatorType !== 'poa' || multisig) && (
          <p className="mt-5 text-xs text-zinc-500 border-t border-zinc-700 pt-4">
            {validatorType !== 'poa' && (
              <>
                After this flow →{' '}
                <span className="text-zinc-400">
                  {validatorType === 'pos-native' ? 'Native' : 'ERC20'} Staking Manager Setup
                </span>
                .{' '}
              </>
            )}
            {multisig && (
              <>
                {' '}
                Then → <span className="text-zinc-400">Multisig Setup</span>.
              </>
            )}
          </p>
        )}
      </motion.div>

      {/* ── Start ─────────────────────────────────────────── */}
      <motion.div className="mt-8" variants={itemVariants}>
        <motion.button
          type="button"
          onClick={handleStart}
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="group inline-flex items-center gap-3 rounded-xl bg-zinc-900 dark:bg-white px-8 py-4 text-base font-semibold text-white dark:text-zinc-900 transition-shadow duration-200"
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
      </motion.div>
    </motion.div>
  );
}
