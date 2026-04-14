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
  ChevronRight,
  Lightbulb,
  CheckCircle2,
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
// Option card primitive
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
        'relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-200',
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600',
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="h-5 w-5 text-blue-500" />
        </div>
      )}
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          selected
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
        )}
      >
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h4>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      {recommended && (
        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
          <Lightbulb className="h-3 w-3" />
          Recommended
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Question row
// ---------------------------------------------------------------------------

interface QuestionRowProps {
  number: number;
  label: string;
  children: React.ReactNode;
}

function QuestionRow({ number, label, children }: QuestionRowProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {number}
        </span>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
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

  // Build preview answers
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
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Create an L1</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Answer a few questions and we will generate a custom step-by-step flow tailored to your setup.
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        {/* Q1: Starting point */}
        <QuestionRow number={1} label="Starting point">
          <OptionCard
            id="new"
            selected={startingPoint === 'new'}
            onSelect={setStartingPoint}
            icon={<Layers className="h-5 w-5" />}
            title="New L1 from scratch"
            description="Create a new Subnet, chain, and convert to L1"
            recommended
          />
          <OptionCard
            id="convert-existing"
            selected={startingPoint === 'convert-existing'}
            onSelect={setStartingPoint}
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="Convert existing subnet"
            description="Skip subnet creation, convert an existing subnet to L1"
          />
        </QuestionRow>

        {/* Q2: VM location */}
        <QuestionRow number={2} label="Validator Manager location">
          <OptionCard
            id="l1"
            selected={vmLocation === 'l1'}
            onSelect={setVmLocation}
            icon={<Server className="h-5 w-5" />}
            title="On the L1 itself"
            description="Proxy is predeployed in genesis. Lower gas costs."
            recommended
          />
          <OptionCard
            id="c-chain"
            selected={vmLocation === 'c-chain'}
            onSelect={setVmLocation}
            icon={<Link2 className="h-5 w-5" />}
            title="On C-Chain"
            description="Deploy on C-Chain first. Simpler bootstrap."
          />
        </QuestionRow>

        {/* Q3: Validator management type */}
        <QuestionRow number={3} label="Validator management type">
          <OptionCard
            id="poa"
            selected={validatorType === 'poa'}
            onSelect={setValidatorType}
            icon={<Shield className="h-5 w-5" />}
            title="Proof of Authority"
            description="Owner controls validators directly"
          />
          <OptionCard
            id="pos-native"
            selected={validatorType === 'pos-native'}
            onSelect={setValidatorType}
            icon={<Coins className="h-5 w-5" />}
            title="Proof of Stake (Native)"
            description="Stake the L1's native token"
          />
          <OptionCard
            id="pos-erc20"
            selected={validatorType === 'pos-erc20'}
            onSelect={setValidatorType}
            icon={<HandCoins className="h-5 w-5" />}
            title="Proof of Stake (ERC20)"
            description="Stake an ERC20 token"
          />
        </QuestionRow>

        {/* Q4: Multisig */}
        <QuestionRow number={4} label="Multisig owner?">
          <OptionCard
            id="no"
            selected={!multisig}
            onSelect={() => setMultisig(false)}
            icon={<User className="h-5 w-5" />}
            title="Single wallet owner"
            description="Your connected wallet is the admin"
            recommended
          />
          <OptionCard
            id="yes"
            selected={multisig}
            onSelect={() => setMultisig(true)}
            icon={<Users className="h-5 w-5" />}
            title="Gnosis Safe multisig"
            description="Transfer ownership to a Safe after setup"
          />
        </QuestionRow>
      </div>

      {/* Generated Flow Preview */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Generated Flow</h3>
        <ol className="space-y-2">
          {previewSteps.map((step, idx) => (
            <li key={step.key} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-700 dark:text-blue-300">
                {idx + 1}
              </span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{getStepLabel(step.key)}</span>
            </li>
          ))}
        </ol>

        {/* Info callout about PoS / multisig follow-up */}
        {(validatorType !== 'poa' || multisig) && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
            <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800 dark:text-blue-200">
              {validatorType !== 'poa' && (
                <>
                  After completing this flow, proceed to the{' '}
                  <strong>{validatorType === 'pos-native' ? 'Native' : 'ERC20'} Staking Manager Setup</strong> to deploy
                  and configure your staking contracts.{' '}
                </>
              )}
              {multisig && (
                <>
                  Then use <strong>Multisig Setup</strong> to transfer ownership to a Gnosis Safe.
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Start button */}
      <button
        type="button"
        onClick={handleStart}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-sm font-medium transition-colors"
      >
        Start Flow
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
