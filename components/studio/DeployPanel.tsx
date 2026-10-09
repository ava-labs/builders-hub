'use client';

import { useState } from 'react';
import { Board, EmptyRow, HEAD, INK, MUTED, ROW, SectionHeader, idInk } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { planIcmSetup, type BlueprintCard, type ProjectOverview } from './api';
import { Runner } from './Runner';
import { Button, Pill, STATUS_TONE, timeAgo } from './ui';

const RECENT_DEPLOYMENTS = 5;

export function DeployPanel({
  overview,
  blueprints,
  selectedId,
  autoRunId,
  onSelect,
  onChanged,
  onOpenPlan,
  onPlanned,
}: {
  overview: ProjectOverview;
  blueprints: BlueprintCard[];
  selectedId: string | null;
  autoRunId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
  onOpenPlan: () => void;
  onPlanned: (deploymentId: string, autoRun: boolean) => void;
}) {
  const { project } = overview;
  const [showAll, setShowAll] = useState(false);
  const titleOf = (id: string | null) => blueprints.find((b) => b.id === id)?.title ?? id ?? 'Your contracts';
  const deployments = showAll
    ? overview.deployments
    : overview.deployments.filter((d, i) => i < RECENT_DEPLOYMENTS || d.id === selectedId);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeader
          label="Deployments"
          action={
            <Button variant="ghost" className="h-6 px-1" onClick={onOpenPlan}>
              Plan a deployment
            </Button>
          }
        />
        <Board>
          <div className={cn(HEAD, 'md:grid-cols-[96px_minmax(0,1fr)_100px_100px_80px]')}>
            <span>ID</span>
            <span>Blueprint</span>
            <span>Stage</span>
            <span>Status</span>
            <span className="text-right">Created</span>
          </div>
          {overview.deployments.length === 0 ? (
            <EmptyRow>
              No deployments yet.{' '}
              <button type="button" onClick={onOpenPlan} className={cn('underline', idInk)}>
                Plan one first
              </button>
              , review what it does, then come back here to deploy it.
            </EmptyRow>
          ) : (
            deployments.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(d.id)}
                className={cn(
                  ROW,
                  'w-full text-left md:grid-cols-[96px_minmax(0,1fr)_100px_100px_80px]',
                  d.id === selectedId && 'bg-zinc-50 dark:bg-zinc-900',
                )}
              >
                <span className={cn(INK, idInk, 'truncate')} title={d.id}>
                  {d.id.slice(0, 8)}
                </span>
                <span className="min-w-0 truncate text-[13px] text-zinc-800 dark:text-zinc-200">
                  {titleOf(d.blueprint_id)}
                </span>
                <span>
                  <Pill tone={d.stage === 'production' ? 'prod' : 'neutral'}>{d.stage}</Pill>
                </span>
                <span>
                  <Pill tone={STATUS_TONE[d.status] ?? 'neutral'}>{d.status}</Pill>
                </span>
                <span className={cn(MUTED, 'truncate md:text-right')}>{timeAgo(d.created_at)}</span>
              </button>
            ))
          )}
          {overview.deployments.length > RECENT_DEPLOYMENTS && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="w-full px-5 py-2.5 text-left font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 md:px-6 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {showAll ? 'Show recent' : `Show all ${overview.deployments.length}`}
            </button>
          )}
        </Board>
      </section>

      {selectedId && (
        <section className="flex flex-col gap-3">
          <SectionHeader
            label="Runner"
            action={
              <Button variant="ghost" className="h-6 px-1" onClick={onOpenPlan}>
                View plan details
              </Button>
            }
          />
          <Runner
            key={selectedId}
            projectId={project.id}
            deploymentId={selectedId}
            autoStart={autoRunId === selectedId}
            onChanged={onChanged}
            onFinishSetup={async () => onPlanned(await planIcmSetup(project), true)}
          />
        </section>
      )}
    </div>
  );
}
