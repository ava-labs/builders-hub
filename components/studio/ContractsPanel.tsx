'use client';

import { useEffect, useState } from 'react';
import { Boxes, ChevronRight, FileCode2 } from 'lucide-react';
import { encodeFunctionData, type AbiFunction } from 'viem';
import { Board, HashChip, MUTED, SectionHeader, fnInk, idInk } from '@/components/explorer-v2/ui';
import { NEED_TEXT, useConsoleSigner } from '@/lib/console-wallets/react';
import { cn } from '@/lib/utils';
import { parseAbiInput, placeholderFor, show } from './abi-input';
import { api, errorText, type DeploymentView } from './api';
import { referenceInChat } from './chat-reference';
import { BONE, Handoff } from './PublishSite';
import { studioSignerScope } from './useDeployRunner';
import { Bone, Button, EmptyState, INPUT, LABEL, Notice, Pill } from './ui';
import { walletErrorText } from './wallet';

type Contract = DeploymentView['contracts'][number];

/** A contract's title strip; the skeleton uses the same box, so the boards do not move when they load. */
const CONTRACT_HEAD =
  'flex min-h-[60px] items-center justify-between gap-4 bg-zinc-50/80 px-5 py-2.5 md:px-6 dark:bg-zinc-900/40';

/** What a write needs before it can send, said next to the Write label. The full sentence is the tooltip. */
const SEND_NEED: Record<keyof typeof NEED_TEXT, string> = {
  choose: 'Choose a wallet in Deploy to send',
  connect: 'Connect a wallet to send',
  unlock: 'Unlock your wallet to send',
  mismatch: 'Switch wallets to send',
};

const WRITE_PROMPT = 'Write a contract for this project in contracts/.';

/** A quiet state: a dot and a short word. Amber asks for action, emerald is done. */
function StateMark({
  tone,
  title,
  children,
}: {
  tone: 'good' | 'warn' | 'neutral';
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        tone === 'good' && 'text-emerald-700 dark:text-emerald-300',
        tone === 'warn' && 'text-amber-700 dark:text-amber-300',
        tone === 'neutral' && 'text-zinc-500 dark:text-zinc-400',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'good' && 'bg-emerald-500',
          tone === 'warn' && 'bg-amber-400',
          tone === 'neutral' && 'bg-zinc-300 dark:bg-zinc-600',
        )}
      />
      {children}
    </span>
  );
}

function FunctionForm({
  fn,
  mode,
  blocked = false,
  onRun,
}: {
  fn: AbiFunction;
  mode: 'read' | 'write';
  /** A write with no wallet to sign it: the form stays readable and Send waits. */
  blocked?: boolean;
  onRun: (args: unknown[], value: string) => Promise<string>;
}) {
  const [values, setValues] = useState<string[]>(() => fn.inputs.map(() => ''));
  const [value, setValue] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const payable = fn.stateMutability === 'payable';

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const args = fn.inputs.map((input, i) => parseAbiInput(values[i] ?? '', input));
      setResult({ ok: true, text: await onRun(args, value || '0') });
    } catch (e) {
      setResult({ ok: false, text: mode === 'write' ? walletErrorText(e) : errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-5 py-3 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('font-mono text-[12.5px]', fnInk)}>{fn.name}</span>
        <span className={cn(MUTED, 'text-[11px]')}>
          ({fn.inputs.map((i) => `${i.type}${i.name ? ` ${i.name}` : ''}`).join(', ')})
          {fn.outputs.length > 0 && ` → ${fn.outputs.map((o) => o.type).join(', ')}`}
        </span>
        {payable && <Pill>payable</Pill>}
      </div>
      {(fn.inputs.length > 0 || payable) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {fn.inputs.map((input, i) => (
            <input
              key={i}
              value={values[i]}
              onChange={(e) => setValues((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              placeholder={`${input.name || `arg${i}`} (${input.type}) ${placeholderFor(input)}`}
              className={INPUT}
            />
          ))}
          {payable && (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
              placeholder="value in wei"
              className={INPUT}
            />
          )}
        </div>
      )}
      <div className="flex items-start gap-3">
        <Button variant="secondary" className="h-7" onClick={() => void run()} busy={busy} disabled={blocked}>
          {mode === 'read' ? 'Read' : 'Send'}
        </Button>
        {result && (
          <pre
            className={cn(
              'min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11.5px]',
              result.ok ? 'text-zinc-800 dark:text-zinc-200' : 'text-red-700 dark:text-red-300',
            )}
          >
            {result.text}
          </pre>
        )}
      </div>
    </div>
  );
}

function ContractBoard({
  projectId,
  deploymentId,
  contract,
  chains,
}: {
  projectId: string;
  deploymentId: string;
  contract: Contract;
  chains: DeploymentView['chains'];
}) {
  const { signer, needs } = useConsoleSigner(studioSignerScope(projectId));
  const [open, setOpen] = useState(false);

  const read = async (fn: AbiFunction, args: unknown[]) => {
    const { result } = await api<{ result: unknown }>(
      `/api/studio/projects/${projectId}/deployments/${deploymentId}/read`,
      {
        method: 'POST',
        json: { stepId: contract.stepId, function: fn.name, args: JSON.parse(show(args)) },
      },
    );
    return show(result);
  };

  const write = async (fn: AbiFunction, args: unknown[], value: string) => {
    if (!signer) throw new Error(NEED_TEXT[needs ?? 'choose']);
    if (!contract.address || !contract.chainId) throw new Error('This contract is not deployed yet');
    const data = encodeFunctionData({ abi: [fn], functionName: fn.name, args });
    const hash = await signer.send(contract.chainId, chains[contract.chainId], { to: contract.address, data, value });
    return `Sent ${hash}`;
  };

  const count = contract.read.length + contract.write.length;
  const canToggle = !!contract.address && count > 0;
  const toggle = () => canToggle && setOpen((o) => !o);
  const network = (contract.chainId !== null && chains[contract.chainId]?.name) || contract.network;

  return (
    <Board className="border-x border-t border-zinc-200 dark:border-zinc-800">
      <div
        role={canToggle ? 'button' : undefined}
        tabIndex={canToggle ? 0 : undefined}
        aria-expanded={canToggle ? open : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (!canToggle || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          toggle();
        }}
        className={cn(CONTRACT_HEAD, canToggle && 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900')}
      >
        <span className="flex min-w-0 items-center gap-3">
          {canToggle && (
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform', open && 'rotate-90')}
            />
          )}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-medium text-zinc-900 dark:text-zinc-50">
              {contract.contract}
            </span>
            <span className={cn(MUTED, 'truncate text-[11px]')}>{network}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-4">
          {contract.address ? (
            <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <HashChip value={contract.address} href={contract.addressUrl ?? undefined} len={8} />
            </span>
          ) : (
            <StateMark tone="neutral">Not deployed</StateMark>
          )}
          {canToggle && (
            <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:inline dark:text-zinc-400">
              {open ? 'Hide' : `${count} functions`}
            </span>
          )}
        </span>
      </div>
      {contract.address && open && (
        <>
          {contract.read.length > 0 && (
            <div className={cn(LABEL, 'flex items-center px-5 pb-1 pt-4 md:px-6')}>Read</div>
          )}
          {contract.read.map((fn) => (
            <FunctionForm
              key={`r-${fn.name}-${fn.inputs.length}`}
              fn={fn}
              mode="read"
              onRun={(args) => read(fn, args)}
            />
          ))}
          {contract.write.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-1 pt-4 md:px-6">
              <span className={LABEL}>Write</span>
              {!signer && needs && (
                <StateMark tone="warn" title={NEED_TEXT[needs]}>
                  {SEND_NEED[needs]}
                </StateMark>
              )}
            </div>
          )}
          {contract.write.map((fn) => (
            <FunctionForm
              key={`w-${fn.name}-${fn.inputs.length}`}
              fn={fn}
              mode="write"
              blocked={!signer}
              onRun={(args, value) => write(fn, args, value)}
            />
          ))}
        </>
      )}
    </Board>
  );
}

type VerifyState = {
  stepId: string;
  status: 'verified' | 'unverified' | 'unsupported' | 'artifact';
  match?: string;
  reason?: string;
};

const VERIFY_LABEL: Record<VerifyState['status'], { text: string; tone: 'good' | 'warn' | 'neutral' }> = {
  verified: { text: 'Verified', tone: 'good' },
  unverified: { text: 'Not verified', tone: 'warn' },
  unsupported: { text: 'Verify elsewhere', tone: 'neutral' },
  artifact: { text: 'Published artifact', tone: 'good' },
};

/** Source verification on the Builder Hub verifier, the one the explorer reads, for every contract a deployment created. */
function VerifySection({ projectId, view }: { projectId: string; view: DeploymentView }) {
  const base = `/api/studio/projects/${projectId}/deployments/${view.id}/verify`;
  const [states, setStates] = useState<VerifyState[] | null>(null);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = () =>
    api<{ contracts: VerifyState[] }>(base)
      .then((r) => setStates(r.contracts))
      .catch((e) => setErrors((prev) => ({ ...prev, _: errorText(e) })));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const verify = async (stepId: string) => {
    setBusy((b) => ({ ...b, [stepId]: 'Submitting…' }));
    setErrors(({ [stepId]: _gone, ...rest }) => rest);
    try {
      const started = await api<{ status: string; jobId?: string }>(base, { method: 'POST', json: { stepId } });
      if (started.jobId) {
        setBusy((b) => ({ ...b, [stepId]: 'Compiling and matching bytecode…' }));
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 3_000));
          const { job } = await api<{ job: { status: string; error: string | null } }>(
            `${base}?jobId=${encodeURIComponent(started.jobId)}`,
          );
          if (job.status === 'succeeded') break;
          if (job.status === 'failed') throw new Error(job.error ?? 'Verification failed');
        }
      }
      await load();
    } catch (e) {
      setErrors((prev) => ({ ...prev, [stepId]: errorText(e) }));
    } finally {
      setBusy(({ [stepId]: _done, ...rest }) => rest);
    }
  };

  if (view.deployed.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader label="Verify" />
      <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Verify each contract&apos;s source so the explorer shows its code and ABI.
      </p>
      {errors._ && <Notice tone="bad">{errors._}</Notice>}
      <Board className="border-t border-zinc-200 dark:border-zinc-800">
        {view.deployed.map((d) => {
          const state = states?.find((s) => s.stepId === d.stepId);
          const label = state ? VERIFY_LABEL[state.status] : null;
          return (
            <div key={d.stepId} className="flex flex-col gap-2 px-5 py-3 md:px-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block truncate text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">
                    {d.contract}
                  </span>
                  <span className={cn(MUTED, 'block truncate text-[11px]')}>
                    {d.file ?? ((d.chainId !== null && view.chains[d.chainId]?.name) || d.network)}
                  </span>
                </span>
                <span className="flex min-h-8 shrink-0 items-center gap-3">
                  <Handoff
                    ready={label !== null}
                    skeleton={
                      <span role="status" aria-label="Checking verification">
                        <Bone className={cn(BONE, 'h-3 w-24')} />
                      </span>
                    }
                  >
                    {label && (
                      <StateMark tone={label.tone}>
                        {label.text}
                        {state?.status === 'verified' && state.match === 'exact_match' ? ' · exact' : ''}
                      </StateMark>
                    )}
                  </Handoff>
                  {state?.status === 'unverified' && (
                    <Button variant="secondary" busy={!!busy[d.stepId]} onClick={() => void verify(d.stepId)}>
                      Verify
                    </Button>
                  )}
                  {d.source === 'build' && (
                    <Button
                      variant="ghost"
                      className="px-2"
                      href={`${base}/input?stepId=${encodeURIComponent(d.stepId)}`}
                    >
                      Standard JSON
                    </Button>
                  )}
                </span>
              </div>
              {busy[d.stepId] && <span className={cn(MUTED, 'text-[11px]')}>{busy[d.stepId]}</span>}
              {state?.reason && <span className={cn(MUTED, 'text-[11px]')}>{state.reason}</span>}
              {errors[d.stepId] && <Notice tone="bad">{errors[d.stepId]}</Notice>}
            </div>
          );
        })}
      </Board>
    </section>
  );
}

/** Two contract strips as bars, in the loaded strips' own box. */
function ContractsSkeleton() {
  return (
    <div role="status" aria-label="Loading contracts" className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <Board key={i} className="border-x border-t border-zinc-200 dark:border-zinc-800">
          <div className={CONTRACT_HEAD}>
            <span className="flex flex-col gap-2">
              <Bone className={cn(BONE, 'h-3.5 w-32')} delay={i * 0.12} />
              <Bone className={cn(BONE, 'h-2.5 w-24')} delay={i * 0.12 + 0.04} />
            </span>
            <span className="flex items-center gap-4">
              <Bone className={cn(BONE, 'h-3 w-28')} delay={i * 0.12 + 0.08} />
              <Bone className={cn(BONE, 'hidden h-2.5 w-20 sm:block')} delay={i * 0.12 + 0.08} />
            </span>
          </div>
        </Board>
      ))}
    </div>
  );
}

export function ContractsPanel({
  projectId,
  deploymentId,
  hasContracts = true,
  onOpenPlan,
}: {
  projectId: string;
  deploymentId: string | null;
  /** False when contracts/ holds no Solidity yet: the first step is then to write one, not to deploy. */
  hasContracts?: boolean;
  /** Opens the Plan tab; without it, the empty state hands the ask to the chat. */
  onOpenPlan?: () => void;
}) {
  const [view, setView] = useState<DeploymentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setView(null);
    setError(null);
    if (!deploymentId) return;
    api<{ deployment: DeploymentView }>(`/api/studio/projects/${projectId}/deployments/${deploymentId}`)
      .then((r) => setView(r.deployment))
      .catch((e) => setError(errorText(e)));
  }, [projectId, deploymentId]);

  const anyDeployed = view?.contracts.some((c) => c.address) ?? false;

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        label="Contracts"
        action={
          deploymentId && (
            <Handoff ready={view !== null} skeleton={null}>
              {view && (
                <span className={cn(MUTED, 'shrink-0 text-[11px]')}>
                  {view.stage} · <span className="hidden sm:inline">deployment </span>
                  <span className={idInk}>{view.id.slice(0, 8)}</span>
                </span>
              )}
            </Handoff>
          )
        }
      />
      {!deploymentId ? (
        hasContracts ? (
          <EmptyState
            icon={Boxes}
            title="No contracts deployed yet"
            action={
              onOpenPlan ? (
                <Button variant="secondary" onClick={onOpenPlan}>
                  Open Plan
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => referenceInChat('Plan a testnet deployment of my contracts.')}
                >
                  Ask Studio to plan one
                </Button>
              )
            }
          >
            Run a deployment to call its contracts here.
          </EmptyState>
        ) : (
          <EmptyState
            icon={FileCode2}
            title="No contracts yet"
            action={
              <Button variant="secondary" onClick={() => referenceInChat(WRITE_PROMPT)}>
                Ask Studio to write a contract
              </Button>
            }
          >
            Write a contract, then deploy it to call its functions here.
          </EmptyState>
        )
      ) : error ? (
        <Notice tone="bad">{error}</Notice>
      ) : (
        <Handoff ready={view !== null} skeleton={<ContractsSkeleton />} className="flex flex-col gap-6">
          {view && (
            <>
              {view.contracts.length === 0 ? (
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  This deployment has no functions to call.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {!anyDeployed && (
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                      Run this deployment in the Deploy tab to call its contracts.
                    </p>
                  )}
                  {view.contracts.map((c) => (
                    <ContractBoard
                      key={c.stepId}
                      projectId={projectId}
                      deploymentId={view.id}
                      contract={c}
                      chains={view.chains}
                    />
                  ))}
                </div>
              )}
              <VerifySection projectId={projectId} view={view} />
            </>
          )}
        </Handoff>
      )}
    </div>
  );
}
