'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
// Option card — large, tactile, with strong selected state
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
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        'relative flex flex-col items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        selected
          ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/30 shadow-sm shadow-blue-200/50 dark:shadow-blue-900/20'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700',
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          'absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200',
          selected ? 'bg-blue-500 text-white scale-100' : 'bg-zinc-100 dark:bg-zinc-800 text-transparent scale-90',
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </div>

      {/* Icon */}
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200',
          selected ? 'bg-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
        )}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h4>
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>

      {/* Recommended badge */}
      {recommended && (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200',
            selected
              ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
          )}
        >
          <Sparkles className="h-3 w-3" />
          Recommended
        </span>
      )}
    </button>
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
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white text-xs font-bold text-white dark:text-zinc-900">
            {number}
          </span>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        </div>
        {subtitle && <p className="ml-10 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
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
    <div className="mx-auto max-w-4xl">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
          Create an Avalanche L1
        </h1>
        <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
          Configure your L1 in under a minute. Answer four questions and we&apos;ll generate a custom deployment flow
          tailored to your architecture.
        </p>
      </div>

      {/* ── Questions ─────────────────────────────────────────── */}
      <div className="space-y-10">
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
            description="Create a new subnet, deploy a chain with custom genesis, and convert to an L1."
            recommended
          />
          <OptionCard
            id="convert-existing"
            selected={startingPoint === 'convert-existing'}
            onSelect={setStartingPoint}
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="Convert existing subnet"
            description="You already have a subnet. Skip creation and go straight to L1 conversion."
          />
        </QuestionSection>

        <div className="h-px bg-zinc-200/80 dark:bg-zinc-800" />

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
            description="Proxy predeployed in genesis. Validators validate their own chain. Lower gas costs."
            recommended
          />
          <OptionCard
            id="c-chain"
            selected={vmLocation === 'c-chain'}
            onSelect={setVmLocation}
            icon={<Link2 className="h-5 w-5" />}
            title="On C-Chain"
            description="Deploy to C-Chain first, then create the L1. Simpler bootstrap, higher gas."
          />
        </QuestionSection>

        <div className="h-px bg-zinc-200/80 dark:bg-zinc-800" />

        <QuestionSection number={3} title="Validator management" subtitle="How should validators be added and removed?">
          <OptionCard
            id="poa"
            selected={validatorType === 'poa'}
            onSelect={setValidatorType}
            icon={<Shield className="h-5 w-5" />}
            title="Proof of Authority"
            description="A single owner (or multisig) controls who can validate. Best for private or permissioned networks."
          />
          <OptionCard
            id="pos-native"
            selected={validatorType === 'pos-native'}
            onSelect={setValidatorType}
            icon={<Coins className="h-5 w-5" />}
            title="Proof of Stake (Native)"
            description="Validators stake the L1's native token. Open and permissionless."
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

        <div className="h-px bg-zinc-200/80 dark:bg-zinc-800" />

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
            description="Transfer ownership to a Safe after deployment. Better security for production."
          />
        </QuestionSection>
      </div>

      {/* ── Generated Flow Preview ────────────────────────────── */}
      <div className="mt-12 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Your deployment flow</h3>
          <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500 tabular-nums">
            {previewSteps.length} steps
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {previewSteps.map((step, idx) => (
            <div key={step.key} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-400 dark:text-zinc-500">{idx + 1}.</span>
                {getStepLabel(step.key)}
              </span>
              {idx < previewSteps.length - 1 && (
                <ArrowRight className="h-3 w-3 text-zinc-300 dark:text-zinc-600 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* PoS / multisig follow-up note */}
        {(validatorType !== 'poa' || multisig) && (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/80 dark:border-zinc-800 pt-4">
            {validatorType !== 'poa' && (
              <>
                After this flow, continue to{' '}
                <strong>{validatorType === 'pos-native' ? 'Native' : 'ERC20'} Staking Manager Setup</strong> to deploy
                staking contracts.{' '}
              </>
            )}
            {multisig && (
              <>
                Then use <strong>Multisig Setup</strong> to transfer ownership to a Safe.
              </>
            )}
          </p>
        )}
      </div>

      {/* ── Start button ──────────────────────────────────────── */}
      <div className="mt-8 flex items-center gap-5">
        <button
          type="button"
          onClick={handleStart}
          className={cn(
            'group inline-flex items-center gap-3 rounded-xl px-8 py-4 text-base font-semibold transition-all duration-200',
            'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100',
            'text-white dark:text-zinc-900',
            'shadow-lg shadow-zinc-900/10 dark:shadow-white/10 hover:shadow-xl hover:shadow-zinc-900/20 dark:hover:shadow-white/20',
          )}
        >
          Start deployment
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
