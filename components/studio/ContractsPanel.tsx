'use client';

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { encodeFunctionData, type AbiFunction } from 'viem';
import { Board, EmptyRow, HashChip, MUTED, SectionHeader, fnInk, idInk } from '@/components/explorer-v2/ui';
import { NEED_TEXT, useConsoleSigner } from '@/lib/console-wallets/react';
import { cn } from '@/lib/utils';
import { parseAbiInput, placeholderFor, show } from './abi-input';
import { api, errorText, type DeploymentView } from './api';
import { studioSignerScope } from './useDeployRunner';
import { Button, INPUT, Notice, Pill } from './ui';
import { walletErrorText } from './wallet';

type Contract = DeploymentView['contracts'][number];

function FunctionForm({
  fn,
  mode,
  onRun,
}: {
  fn: AbiFunction;
  mode: 'read' | 'write';
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
        {payable && <Pill tone="warn">payable</Pill>}
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
        <Button variant={mode === 'read' ? 'secondary' : 'primary'} onClick={() => void run()} busy={busy}>
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

  return (
    <Board>
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
        className={cn(
          'flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-5 py-2 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/40',
          canToggle && 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {canToggle && (
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform', open && 'rotate-90')}
            />
          )}
          <span className="min-w-0 truncate font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            {contract.contract} · {contract.network}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {contract.address ? (
            <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <HashChip value={contract.address} href={contract.addressUrl ?? undefined} len={8} />
            </span>
          ) : (
            <Pill>not deployed</Pill>
          )}
          {canToggle && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {open ? 'Hide functions' : `Show functions (${count})`}
            </span>
          )}
        </span>
      </div>
      {!contract.address ? (
        <EmptyRow>Deploy this contract to use its functions.</EmptyRow>
      ) : !open ? null : (
        <>
          {contract.read.length > 0 && (
            <div className="flex items-center px-5 py-3 font-mono text-[10px] uppercase leading-none tracking-[0.16em] text-zinc-400 md:px-6">
              Read
            </div>
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
            <div className="flex items-center px-5 py-3 font-mono text-[10px] uppercase leading-none tracking-[0.16em] text-zinc-400 md:px-6">
              Write
            </div>
          )}
          {contract.write.map((fn) => (
            <FunctionForm
              key={`w-${fn.name}-${fn.inputs.length}`}
              fn={fn}
              mode="write"
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

const VERIFY_LABEL: Record<VerifyState['status'], { text: string; tone: 'good' | 'warn' | 'neutral' | 'info' }> = {
  verified: { text: 'verified', tone: 'good' },
  unverified: { text: 'not verified', tone: 'warn' },
  unsupported: { text: 'verify elsewhere', tone: 'neutral' },
  artifact: { text: 'published artifact', tone: 'info' },
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
      <p className={cn(MUTED, 'text-[12px]')}>
        Publishes each contract&apos;s source on the Builder Hub verifier, so the explorer shows its code and ABI.
        Studio submits the exact sources and settings the deployment&apos;s build compiled.
      </p>
      {errors._ && <Notice tone="bad">{errors._}</Notice>}
      <Board>
        {view.deployed.map((d) => {
          const state = states?.find((s) => s.stepId === d.stepId);
          const label = state ? VERIFY_LABEL[state.status] : null;
          return (
            <div key={d.stepId} className="flex flex-col gap-2 px-5 py-3 md:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">
                    {d.contract}
                  </span>
                  <span className={cn(MUTED, 'block text-[11px]')}>
                    {d.network}
                    {d.file ? ` · ${d.file}` : ''}
                  </span>
                </span>
                <HashChip value={d.address} href={d.addressUrl ?? undefined} len={6} />
                {label ? (
                  <Pill tone={label.tone}>
                    {label.text}
                    {state?.status === 'verified' && state.match === 'exact_match' ? ' · exact' : ''}
                  </Pill>
                ) : (
                  <Pill>checking</Pill>
                )}
                {state?.status === 'unverified' && (
                  <Button busy={!!busy[d.stepId]} onClick={() => void verify(d.stepId)}>
                    Verify
                  </Button>
                )}
                {d.source === 'build' && (
                  <Button href={`${base}/input?stepId=${encodeURIComponent(d.stepId)}`}>Standard JSON</Button>
                )}
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

export function ContractsPanel({ projectId, deploymentId }: { projectId: string; deploymentId: string | null }) {
  const [view, setView] = useState<DeploymentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setView(null);
    if (!deploymentId) return;
    api<{ deployment: DeploymentView }>(`/api/studio/projects/${projectId}/deployments/${deploymentId}`)
      .then((r) => setView(r.deployment))
      .catch((e) => setError(errorText(e)));
  }, [projectId, deploymentId]);

  if (!deploymentId)
    return <Notice>Deploy a blueprint first; its contracts show up here with their read and write functions.</Notice>;
  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!view) return <EmptyRow>Loading contracts…</EmptyRow>;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        label={`Contracts · ${view.stage}`}
        action={
          <span className={cn(MUTED, 'text-[11px]')}>
            deployment <span className={idInk}>{view.id.slice(0, 8)}</span>
          </span>
        }
      />
      {view.contracts.length === 0 ? (
        <Notice>This blueprint has no panel functions.</Notice>
      ) : (
        view.contracts.map((c) => (
          <ContractBoard
            key={c.stepId}
            projectId={projectId}
            deploymentId={view.id}
            contract={c}
            chains={view.chains}
          />
        ))
      )}
      <VerifySection projectId={projectId} view={view} />
    </div>
  );
}
