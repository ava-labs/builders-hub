'use client';

import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HashChip, SpecPlate } from '@/components/explorer-v2/ui';
import { Button } from '@/components/toolbox/components/Button';
import { EYEBROW } from '../shared/ui';

export const BODY = 'text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400';
export const MONO = 'font-mono text-[12px] text-zinc-900 dark:text-zinc-100';

/** The deploy wizard's left pane matches the source viewer beside it. */
export const PANE_HEIGHT = 500;

/** Eyebrow label on a hairline rule, with an optional reading at the right edge. */
export function PaneSection({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-h-5 items-center gap-3">
        <p className={cn(EYEBROW, 'shrink-0')}>{label}</p>
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        {action}
      </div>
      {children}
    </section>
  );
}

export type DeployStatus = 'idle' | 'active' | 'done' | 'blocked';

const STATUS_LABEL: Record<DeployStatus, string> = {
  idle: 'Not deployed',
  active: 'Deploying',
  done: 'Deployed',
  blocked: 'Waiting',
};

export function StatusDot({ status }: { status: DeployStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        status === 'done' && 'bg-emerald-500 dark:bg-emerald-400',
        status === 'active' && 'animate-pulse bg-[#E6212F]',
        status === 'idle' && 'border border-zinc-400 dark:border-zinc-500',
        status === 'blocked' && 'border border-dashed border-zinc-300 dark:border-zinc-700',
      )}
    />
  );
}

/** Dot plus a mono status word. */
export function StatusTag({ status, label }: { status: DeployStatus; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]',
        status === 'done'
          ? 'text-emerald-700 dark:text-emerald-400'
          : status === 'active'
            ? 'text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-400 dark:text-zinc-500',
      )}
    >
      <StatusDot status={status} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

/** Spinner and a mono caption for a transaction in flight. */
export function WorkingCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400" role="status">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      {children}
    </p>
  );
}

/** A value an earlier step must supply, shown as missing until it exists. */
export function Missing({ children = 'Missing' }: { children?: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
      {children}
    </span>
  );
}

/** A choice with an icon and a description, in a hairline grid; the chosen one is outlined in ink. */
export function Option({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group/opt relative flex flex-col gap-3 bg-white p-4 text-left dark:bg-zinc-950',
        selected && 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center border transition-colors',
            selected
              ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
              : 'border-zinc-200 text-zinc-500 group-hover/opt:border-zinc-500 group-hover/opt:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:group-hover/opt:border-zinc-500 dark:group-hover/opt:text-zinc-100',
          )}
        >
          {icon}
        </span>
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
      <span className="text-[14px] font-semibold text-zinc-900 decoration-zinc-400 underline-offset-4 group-hover/opt:underline dark:text-zinc-50">
        {title}
      </span>
      <span className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</span>
    </button>
  );
}

/** Hairline frame around a key/value plate. */
export function Plate({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 px-4 dark:border-zinc-800">
      <SpecPlate>{children}</SpecPlate>
    </div>
  );
}

/**
 * One contract to deploy: status bar, name and purpose, the constructor inputs it takes, then the deploy action or,
 * once deployed, its address with a redeploy control.
 */
export function ContractCard({
  name,
  description,
  address,
  deploying,
  blocked,
  inputs,
  action,
  onRedeploy,
}: {
  name: string;
  description: React.ReactNode;
  address: string;
  deploying: boolean;
  blocked?: boolean;
  inputs?: React.ReactNode;
  action: React.ReactNode;
  onRedeploy: () => void;
}) {
  const status: DeployStatus = address ? 'done' : deploying ? 'active' : blocked ? 'blocked' : 'idle';
  return (
    <div className="border border-zinc-200 dark:border-zinc-800">
      <div className="flex min-h-9 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <p className={EYEBROW}>Contract</p>
        <StatusTag status={status} />
      </div>
      <div className="flex flex-col gap-1.5 px-4 py-4">
        <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{name}</h3>
        <p className={BODY}>{description}</p>
      </div>
      {inputs && (
        <div className="border-t border-zinc-200 px-4 dark:border-zinc-800">
          <p className={cn(EYEBROW, 'pt-3')}>Constructor inputs</p>
          <SpecPlate>{inputs}</SpecPlate>
        </div>
      )}
      <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
        {address ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className={EYEBROW}>Address</span>
              <HashChip value={address} len={18} />
            </div>
            <Button variant="outline" size="sm" className="w-auto" onClick={onRedeploy}>
              Redeploy
            </Button>
          </div>
        ) : (
          action
        )}
        {deploying && <WorkingCaption>Confirm in your wallet, then wait for the receipt.</WorkingCaption>}
      </div>
    </div>
  );
}
