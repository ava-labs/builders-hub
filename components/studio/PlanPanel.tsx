'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Board, BoardHeader, EmptyRow, INK, MUTED, SectionHeader, idInk } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { api, errorText, planDeployment, type BlueprintCard, type DeploymentView, type ProjectOverview } from './api';
import { StudioWalletStep, useStudioFunding } from './StudioWalletStep';
import { Button, Field, INPUT, LABEL, Notice, Pill, STATUS_TONE, shortId } from './ui';

const shownDefault = (value: unknown, signer = 'your wallet') =>
  value === '$ctx.builder' || value === '$ctx.deployer'
    ? signer
    : value === null || value === undefined
      ? ''
      : String(value);

/** Required parameters up front; the ones with defaults fold away until the builder wants them. */
function ParamsForm({
  blueprint,
  values,
  onChange,
  signer,
}: {
  blueprint: BlueprintCard;
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  signer: string;
}) {
  const [open, setOpen] = useState(false);
  if (blueprint.params.length === 0) return null;
  const required = blueprint.params.filter((p) => p.default === null);
  const optional = blueprint.params.filter((p) => p.default !== null);
  const changed = optional.filter((p) => values[p.name]).length;

  const field = (p: BlueprintCard['params'][number]) => {
    const isRequired = p.default === null;
    return (
      <Field key={p.name} label={`${p.name}${isRequired ? ' · required' : ''}`} hint={p.description}>
        {p.type === 'bool' ? (
          <select value={values[p.name] ?? ''} onChange={(e) => onChange(p.name, e.target.value)} className={INPUT}>
            <option value="">default ({shownDefault(p.default, signer)})</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            value={values[p.name] ?? ''}
            onChange={(e) => onChange(p.name, e.target.value)}
            placeholder={isRequired ? shownDefault(p.example, signer) : `default: ${shownDefault(p.default, signer)}`}
            className={cn(INPUT, isRequired && !values[p.name] && 'border-amber-500 dark:border-amber-400')}
          />
        )}
      </Field>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {required.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{required.map(field)}</div>}
      {optional.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
            {optional.length} option{optional.length === 1 ? '' : 's'} with defaults
            {changed > 0 && <span className="text-zinc-900 dark:text-zinc-100">· {changed} changed</span>}
          </button>
          {open && <div className="grid gap-3 sm:grid-cols-2">{optional.map(field)}</div>}
        </>
      )}
    </div>
  );
}

function coerceParams(blueprint: BlueprintCard, values: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of blueprint.params) {
    const raw = values[p.name]?.trim();
    if (!raw) continue;
    out[p.name] = p.type === 'bool' ? raw === 'true' : raw;
  }
  return out;
}

/** What a blueprint does, before it is planned: its steps in order, what it deploys, and what it expects. */
function BlueprintPreview({ blueprint }: { blueprint: BlueprintCard }) {
  return (
    <div className="flex flex-col gap-3 border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">{blueprint.description}</p>
      {blueprint.prerequisites.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Before you plan</span>
          <ul className={cn(MUTED, 'flex list-disc flex-col gap-0.5 pl-4 text-[11.5px]')}>
            {blueprint.prerequisites.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <details>
        <summary className={cn(LABEL, 'cursor-pointer select-none')}>
          {blueprint.outline.length} steps · {blueprint.contracts.length} contract
          {blueprint.contracts.length === 1 ? '' : 's'}
        </summary>
        <ol className="mt-2 flex flex-col gap-1">
          {blueprint.outline.map((s, i) => (
            <li
              key={`${i}-${s.title}`}
              className="flex items-baseline gap-3 font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300"
            >
              <span className="w-5 shrink-0 text-[10px] text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                {s.title}
                {s.optional && <span className="ml-2 text-[10px] uppercase text-zinc-400">optional</span>}
              </span>
              <span className="shrink-0 text-[10px] uppercase text-zinc-400">
                {s.kind} · {s.role}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

/** The contract call a step makes; offchain and wait steps are described by their title alone. */
function stepCall(step: DeploymentView['steps'][number], signer: string): string | null {
  const d = step.detail;
  const args = d.args.map((a) => shownDefault(a, signer)).join(', ');
  switch (step.kind) {
    case 'deploy':
      return `deploy ${d.contract}(${args})`;
    case 'call':
    case 'read':
      return `${d.contract}.${d.function}(${args})${d.value ? ` value ${d.value}` : ''}${d.target ? ` at ${d.target}` : ''}`;
    default:
      return null;
  }
}

const listed = (items: string[], max = 4) =>
  items.length > max ? `${items.slice(0, max).join(', ')} +${items.length - max} more` : items.join(', ');

function PlanDetails({
  view,
  blueprints,
  onOpenDeploy,
  signer,
  popups,
}: {
  view: DeploymentView;
  blueprints: BlueprintCard[];
  onOpenDeploy: () => void;
  signer: string;
  popups: boolean;
}) {
  const card = blueprints.find((b) => b.id === view.blueprintId);
  const networkName = (role: string, key: string) =>
    card?.networks[role]?.allowed.find((a) => a.key === key)?.name ?? key;
  const settled = view.status === 'succeeded' || view.status === 'failed' || view.status === 'cancelled';

  return (
    <div className="flex flex-col gap-6">
      <Board>
        <BoardHeader
          label={`${view.plan.title} · ${view.id.slice(0, 8)}`}
          action={
            <span className="flex items-center gap-2">
              <Pill tone={view.stage === 'production' ? 'prod' : 'neutral'}>{view.stage}</Pill>
              <Pill tone={STATUS_TONE[view.status] ?? 'neutral'}>{view.status}</Pill>
            </span>
          }
        />
        <div className="flex flex-col gap-3 px-5 py-4 md:px-6">
          <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">{view.plan.description}</p>
          {view.plan.prerequisites.length > 0 && (
            <ul className={cn(MUTED, 'flex list-disc flex-col gap-0.5 pl-4 text-[11.5px]')}>
              {view.plan.prerequisites.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {view.status === 'proposed' && (
            <Notice>
              This plan is ready with the values below; you don&apos;t need to enter anything again. Press Go to Deploy
              to run it:{' '}
              {popups
                ? 'your wallet asks you to sign each transaction there'
                : `${signer} signs each transaction there without popups`}
              , and nothing is sent from this page.
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={settled ? 'secondary' : 'primary'} onClick={onOpenDeploy}>
              {settled ? 'Open in Deploy' : view.status === 'proposed' ? 'Go to Deploy' : 'Continue in Deploy'}
            </Button>
            {view.signer && <span className={cn(MUTED, 'text-[11px]')}>Signer {shortId(view.signer)}</span>}
          </div>
        </div>
      </Board>

      <section className="flex flex-col gap-3">
        <SectionHeader label="Networks" />
        <Board>
          {Object.entries(view.networks).map(([role, key]) => (
            <div key={role} className="flex items-center gap-4 px-5 py-2.5 md:px-6">
              <span className="w-24 shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                {role}
              </span>
              <span className={cn(INK, 'min-w-0 flex-1 truncate')}>{networkName(role, key)}</span>
            </div>
          ))}
        </Board>
      </section>

      {view.plan.params.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader label="Parameters" />
          <Board>
            {view.plan.params.map((p) => (
              <div key={p.name} className="flex items-start gap-4 px-5 py-2.5 md:px-6">
                <span className="w-32 shrink-0 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{p.name}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn(INK, 'block truncate')} title={p.value ?? undefined}>
                    {p.value === null ? '—' : shownDefault(p.value, signer)}
                  </span>
                  <span className={cn(MUTED, 'block text-[11px]')}>{p.description}</span>
                </span>
                {p.source !== 'set' && <Pill tone={p.source === 'missing' ? 'bad' : 'neutral'}>{p.source}</Pill>}
              </div>
            ))}
          </Board>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader label={`Steps · ${view.steps.length}`} />
        <Board>
          {view.steps.map((step, i) => {
            const call = stepCall(step, signer);
            return (
              <div key={step.id} className="flex items-start gap-3 px-5 py-3 md:px-6">
                <span className="w-5 shrink-0 pt-0.5 font-mono text-[10px] text-zinc-400">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-zinc-900 dark:text-zinc-50">
                    {step.title}
                    {step.optional && (
                      <span className="ml-2 font-mono text-[10px] uppercase text-zinc-400">optional</span>
                    )}
                  </span>
                  <span className={cn(MUTED, 'block text-[11px]')}>
                    {step.kind} · {networkName(step.role, step.network)}
                    {step.detail.signer ? ` · signed by the ${step.detail.signer}` : ''}
                  </span>
                  {call && (
                    <span className="mt-1 block break-all font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300">
                      {call}
                    </span>
                  )}
                  {step.detail.outputs.length > 0 && (
                    <span className={cn(MUTED, 'block text-[11px]')} title={step.detail.outputs.join(', ')}>
                      records {listed(step.detail.outputs)}
                    </span>
                  )}
                  {step.detail.skipIf && (
                    <span className={cn(MUTED, 'block text-[11px]')}>skipped when {step.detail.skipIf}</span>
                  )}
                  {step.detail.notes && <span className={cn(MUTED, 'block text-[11px]')}>{step.detail.notes}</span>}
                </span>
              </div>
            );
          })}
        </Board>
      </section>

      {(view.plan.contracts.length > 0 || view.plan.checks.length > 0) && (
        <section className="flex flex-col gap-3">
          <SectionHeader label="Contracts and checks" />
          <Board>
            {view.plan.contracts.map((c) => (
              <div key={c.name} className="flex items-start gap-3 px-5 py-2.5 md:px-6">
                <span className="min-w-0 flex-1">
                  <span className={cn(INK, 'block truncate')}>{c.name}</span>
                  <span className={cn(MUTED, 'block text-[11px]')}>{c.description}</span>
                </span>
                <Pill tone={c.audited ? 'good' : 'info'}>
                  {c.audited ? 'audited artifact' : 'built for this project'}
                </Pill>
              </div>
            ))}
            {view.plan.checks.map((c) => (
              <div key={`${c.after}-${c.description}`} className="flex items-baseline gap-3 px-5 py-2.5 md:px-6">
                <Pill>check</Pill>
                <span className="min-w-0 flex-1 text-[13px] text-zinc-800 dark:text-zinc-200">{c.description}</span>
                <span className={cn(MUTED, 'shrink-0 text-[11px]')}>after {c.after}</span>
              </div>
            ))}
          </Board>
        </section>
      )}

      {view.plan.review.length > 0 && (
        <details className="group">
          <summary className={cn(LABEL, 'flex cursor-pointer select-none items-center gap-1.5')}>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            What Studio checks in this plan · {view.plan.review.length}
          </summary>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            {view.plan.review.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function PlanPanel({
  overview,
  blueprints,
  selectedId,
  onSelect,
  onPlanned,
  onOpenDeploy,
  onOpenAudit,
}: {
  overview: ProjectOverview;
  blueprints: BlueprintCard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPlanned: (deploymentId: string, autoRun: boolean) => void;
  onOpenDeploy: () => void;
  onOpenAudit: () => void;
}) {
  const { project } = overview;
  const [blueprintId, setBlueprintId] = useState(project.blueprint_ids[0] ?? '');
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [view, setView] = useState<DeploymentView | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const touched = useRef(new Set<string>());
  const blueprint = blueprints.find((b) => b.id === blueprintId);
  const titleOf = (id: string | null) => blueprints.find((b) => b.id === id)?.title ?? id ?? 'Your contracts';
  const savedParams = JSON.stringify(project.params ?? {});
  const selectedStatus = overview.deployments.find((d) => d.id === selectedId)?.status;

  useEffect(() => {
    if (!blueprintId && project.blueprint_ids[0]) setBlueprintId(project.blueprint_ids[0]);
  }, [blueprintId, project.blueprint_ids]);

  // Saved parameters (the agent may set them) fill the form without overwriting what the builder is typing.
  useEffect(() => {
    const saved = JSON.parse(savedParams) as Record<string, unknown>;
    setValues((current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(saved)) {
        if (!touched.current.has(key)) next[key] = value === null || value === undefined ? '' : String(value);
      }
      return next;
    });
  }, [savedParams]);

  // The plan as the server resolved it; refetched when the deployment moves on.
  useEffect(() => {
    if (!selectedId) {
      setView(null);
      return;
    }
    let cancelled = false;
    setViewError(null);
    api<{ deployment: DeploymentView }>(`/api/studio/projects/${project.id}/deployments/${selectedId}`)
      .then((r) => !cancelled && setView(r.deployment))
      .catch((e) => !cancelled && setViewError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [project.id, selectedId, selectedStatus]);

  const [formOpen, setFormOpen] = useState(false);
  const hasPlan = !!selectedId;
  const showForm = !hasPlan || formOpen;

  // While planning, the wallet is checked against the blueprint's work; otherwise against the open plan's.
  const shownPlan = !showForm && view && view.id === selectedId ? view : null;
  const funding = useStudioFunding(overview, blueprint, shownPlan);
  const signerState = funding.signer;
  const signerLabel = signerState.wallet ? `your Console wallet ${shortId(signerState.wallet.address)}` : 'your wallet';
  const [planUnfunded, setPlanUnfunded] = useState(false);
  useEffect(() => setPlanUnfunded(false), [signerState.choice, blueprintId]);
  const needsFunds = showForm && funding.short.length > 0 && !planUnfunded;

  // Planning again starts from the current plan's values instead of empty fields.
  const openForm = () => {
    if (view) {
      if (view.blueprintId && project.blueprint_ids.includes(view.blueprintId)) setBlueprintId(view.blueprintId);
      setValues((current) => {
        const next = { ...current };
        for (const p of view.plan.params) {
          if (p.source === 'set' && p.value !== null && !touched.current.has(p.name)) next[p.name] = p.value;
        }
        return next;
      });
    }
    setFormOpen(true);
  };

  const propose = async () => {
    if (!blueprint) return;
    setBusy(true);
    setError(null);
    try {
      onPlanned(await planDeployment(project.id, blueprint.id, coerceParams(blueprint, values)), false);
      setFormOpen(false);
    } catch (e) {
      setError({ message: errorText(e), code: (e as { code?: string }).code });
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <section className="flex flex-col gap-3">
      <SectionHeader
        label={hasPlan ? 'Plan another deployment' : 'Plan a testnet deployment'}
        action={
          hasPlan ? (
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Close
            </button>
          ) : undefined
        }
      />
      {hasPlan && (
        <p className={cn(MUTED, 'text-[12px]')}>
          This makes a new plan next to the current one. The fields start from the current plan&apos;s values.
        </p>
      )}
      <Field label="Blueprint">
        <select value={blueprintId} onChange={(e) => setBlueprintId(e.target.value)} className={cn(INPUT, 'max-w-md')}>
          {project.blueprint_ids.length === 0 && <option value="">No blueprints yet</option>}
          {project.blueprint_ids.map((id) => (
            <option key={id} value={id}>
              {titleOf(id)}
            </option>
          ))}
        </select>
      </Field>
      {project.blueprint_ids.length === 0 && (
        <Notice>
          This project has no blueprint. Ask Studio in the chat to plan deploy steps for your own contracts: it writes
          the steps, the server checks each one against your latest build, and the plan appears here for you to review
          before your wallet signs anything.
        </Notice>
      )}
      {blueprint && <BlueprintPreview blueprint={blueprint} />}
      {blueprint && (
        <ParamsForm
          key={blueprint.id}
          blueprint={blueprint}
          values={values}
          signer={signerLabel}
          onChange={(name, value) => {
            touched.current.add(name);
            setValues((v) => ({ ...v, [name]: value }));
          }}
        />
      )}
      <div>
        <Button
          onClick={() => void propose()}
          busy={busy}
          disabled={!blueprint || !signerState.choice || needsFunds || !funding.checked}
        >
          {hasPlan ? 'Make a new plan' : 'Plan deployment'}
        </Button>
        {!signerState.choice && signerState.ready && (
          <span className={cn(MUTED, 'ml-3 text-[11.5px]')}>Choose the signing wallet in step 1 first.</span>
        )}
        {signerState.choice && !funding.checked && (
          <span className={cn(MUTED, 'ml-3 text-[11.5px]')}>Checking your Console wallet&apos;s balance…</span>
        )}
      </div>
      {needsFunds && (
        <Notice tone="warn">
          <span className="flex flex-col gap-2">
            <span>
              Fund your Console wallet first. It doesn&apos;t hold enough for this plan on{' '}
              {funding.short.map((c) => c.name).join(', ')}; step 1 above shows how to add funds, and this unlocks once
              the balance arrives.
            </span>
            <span>
              <button
                type="button"
                onClick={() => setPlanUnfunded(true)}
                className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
              >
                Plan anyway, I&apos;ll fund it before deploying
              </button>
            </span>
          </span>
        </Notice>
      )}
      {error && (
        <Notice tone="bad">
          {error.message}
          {error.code === 'audit_blocked' && (
            <>
              {' '}
              <button type="button" onClick={onOpenAudit} className={cn('underline', idInk)}>
                Open the audit
              </button>
            </>
          )}
        </Notice>
      )}
    </section>
  );

  const walletStep = <StudioWalletStep overview={overview} view={shownPlan} funding={funding} />;

  if (!hasPlan)
    return (
      <div className="flex flex-col gap-8">
        {walletStep}
        {form}
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      {walletStep}
      <section className="flex flex-col gap-3">
        <SectionHeader
          label="Your plan"
          action={
            overview.deployments.length > 1 ? (
              <select
                value={selectedId ?? ''}
                onChange={(e) => onSelect(e.target.value)}
                aria-label="Choose a plan"
                className={cn(INPUT, 'h-7 w-auto max-w-64 py-0 text-[11px]')}
              >
                {overview.deployments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {titleOf(d.blueprint_id)} · {d.id.slice(0, 8)} · {d.status}
                  </option>
                ))}
              </select>
            ) : undefined
          }
        />
        {viewError ? (
          <Notice tone="bad">{viewError}</Notice>
        ) : !view ? (
          <Board>
            <EmptyRow>Loading the plan…</EmptyRow>
          </Board>
        ) : (
          <PlanDetails
            view={view}
            blueprints={blueprints}
            onOpenDeploy={onOpenDeploy}
            signer={signerLabel}
            popups={signerState.wallet === undefined}
          />
        )}
      </section>

      {showForm ? (
        form
      ) : (
        <div>
          <Button variant="secondary" onClick={openForm} disabled={project.blueprint_ids.length === 0}>
            Plan another deployment
          </Button>
        </div>
      )}
    </div>
  );
}
