'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Coins,
  Droplets,
  HandCoins,
  Link2,
  Link2Off,
  Lock,
  PlayCircle,
  Settings2,
  Shield,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Board, BoardHeader, Rise } from '@/components/explorer-v2/ui';
import { AvaxLogo, LayersIcon, DockerLogo, CloudDeployIcon } from './icons';
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
import { clearStepFlowProgress } from '@/components/console/step-flow';

const MIN_P_BALANCE = 0.1; // AVAX; pChainBalance from walletStore is in AVAX units

const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';
const LINK =
  'text-zinc-600 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-600 dark:hover:text-zinc-100';

const VALIDATOR_LABEL: Record<ValidatorType, string> = {
  poa: 'Proof of Authority',
  'pos-native': 'Proof of Stake, native token',
  'pos-erc20': 'Proof of Stake, ERC20',
};

/* ------------------------------------------------------------------------- */

/** One choice in a question: a cell in a hairline grid, outlined in ink when chosen. */
function Option({
  selected,
  onSelect,
  icon,
  title,
  description,
  recommended,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group/opt relative flex flex-col gap-3 bg-white p-5 text-left transition-colors dark:bg-zinc-950',
        selected
          ? 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100'
          : 'hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-zinc-400 dark:hover:outline-zinc-600',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center border transition-colors',
            selected
              ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
              : 'border-zinc-200 text-zinc-500 group-hover/opt:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:group-hover/opt:text-zinc-100',
          )}
        >
          {icon}
        </span>
        <span className="flex items-center gap-2.5">
          {recommended && <span className={EYEBROW}>Recommended</span>}
          <span
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded-full border',
              selected
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'border-zinc-300 dark:border-zinc-700',
            )}
          >
            {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
        </span>
      </span>
      <span className="mt-1 text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</span>
      <span className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</span>
    </button>
  );
}

function Question({
  n,
  title,
  hint,
  cols,
  children,
}: {
  n: number;
  title: string;
  hint: React.ReactNode;
  cols: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold tabular-nums text-[#E6212F]">
            {String(n).padStart(2, '0')}
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
            {title}
          </span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </p>
        <p className="text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">{hint}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={title}
        className={cn(
          'grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800',
          cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** A question an earlier answer already settles: shown with its answer and why, so nothing is hidden. */
function Settled({ title, value, reason }: { title: string; value: string; reason: string }) {
  return (
    <div className="flex items-start gap-3 border border-zinc-200 bg-zinc-50 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{title}:</span> {value}. <span>{reason}</span>
      </p>
    </div>
  );
}

function Notice({ tone, icon, children }: { tone: 'warn' | 'info'; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border px-4 py-3 text-[13px]',
        tone === 'warn'
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
          : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
      )}
    >
      {icon}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

export default function CreateL1Questionnaire() {
  const router = useRouter();
  const setAnswers = useCreateL1FlowStore((s) => s.setAnswers);
  const setCurrentStepIndex = useCreateL1FlowStore((s) => s.setCurrentStepIndex);
  const savedAnswers = useCreateL1FlowStore((s) => s.answers);
  const savedStepIndex = useCreateL1FlowStore((s) => s.currentStepIndex);
  const resetFlow = useCreateL1FlowStore((s) => s.reset);

  // Resume is opt-in: stale answers can survive a network or store reset, so the page never jumps ahead on its own.
  const resumeStepKey = useMemo(() => getResumeStepKey(savedAnswers, savedStepIndex), [savedAnswers, savedStepIndex]);

  const { isTestnet, pChainBalance } = useWalletStore();
  const toolboxStore = useToolboxStore();

  const [advanced, setAdvanced] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  // The questionnaire only creates new L1s; converting an existing Subnet is its own tool.
  const startingPoint: StartingPoint = 'new';
  const [validatorType, setValidatorTypeRaw] = useState<ValidatorType>('poa');
  const [vmLocation, setVmLocationRaw] = useState<VMLocation>('l1');
  const [multisig, setMultisig] = useState(false);
  // Advanced means running your own infra more often than not, so Docker is the default; Basic is the managed path.
  const [hosting, setHosting] = useState<HostingOption>('docker');
  const [interoperability, setInteroperability] = useState(true);

  // A Validator Manager on the L1 Warp-messages the P-Chain on every validator change, so it needs Warp in genesis.
  const setVmLocation = useCallback((v: VMLocation) => {
    setVmLocationRaw(v);
    if (v === 'l1') setInteroperability(true);
  }, []);

  const setValidatorType = useCallback(
    (v: ValidatorType) => {
      setValidatorTypeRaw(v);
      setVmLocation(v === 'pos-erc20' ? 'c-chain' : 'l1');
    },
    [setVmLocation],
  );

  // Native staking mints the L1's own token, so its manager must live on the L1; that in turn forces Warp on.
  const isPosNative = validatorType === 'pos-native';
  const showVmLocationQ = !isPosNative;
  const showInteropQ = vmLocation !== 'l1';
  const showMultisigQ = validatorType === 'poa' && vmLocation === 'c-chain';
  const effectiveHosting: HostingOption = !isTestnet && hosting === 'managed' ? 'docker' : hosting;

  const answers: QuestionnaireAnswers = useMemo(
    () => ({
      startingPoint,
      validatorType,
      vmLocation,
      multisig: showMultisigQ ? multisig : false,
      hosting: effectiveHosting,
      interoperability,
    }),
    [startingPoint, validatorType, vmLocation, multisig, showMultisigQ, effectiveHosting, interoperability],
  );
  const steps = useMemo(() => generateCreateL1Steps(answers), [answers]);

  // pChainBalance is 0 until it loads, so only a loaded, low balance warns; the P-Chain step checks zero itself.
  const needsFaucet =
    isTestnet && typeof pChainBalance === 'number' && pChainBalance > 0 && pChainBalance < MIN_P_BALANCE;

  const chooseAdvanced = () => {
    setAdvanced(true);
    requestAnimationFrame(() => configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  function handleStart() {
    // A new run starts from clean chain, toolbox and step-progress state.
    getCreateChainStore(Boolean(isTestnet)).getState().reset();
    toolboxStore.reset();
    clearStepFlowProgress('/console/create-l1');
    setAnswers(answers);
    setCurrentStepIndex(0);
    const first = steps[0]?.key;
    if (first) router.push(`/console/create-l1/${first}`);
  }

  let n = 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-20 pt-2">
      <Rise className="flex flex-col gap-3">
        <p className={EYEBROW}>Create L1</p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
          Launch your own Avalanche L1.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Deploy one on Fuji in a click, or choose how validators join, where the Validator Manager lives, whether the
          chain talks to others, and who hosts the nodes.
        </p>
      </Rise>

      {(!isTestnet || resumeStepKey) && (
        <div className="flex flex-col gap-2">
          {!isTestnet && (
            <Notice tone="warn" icon={<Droplets className="h-4 w-4 shrink-0" />}>
              <span className="flex-1">
                You&apos;re on mainnet. Start on <span className="font-semibold">Fuji testnet</span> while you build:
                switch networks from the top bar.
              </span>
            </Notice>
          )}
          {resumeStepKey && (
            <Notice tone="info" icon={<PlayCircle className="h-4 w-4 shrink-0 text-zinc-500" />}>
              <span className="min-w-0 flex-1 truncate">
                You have a deployment in progress. Pick up at{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{getStepLabel(resumeStepKey)}</span>.
              </span>
              <button
                type="button"
                onClick={() => router.push(`/console/create-l1/${resumeStepKey}`)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-zinc-900 bg-zinc-900 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Resume <ArrowRight className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  resetFlow();
                  clearStepFlowProgress('/console/create-l1');
                }}
                title="Discard it and start a new one"
                aria-label="Discard the deployment in progress"
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </Notice>
          )}
        </div>
      )}

      <Rise
        delay={0.05}
        className="grid grid-cols-1 border-l border-t border-zinc-200 md:grid-cols-2 dark:border-zinc-800"
      >
        <button
          type="button"
          onClick={() => router.push('/console/create-l1/basic')}
          className="group/door flex min-h-48 flex-col gap-3 border-b border-r border-zinc-200 bg-white/80 p-6 text-left dark:border-zinc-800 dark:bg-zinc-950/80"
        >
          <span className="flex items-center justify-between">
            <span className={EYEBROW}>Basic · Fuji · Recommended</span>
            <Zap className="h-4 w-4 text-zinc-400 transition-colors group-hover/door:text-zinc-900 dark:group-hover/door:text-zinc-100" />
          </span>
          <span className="mt-auto flex items-center gap-2 text-[20px] font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="underline-offset-4 group-hover/door:underline">One-click L1</span>
            <ArrowRight className="h-4 w-4 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/door:translate-x-0 group-hover/door:opacity-100" />
          </span>
          <span className="max-w-md text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Subnet, genesis, a managed validator node and the Validator Manager, with sensible defaults. Name it and
            deploy.
          </span>
        </button>
        <button
          type="button"
          onClick={chooseAdvanced}
          aria-expanded={advanced}
          className={cn(
            'group/door flex min-h-48 flex-col gap-3 border-b border-r border-zinc-200 p-6 text-left transition-colors dark:border-zinc-800',
            advanced
              ? 'bg-zinc-50 outline outline-2 -outline-offset-2 outline-zinc-900 dark:bg-zinc-900 dark:outline-zinc-100'
              : 'bg-white/80 dark:bg-zinc-950/80',
          )}
        >
          <span className="flex items-center justify-between">
            <span className={EYEBROW}>Advanced · Fuji or mainnet</span>
            <Settings2 className="h-4 w-4 text-zinc-400 transition-colors group-hover/door:text-zinc-900 dark:group-hover/door:text-zinc-100" />
          </span>
          <span className="mt-auto flex items-center gap-2 text-[20px] font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="underline-offset-4 group-hover/door:underline">Configure it yourself</span>
            <ArrowRight
              className={cn(
                'h-4 w-4 text-[#E6212F] transition-all',
                advanced
                  ? 'rotate-90 opacity-100'
                  : '-translate-x-1 opacity-0 group-hover/door:translate-x-0 group-hover/door:opacity-100',
              )}
            />
          </span>
          <span className="max-w-md text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Proof of Authority or Proof of Stake, the Validator Manager on your L1 or the C-Chain, a Safe multisig, and
            Docker or managed nodes. Step by step, with your wallet.
          </span>
        </button>
      </Rise>

      {advanced && (
        <div ref={configRef} className="grid scroll-mt-8 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Rise className="flex min-w-0 flex-col gap-10">
            <Question
              n={++n}
              title="Validators"
              cols={3}
              hint={
                <>
                  How validators join and leave the network.{' '}
                  <Link href="/academy/avalanche-l1/permissioned-l1s" target="_blank" className={LINK}>
                    Compare approaches
                  </Link>
                </>
              }
            >
              <Option
                selected={validatorType === 'poa'}
                onSelect={() => setValidatorType('poa')}
                icon={<Shield className="h-4 w-4" />}
                title="Proof of Authority"
                description="An owner address decides who validates. For private or permissioned networks."
              />
              <Option
                selected={validatorType === 'pos-native'}
                onSelect={() => setValidatorType('pos-native')}
                icon={<Coins className="h-4 w-4" />}
                title="Proof of Stake, native"
                description="Validators stake your L1's native token. Open and permissionless."
              />
              <Option
                selected={validatorType === 'pos-erc20'}
                onSelect={() => setValidatorType('pos-erc20')}
                icon={<HandCoins className="h-4 w-4" />}
                title="Proof of Stake, ERC20"
                description="Validators stake an ERC20 token, for tokenomics of your own."
              />
            </Question>

            {showVmLocationQ ? (
              <Question
                n={++n}
                title="Validator Manager"
                cols={2}
                hint={
                  <>
                    Where the contract that registers and removes validators is deployed.{' '}
                    <Link href="/docs/avalanche-l1s/validator-manager/contract" target="_blank" className={LINK}>
                      How it works
                    </Link>
                  </>
                }
              >
                <Option
                  selected={vmLocation === 'l1'}
                  onSelect={() => setVmLocation('l1')}
                  icon={<LayersIcon className="h-4 w-4" />}
                  title="On the L1"
                  description="In genesis behind a proxy. Lower gas, and your validators run their own chain."
                  recommended={validatorType === 'poa'}
                />
                <Option
                  selected={vmLocation === 'c-chain'}
                  onSelect={() => setVmLocation('c-chain')}
                  icon={<AvaxLogo className="h-4 w-4" />}
                  title="On the C-Chain"
                  description="Deployed on Avalanche's C-Chain. Simpler to bootstrap; needed for ERC20 staking."
                  recommended={validatorType === 'pos-erc20'}
                />
              </Question>
            ) : (
              <Settled
                title="Validator Manager"
                value="on the L1"
                reason="Native staking mints the L1's own token, which only code on the L1 can do."
              />
            )}

            {showInteropQ ? (
              <Question
                n={++n}
                title="Interoperability"
                cols={2}
                hint={
                  <>
                    Put the Warp precompile and the Teleporter (ICM) messenger in genesis so the chain can message other
                    chains.{' '}
                    <Link href="/docs/cross-chain" target="_blank" className={LINK}>
                      What is ICM
                    </Link>
                  </>
                }
              >
                <Option
                  selected={interoperability}
                  onSelect={() => setInteroperability(true)}
                  icon={<Link2 className="h-4 w-4" />}
                  title="Cross-chain messaging"
                  description="Warp plus a pre-deployed Teleporter messenger. Needed for ICM, bridges and ICTT."
                  recommended
                />
                <Option
                  selected={!interoperability}
                  onSelect={() => setInteroperability(false)}
                  icon={<Link2Off className="h-4 w-4" />}
                  title="Isolated L1"
                  description="No Warp or Teleporter. A smaller genesis, but no messages to other L1s."
                />
              </Question>
            ) : (
              <Settled
                title="Interoperability"
                value="on"
                reason="A Validator Manager on the L1 reports validator changes to the P-Chain over Warp."
              />
            )}

            {showMultisigQ && (
              <Question
                n={++n}
                title="Ownership"
                cols={2}
                hint={
                  <>
                    Who controls the Validator Manager. You can transfer it later.{' '}
                    <Link href="/academy/avalanche-l1/permissioned-l1s" target="_blank" className={LINK}>
                      Security practices
                    </Link>
                  </>
                }
              >
                <Option
                  selected={!multisig}
                  onSelect={() => setMultisig(false)}
                  icon={<User className="h-4 w-4" />}
                  title="Single wallet"
                  description="The wallet you're connected with. Quick and simple."
                  recommended
                />
                <Option
                  selected={multisig}
                  onSelect={() => setMultisig(true)}
                  icon={<Users className="h-4 w-4" />}
                  title="Safe multisig"
                  description="Ownership moves to a Safe on the C-Chain. Production-grade control."
                />
              </Question>
            )}

            <Question n={++n} title="Infrastructure" cols={2} hint="Where your L1's nodes run.">
              {isTestnet && (
                <Option
                  selected={effectiveHosting === 'managed'}
                  onSelect={() => setHosting('managed')}
                  icon={<CloudDeployIcon className="h-4 w-4" />}
                  title="Managed"
                  description="Hosted nodes and a relayer on Fuji, set up for you. The fastest start."
                  recommended
                />
              )}
              <Option
                selected={effectiveHosting === 'docker'}
                onSelect={() => setHosting('docker')}
                icon={<DockerLogo className="h-4 w-4" />}
                title="Docker"
                description="AvalancheGo in Docker on your own machine or server."
                recommended={!isTestnet}
              />
            </Question>
          </Rise>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <Board className="border-x border-t">
              <BoardHeader label="Your deployment" display />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-5 py-4 text-[13px]">
                <dt className="text-zinc-500 dark:text-zinc-400">Validators</dt>
                <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
                  {VALIDATOR_LABEL[validatorType]}
                </dd>
                <dt className="text-zinc-500 dark:text-zinc-400">Manager</dt>
                <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
                  {vmLocation === 'l1' ? 'On the L1' : 'On the C-Chain'}
                </dd>
                <dt className="text-zinc-500 dark:text-zinc-400">Interop</dt>
                <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
                  {interoperability ? 'Warp + Teleporter' : 'Isolated'}
                </dd>
                {showMultisigQ && (
                  <>
                    <dt className="text-zinc-500 dark:text-zinc-400">Owner</dt>
                    <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
                      {multisig ? 'Safe multisig' : 'Your wallet'}
                    </dd>
                  </>
                )}
                <dt className="text-zinc-500 dark:text-zinc-400">Nodes</dt>
                <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
                  {effectiveHosting === 'managed' ? 'Managed' : 'Docker'}
                </dd>
              </dl>

              <div className="px-5 py-4">
                <p className="mb-3 flex items-baseline justify-between">
                  <span className={EYEBROW}>Steps</span>
                  <span className="font-mono text-[10px] tabular-nums text-zinc-400">{steps.length}</span>
                </p>
                <ol className="flex flex-col gap-1.5">
                  {steps.map((step, i) => (
                    <li
                      key={step.key}
                      className="flex items-baseline gap-3 text-[13px] text-zinc-700 dark:text-zinc-300"
                    >
                      <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-zinc-400">
                        {i + 1}
                      </span>
                      {getStepLabel(step.key)}
                    </li>
                  ))}
                </ol>
                {steps.length > 7 && (
                  <p className="mt-4 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Each step is also its own tool in the{' '}
                    <Link href="/console/toolbox" className={LINK}>
                      Toolbox
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div className="px-5 py-4">
                <button
                  type="button"
                  onClick={handleStart}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 border border-zinc-900 bg-zinc-900 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Start deployment <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {needsFaucet && (
                  <p className="mt-3 flex gap-2 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                    <Droplets className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Your P-Chain balance is under {MIN_P_BALANCE} AVAX, and the P-Chain steps pay fees from it.{' '}
                      <Link href="/console/primary-network/faucet" className="underline underline-offset-4">
                        Get test AVAX
                      </Link>
                    </span>
                  </p>
                )}
              </div>
            </Board>
          </aside>
        </div>
      )}
    </div>
  );
}
