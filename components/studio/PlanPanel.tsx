'use client';

import { useEffect, useRef, useState } from 'react';
import { Blocks, Check, ChevronRight, MessageSquare } from 'lucide-react';
import { Board, INK, MUTED, SectionHeader, idInk } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { api, errorText, planDeployment, type BlueprintCard, type DeploymentView, type ProjectOverview } from './api';
import { Arrive, Dot, StatusMark, StudioWalletStep, useFadeIn, useStudioFunding } from './StudioWalletStep';
import {
  Appear,
  Bone,
  Button,
  EmptyState,
  INPUT,
  LABEL,
  Notice,
  Pill,
  STATUS_TONE,
  shortId,
  timeAgo,
  type Tone,
} from './ui';

type Step = DeploymentView['steps'][number];

const shownDefault = (value: unknown, signer = 'your wallet') =>
  value === '$ctx.builder' || value === '$ctx.deployer'
    ? signer
    : value === null || value === undefined
      ? ''
      : String(value);

const OUT_REF = /\$out\.([\w-]+)\.(\w+)/g;

/** A step argument as the builder reads it: an output that is not known yet is named after the step that makes it. */
function shownArg(value: unknown, signer: string, steps: Step[]) {
  return shownDefault(value, signer).replace(OUT_REF, (ref, id: string, field: string) => {
    const step = steps.find((s) => s.id === id);
    if (!step) return ref;
    return field === 'address' ? `the ${step.detail.contract ?? step.title} address` : `${field} from ${step.title}`;
  });
}

/** An example that points at another blueprint's output reads as a plain address, not as a template reference. */
function placeholderOf(param: BlueprintCard['params'][number], signer: string) {
  const required = param.default === null;
  const example = param.example;
  if (required && typeof example === 'string' && example.startsWith('$out.'))
    return param.type === 'address' ? '0x…' : '';
  return required ? shownDefault(example, signer) : `default: ${shownDefault(param.default, signer)}`;
}

/** Text with `code` spans, as blueprint descriptions write them. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) =>
        i % 2 ? (
          <code key={i} className="font-mono text-[0.92em] text-zinc-800 dark:text-zinc-200">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** A plan's state in the builder's words: amber while it waits on them, emerald once it is deployed. */
const PLAN_STATUS: Record<string, [Tone, string]> = {
  proposed: ['warn', 'Not deployed'],
  running: ['warn', 'In progress'],
  succeeded: ['good', 'Deployed'],
  failed: ['bad', 'Failed'],
  cancelled: ['neutral', 'Cancelled'],
};
const planStatus = (status: string): [Tone, string] =>
  PLAN_STATUS[status] ?? [STATUS_TONE[status] ?? 'neutral', status];

/** Plans already read in this session, so coming back to the tab shows the plan at once while it refreshes. */
const viewCache = new Map<string, DeploymentView>();

const DISCLOSURE =
  'inline-flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';
const SUMMARY = cn(DISCLOSURE, 'cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden');
const BODY = 'max-w-prose text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400';
const NOTE = 'text-[12.5px] leading-snug text-zinc-500 dark:text-zinc-400';
const DESC = 'text-[12px] leading-snug text-zinc-500 dark:text-zinc-400';
const TAG = 'font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500';
const TEXT_ACTION =
  'font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-50';
const COMPACT_SELECT = cn(INPUT, 'h-7 w-auto max-w-64 py-0 text-[11px]');
const TITLE = 'min-w-0 text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50';

/** What to have ready before a step: a short list, marked with small squares. */
function Checklist({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>{label}</span>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13px] leading-snug text-zinc-700 dark:text-zinc-300">
            <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 bg-zinc-400 dark:bg-zinc-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParamField({
  param,
  value,
  onChange,
  signer,
}: {
  param: BlueprintCard['params'][number];
  value: string;
  onChange: (value: string) => void;
  signer: string;
}) {
  const required = param.default === null;
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
          {param.name}
        </span>
        {required && (
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {!value && <Dot tone="warn" />}
            required
          </span>
        )}
      </span>
      {param.type === 'bool' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
          <option value="">default ({shownDefault(param.default, signer)})</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholderOf(param, signer)}
          className={INPUT}
        />
      )}
      {param.description && <span className={DESC}>{param.description}</span>}
    </label>
  );
}

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

  const field = (p: BlueprintCard['params'][number]) => (
    <ParamField
      key={p.name}
      param={p}
      value={values[p.name] ?? ''}
      onChange={(value) => onChange(p.name, value)}
      signer={signer}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <span className={LABEL}>Parameters</span>
      {required.length > 0 && <div className="grid gap-x-4 gap-y-4 @xl:grid-cols-2">{required.map(field)}</div>}
      {optional.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={DISCLOSURE}>
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
            {optional.length} option{optional.length === 1 ? '' : 's'} with defaults
            {changed > 0 && <span className="text-zinc-900 dark:text-zinc-100">· {changed} changed</span>}
          </button>
          {open && <Appear className="grid gap-x-4 gap-y-4 @xl:grid-cols-2">{optional.map(field)}</Appear>}
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

/** What a blueprint needs before it is planned, with how it works folded away. */
function BlueprintIntro({ blueprint }: { blueprint: BlueprintCard }) {
  const contracts = blueprint.contracts.length;
  return (
    <div className="flex flex-col gap-4">
      <Checklist label="Before you plan" items={blueprint.prerequisites} />
      <details className="group">
        <summary className={SUMMARY}>
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
          How it works · {blueprint.outline.length} steps
          {contracts > 0 && (
            <span className="hidden @md:inline">{` · ${contracts} contract${contracts === 1 ? '' : 's'}`}</span>
          )}
        </summary>
        <div className="mt-3 flex flex-col gap-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
          <p className={BODY}>
            <Prose text={blueprint.description} />
          </p>
          <ol className="flex flex-col gap-1.5">
            {blueprint.outline.map((s, i) => (
              <li
                key={`${i}-${s.title}`}
                className="flex items-baseline gap-3 text-[13px] text-zinc-700 dark:text-zinc-300"
              >
                <span className="w-5 shrink-0 font-mono text-[10px] text-zinc-400">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  {s.title}
                  {s.optional && <span className={cn(TAG, 'ml-2')}>optional</span>}
                </span>
                <span className={cn(TAG, 'hidden shrink-0 @lg:inline')}>
                  {s.kind} · {s.role}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </div>
  );
}

/** The form's shape while the blueprint cards load: title and summary, the checklist, the fields and the button. */
function FormSkeleton() {
  return (
    <div role="status" aria-label="Loading the blueprint" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5 py-0.5">
        <Bone className="h-5 w-56" />
        <Bone className="h-3 w-72 max-w-full" delay={0.04} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          <Bone className="h-2.5 w-24" delay={0.08} />
          <Bone className="h-3 w-full max-w-lg" delay={0.1} />
          <Bone className="h-3 w-2/3 max-w-md" delay={0.12} />
        </div>
        <Bone className="h-3 w-48" delay={0.14} />
      </div>
      <div className="flex flex-col gap-4">
        <Bone className="h-2.5 w-20" delay={0.16} />
        <div className="grid gap-4 @xl:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Bone className="h-3 w-28" delay={0.18 + i * 0.04} />
              <Bone className="h-8" delay={0.2 + i * 0.04} />
              <Bone className="h-2.5 w-3/4" delay={0.22 + i * 0.04} />
            </div>
          ))}
        </div>
        <Bone className="h-3 w-44" delay={0.28} />
      </div>
      <Bone className="h-8 w-36" delay={0.3} />
    </div>
  );
}

/** The plan's shape while it loads: the heading block, then a section of rows. */
function PlanSkeleton() {
  return (
    <div role="status" aria-label="Loading the plan" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <Bone className="h-5 w-40" />
            <span className="flex-1" />
            <Bone className="h-3 w-24" delay={0.04} />
          </div>
          <Bone className="h-2.5 w-56" delay={0.08} />
        </div>
        <Bone className="h-3 w-full max-w-md" delay={0.12} />
        <div className="flex flex-col gap-2.5">
          <Bone className="h-2.5 w-28" delay={0.14} />
          <Bone className="h-3 w-2/3 max-w-sm" delay={0.16} />
          <Bone className="h-3 w-1/2 max-w-xs" delay={0.18} />
        </div>
        <Bone className="h-8 w-36" delay={0.2} />
      </div>
      <div className="flex flex-col gap-3">
        <Bone className="h-3 w-24" delay={0.24} />
        <div className="flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Bone className="h-2.5 w-20 shrink-0" delay={0.28 + i * 0.04} />
              <Bone className="h-2.5 w-48" delay={0.28 + i * 0.04} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The contract call a step makes; offchain and wait steps are described by their title alone. */
function stepCall(step: Step, signer: string, steps: Step[]): string | null {
  const d = step.detail;
  const arg = (a: unknown) => shownArg(a, signer, steps);
  const args = d.args.map(arg).join(', ');
  switch (step.kind) {
    case 'deploy':
      return `deploy ${d.contract}(${args})`;
    case 'call':
    case 'read':
      return `${d.contract}.${d.function}(${args})${d.value ? ` value ${arg(d.value)}` : ''}${d.target ? ` at ${arg(d.target)}` : ''}`;
    default:
      return null;
  }
}

const listed = (items: string[], max = 4) =>
  items.length > max ? `${items.slice(0, max).join(', ')} +${items.length - max} more` : items.join(', ');

const stepNumber = (i: number) => String(i + 1).padStart(2, '0');

/** The step's mark in the number column: a check once done, a dot when it failed, was skipped or is on its way. */
function StepMark({ step, index }: { step: Step; index: number }) {
  const status = step.state?.status;
  if (status === 'done')
    return <Check aria-label="Done" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (status === 'failed') return <Dot tone="bad" className="ml-1" />;
  if (status === 'sent') return <Dot tone="warn" className="ml-1" />;
  if (status === 'skipped') return <Dot tone="neutral" className="ml-1" />;
  return <>{stepNumber(index)}</>;
}

const skippedText = (reason?: string) =>
  !reason ? 'Skipped.' : /^skipped/i.test(reason) ? `${reason}.` : `Skipped: ${reason}.`;

function PlanDetails({
  view,
  blueprints,
  onOpenDeploy,
  onPlanAgain,
  signer,
  signing,
  quiet,
}: {
  view: DeploymentView;
  blueprints: BlueprintCard[];
  onOpenDeploy: () => void;
  /** Opens the form with this plan's values; absent when the project has no blueprint to plan from. */
  onPlanAgain?: () => void;
  signer: string;
  /** How the chosen wallet signs, or null while none is chosen. */
  signing: 'popups' | 'console' | null;
  /** Another plan is being made below, so that form holds the pane's one primary action. */
  quiet: boolean;
}) {
  const card = blueprints.find((b) => b.id === view.blueprintId);
  const networkName = (role: string, key: string) =>
    card?.networks[role]?.allowed.find((a) => a.key === key)?.name ?? key;
  const [tone, word] = planStatus(view.status);
  const settled = view.status === 'succeeded' || view.status === 'failed' || view.status === 'cancelled';
  const failedAt = view.steps.findIndex((s) => s.state?.status === 'failed');
  const failedStep = failedAt >= 0 ? view.steps[failedAt] : undefined;
  const failedCheck = view.checks.find((c) => !c.passed);
  const checkResult = (c: { description: string; after: string }) =>
    view.checks.findLast((r) => r.description === c.description && r.after === c.after);

  const problem = failedStep
    ? `Step ${failedAt + 1} failed: ${failedStep.state?.error ?? 'its transaction did not go through.'}`
    : view.status === 'failed' && failedCheck
      ? `A check failed: ${failedCheck.description}.`
      : null;
  const hint = problem
    ? null
    : view.status === 'proposed'
      ? signing === null
        ? 'Choose a signing wallet above first.'
        : signing === 'popups'
          ? 'Your wallet asks you to sign each step there.'
          : 'Your Console wallet signs each step there, without popups.'
      : view.status === 'running'
        ? 'It picks up from the last step that finished.'
        : null;
  const planAgain = view.status === 'failed' && onPlanAgain && !quiet;
  const deployLabel =
    view.status === 'proposed' ? 'Go to Deploy' : view.status === 'running' ? 'Continue in Deploy' : 'Open in Deploy';
  const deployPrimary =
    !quiet && !planAgain && (view.status === 'proposed' || view.status === 'running' || view.status === 'failed');
  const about = view.plan.description || view.plan.review.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className={TITLE}>{view.plan.title}</h3>
            {view.stage === 'production' && <Pill tone="prod">production</Pill>}
            <span className="flex-1" />
            <StatusMark tone={tone}>{word}</StatusMark>
          </div>
          <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {view.id.slice(0, 8)} · planned {timeAgo(view.createdAt)}
            {view.signer && ` · signer ${shortId(view.signer)}`}
          </p>
        </div>
        {card?.summary && <p className={BODY}>{card.summary}</p>}
        {problem && <Notice tone="bad">{problem}</Notice>}
        {!settled && <Checklist label="Before you deploy" items={view.plan.prerequisites} />}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {planAgain && <Button onClick={onPlanAgain}>Plan again</Button>}
          <Button variant={deployPrimary ? 'primary' : 'secondary'} onClick={onOpenDeploy}>
            {deployLabel}
          </Button>
          {hint && <span className={NOTE}>{hint}</span>}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeader label="Networks" />
        <Board>
          {Object.entries(view.networks).map(([role, key]) => (
            <div key={role} className="flex items-baseline gap-4 px-5 py-2.5 md:px-6">
              <span className="w-16 shrink-0 truncate font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 @lg:w-24 dark:text-zinc-400">
                {role}
              </span>
              <span className={cn(INK, 'min-w-0 flex-1 @lg:truncate')}>{networkName(role, key)}</span>
            </div>
          ))}
        </Board>
      </section>

      {view.plan.params.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader label="Parameters" />
          <Board>
            {view.plan.params.map((p) => {
              const source =
                p.source === 'missing' ? (
                  <StatusMark tone="warn">Missing</StatusMark>
                ) : p.source !== 'set' ? (
                  <span className={cn(TAG, 'shrink-0 tracking-[0.14em]')}>{p.source}</span>
                ) : null;
              return (
                <div
                  key={p.name}
                  className="flex flex-col gap-1 px-5 py-2.5 md:px-6 @lg:flex-row @lg:items-start @lg:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-2 @lg:w-32 @lg:shrink-0 @lg:pt-px">
                    <span className="truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{p.name}</span>
                    {source && <span className="@lg:hidden">{source}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        INK,
                        'block [overflow-wrap:anywhere] @lg:truncate',
                        p.value === null && 'text-zinc-400 dark:text-zinc-500',
                      )}
                      title={p.value ?? undefined}
                    >
                      {p.value === null ? 'not set' : shownDefault(p.value, signer)}
                    </span>
                    <span className={cn(DESC, 'block')}>{p.description}</span>
                  </span>
                  {source && <span className="hidden shrink-0 @lg:inline-flex">{source}</span>}
                </div>
              );
            })}
          </Board>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader label={`Steps · ${view.steps.length}`} />
        <Board>
          {view.steps.map((step, i) => {
            const call = stepCall(step, signer, view.steps);
            const status = step.state?.status;
            return (
              <div key={step.id} className="flex items-start gap-3 px-5 py-3 md:px-6">
                <span className="flex h-5 w-5 shrink-0 items-center font-mono text-[10px] text-zinc-400">
                  <StepMark step={step} index={i} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-[13px] leading-5',
                      status === 'skipped' ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-50',
                    )}
                  >
                    {step.title}
                    {step.optional && <span className={cn(TAG, 'ml-2')}>optional</span>}
                  </span>
                  {status === 'failed' && step.state?.error && (
                    <span className="block text-[12px] leading-snug text-red-700 dark:text-red-300">
                      {step.state.error}
                    </span>
                  )}
                  {status === 'skipped' && <span className={cn(DESC, 'block')}>{skippedText(step.state?.reason)}</span>}
                  {status === 'done' && step.state?.warning && (
                    <span className="flex items-center gap-2 text-[12px] leading-snug text-zinc-600 dark:text-zinc-300">
                      <Dot tone="warn" />
                      {step.state.warning}
                    </span>
                  )}
                  <span className={cn(MUTED, 'block text-[11px]')}>
                    {step.kind} · {networkName(step.role, step.network)}
                  </span>
                  {call && (
                    <span className="mt-1 block font-mono text-[11.5px] text-zinc-700 [overflow-wrap:anywhere] dark:text-zinc-300">
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
                  {step.detail.notes && <span className={cn(DESC, 'mt-0.5 block')}>{step.detail.notes}</span>}
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
              <div key={c.name} className="flex flex-col gap-0.5 px-5 py-2.5 md:px-6">
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className={cn(INK, 'min-w-0 truncate')}>{c.name}</span>
                  <Pill tone={c.audited ? 'good' : 'neutral'}>
                    {c.audited ? 'audited artifact' : 'built for this project'}
                  </Pill>
                </span>
                <span className={cn(DESC, 'block')}>{c.description}</span>
              </div>
            ))}
            {view.plan.checks.map((c) => {
              const result = checkResult(c);
              return (
                <div key={`${c.after}-${c.description}`} className="flex items-center gap-3 px-5 py-2.5 md:px-6">
                  <Pill>check</Pill>
                  <span className="min-w-0 flex-1 text-[13px] text-zinc-800 dark:text-zinc-200">{c.description}</span>
                  {result ? (
                    <StatusMark tone={result.passed ? 'good' : 'bad'}>{result.passed ? 'Passed' : 'Failed'}</StatusMark>
                  ) : (
                    <span className={cn(MUTED, 'hidden shrink-0 text-[11px] @lg:inline')}>after {c.after}</span>
                  )}
                </div>
              );
            })}
          </Board>
        </section>
      )}

      {about && (
        <details className="group">
          <summary className={SUMMARY}>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            How this plan works
            {view.plan.review.length > 0 &&
              ` · ${view.plan.review.length} check${view.plan.review.length === 1 ? '' : 's'}`}
          </summary>
          <div className="mt-3 flex flex-col gap-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
            {view.plan.description && (
              <p className={BODY}>
                <Prose text={view.plan.description} />
              </p>
            )}
            {view.plan.review.length > 0 && (
              <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                {view.plan.review.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/** The chat sits beside this pane (above it on a phone); its composer is the way to a blueprint. */
const focusChat = () => document.querySelector<HTMLTextAreaElement>('aside textarea')?.focus();

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
  const [view, setView] = useState<DeploymentView | null>(() =>
    selectedId ? (viewCache.get(selectedId) ?? null) : null,
  );
  const [viewError, setViewError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const touched = useRef(new Set<string>());
  const blueprint = blueprints.find((b) => b.id === blueprintId);
  const titleOf = (id: string | null) => blueprints.find((b) => b.id === id)?.title ?? id ?? 'Your contracts';
  const savedParams = JSON.stringify(project.params ?? {});
  const selectedStatus = overview.deployments.find((d) => d.id === selectedId)?.status;
  const noBlueprint = project.blueprint_ids.length === 0;
  // The workspace passes an empty list until the cards arrive; a project with blueprints waits for them.
  const blueprintsLoading = !noBlueprint && blueprints.length === 0;

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

  // The plan as the server resolved it; refetched when the deployment moves on. The plan on screen stays,
  // dimmed, until the next one arrives, so switching plans does not collapse the pane.
  useEffect(() => {
    if (!selectedId) {
      setView(null);
      return;
    }
    let cancelled = false;
    setViewError(null);
    const cached = viewCache.get(selectedId);
    if (cached) setView(cached);
    api<{ deployment: DeploymentView }>(`/api/studio/projects/${project.id}/deployments/${selectedId}`)
      .then((r) => {
        viewCache.set(r.deployment.id, r.deployment);
        if (!cancelled) setView(r.deployment);
      })
      .catch((e) => !cancelled && setViewError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [project.id, selectedId, selectedStatus, retry]);

  const [formOpen, setFormOpen] = useState(false);
  const hasPlan = !!selectedId;
  const showForm = !hasPlan || formOpen;
  const viewReady = !!view && view.id === selectedId;
  const stale = !!view && !viewReady;
  const shownView = viewError && stale ? null : view;
  const planFade = useFadeIn(hasPlan && !view && !viewError);
  const formFade = useFadeIn(blueprintsLoading);

  // While planning, the wallet is checked against the blueprint's work; otherwise against the open plan's.
  const shownPlan = !showForm ? shownView : null;
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

  // Why the button waits, in one line beside it; nothing while the wallets are still loading.
  const reason = !blueprint
    ? null
    : !signerState.ready
      ? null
      : !signerState.choice
        ? 'Choose a signing wallet first.'
        : !funding.checked
          ? 'Checking the wallet balance…'
          : needsFunds
            ? 'Fund the wallet first.'
            : null;

  const blueprintSelect = (className?: string) => (
    <select
      value={blueprintId}
      onChange={(e) => setBlueprintId(e.target.value)}
      aria-label="Blueprint"
      className={cn(COMPACT_SELECT, className)}
    >
      {project.blueprint_ids.map((id) => (
        <option key={id} value={id}>
          {titleOf(id)}
        </option>
      ))}
    </select>
  );
  const manyBlueprints = project.blueprint_ids.length > 1 && !blueprintsLoading;

  const form = (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label={hasPlan ? 'Plan another deployment' : 'Plan a testnet deployment'}
        action={
          manyBlueprints || hasPlan ? (
            <span className="flex shrink-0 items-center gap-4">
              {manyBlueprints && blueprintSelect('hidden @md:block')}
              {hasPlan && (
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className={cn(DISCLOSURE, 'tracking-[0.12em]')}
                >
                  Close
                </button>
              )}
            </span>
          ) : undefined
        }
      />
      {manyBlueprints && blueprintSelect('w-full max-w-none @md:hidden')}
      {blueprintsLoading ? (
        <FormSkeleton />
      ) : (
        <Arrive id={blueprintId} fade={formFade} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h3 className={TITLE}>{titleOf(blueprintId)}</h3>
            {blueprint && <p className={BODY}>{blueprint.summary}</p>}
            {hasPlan && <p className={NOTE}>The fields start from the current plan&apos;s values.</p>}
          </div>
          {blueprint ? (
            <>
              <BlueprintIntro blueprint={blueprint} />
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
            </>
          ) : (
            <Notice tone="bad">Studio can&apos;t find this blueprint. Ask in the chat for another one.</Notice>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              onClick={() => void propose()}
              busy={busy}
              disabled={!blueprint || !signerState.choice || needsFunds || !funding.checked}
            >
              {hasPlan ? 'Make a new plan' : 'Plan deployment'}
            </Button>
            {reason && (
              <span className={NOTE}>
                {reason}
                {needsFunds && (
                  <>
                    {' '}
                    <button type="button" onClick={() => setPlanUnfunded(true)} className={cn(TEXT_ACTION, 'ml-1')}>
                      Plan anyway
                    </button>
                  </>
                )}
              </span>
            )}
          </div>
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
        </Arrive>
      )}
    </section>
  );

  if (!hasPlan && noBlueprint)
    return (
      <EmptyState
        icon={Blocks}
        title="No blueprint yet"
        action={
          <Button variant="secondary" onClick={focusChat}>
            <MessageSquare className="h-3.5 w-3.5" /> Ask Studio
          </Button>
        }
      >
        Ask Studio in the chat to pick a blueprint, or to plan deploy steps for your own contracts.
      </EmptyState>
    );

  const walletStep = (
    <StudioWalletStep
      overview={overview}
      view={shownPlan}
      funding={funding}
      pending={hasPlan && !showForm && !view && !viewError}
    />
  );

  if (!hasPlan)
    return (
      <div className="@container flex flex-col gap-10">
        {walletStep}
        {form}
      </div>
    );

  const many = overview.deployments.length > 1;
  const planSelect = (className: string) => (
    <select
      value={selectedId ?? ''}
      onChange={(e) => onSelect(e.target.value)}
      aria-label="Choose a plan"
      className={cn(COMPACT_SELECT, className)}
    >
      {overview.deployments.map((d) => (
        <option key={d.id} value={d.id}>
          {titleOf(d.blueprint_id)} · {d.id.slice(0, 8)} · {planStatus(d.status)[1]}
        </option>
      ))}
    </select>
  );

  return (
    <div className="@container flex flex-col gap-10">
      {walletStep}
      <section className="flex flex-col gap-4">
        <SectionHeader
          label={many ? `Plans · ${overview.deployments.length}` : 'Your plan'}
          action={many ? planSelect('hidden max-w-80 @md:block') : undefined}
        />
        {many && planSelect('w-full max-w-none @md:hidden')}
        {viewError && (
          <Notice tone="bad">
            <span title={viewError}>Studio could not load this plan.</span>{' '}
            <button type="button" onClick={() => setRetry((n) => n + 1)} className={cn(TEXT_ACTION, 'ml-1')}>
              Retry
            </button>
          </Notice>
        )}
        {shownView ? (
          <div
            aria-busy={stale || undefined}
            className={cn('transition-opacity duration-200', stale && 'pointer-events-none opacity-60')}
          >
            <Arrive id="plan" fade={planFade}>
              <PlanDetails
                view={shownView}
                blueprints={blueprints}
                onOpenDeploy={onOpenDeploy}
                onPlanAgain={noBlueprint ? undefined : openForm}
                signer={signerLabel}
                signing={!signerState.choice ? null : signerState.wallet ? 'console' : 'popups'}
                quiet={formOpen}
              />
            </Arrive>
          </div>
        ) : (
          !viewError && <PlanSkeleton />
        )}
      </section>

      {showForm ? (
        form
      ) : !shownView ? null : noBlueprint ? (
        <p className={NOTE}>Ask Studio in the chat to plan another deployment.</p>
      ) : shownView.status === 'failed' ? null : (
        <div>
          <Button variant="secondary" onClick={openForm}>
            Plan another deployment
          </Button>
        </div>
      )}
    </div>
  );
}
