'use client';

import { useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Rocket } from 'lucide-react';
import { Board, HEAD, INK, MUTED, ROW, SectionHeader, idInk } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { planIcmSetup, type BlueprintCard, type ProjectOverview } from './api';
import { Runner, StatusMark, deploymentStatus, networkNamesOf } from './Runner';
import { Button, EmptyState, Pill, timeAgo } from './ui';

const RECENT_DEPLOYMENTS = 5;
const COLUMNS = 'md:grid-cols-[96px_minmax(0,1fr)_120px_80px]';
const FINISHED = ['succeeded', 'failed', 'cancelled'];

export function DeployPanel({
  overview,
  blueprints,
  selectedId,
  autoRunId,
  onSelect,
  onChanged,
  onOpenPlan,
  onPlanned,
  onOpenProduction,
}: {
  overview: ProjectOverview;
  blueprints: BlueprintCard[];
  selectedId: string | null;
  autoRunId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
  onOpenPlan: () => void;
  onPlanned: (deploymentId: string, autoRun: boolean) => void;
  /** Opens the Production tab, where a testnet deployment that succeeded is promoted. */
  onOpenProduction?: () => void;
}) {
  const { project } = overview;
  const [showAll, setShowAll] = useState(false);
  const runnerRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const networkNames = useMemo(() => networkNamesOf(blueprints), [blueprints]);
  const titleOf = (id: string | null) => blueprints.find((b) => b.id === id)?.title ?? id ?? 'Your contracts';
  const deployments = showAll
    ? overview.deployments
    : overview.deployments.filter((d, i) => i < RECENT_DEPLOYMENTS || d.id === selectedId);
  const selected = overview.deployments.find((d) => d.id === selectedId);
  const status = selected?.status;
  // The runner's shape before its steps load, from what the list already knows.
  const blueprint = blueprints.find((b) => b.id === selected?.blueprint_id);
  const skeleton = {
    rows: blueprint?.steps,
    steps: blueprint?.outline,
    finished: !!status && FINISHED.includes(status),
    started: !!status && status !== 'proposed',
    failed: status === 'failed',
    // A run in progress usually has the check after its first step; a finished one has them all.
    checks: status === 'running' ? 1 : status === 'failed' ? 2 : status === 'succeeded' ? 3 : 0,
  };

  if (overview.deployments.length === 0) {
    return (
      <EmptyState
        icon={Rocket}
        title="Nothing to deploy yet"
        action={<Button onClick={onOpenPlan}>Plan a deployment</Button>}
      >
        Plan a deployment on the Plan tab, then run it here.
      </EmptyState>
    );
  }

  // The selected deployment sits above the list, so bring it back into view when a row far down is picked.
  const select = (id: string) => {
    onSelect(id);
    runnerRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-8">
      {selectedId && (
        <section ref={runnerRef} className="flex scroll-mt-20 flex-col gap-3">
          <SectionHeader
            label="Deployment"
            action={
              <Button variant="ghost" className="h-6 px-1" onClick={onOpenPlan}>
                View plan
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
            onReplan={onOpenPlan}
            onPromote={onOpenProduction}
            networkNames={networkNames}
            skeleton={skeleton}
          />
        </section>
      )}

      {(overview.deployments.length > 1 || !selectedId) && (
        <section className="flex flex-col gap-3">
          <SectionHeader
            label="All deployments"
            action={<span className={cn(MUTED, 'text-[11px]')}>{overview.deployments.length}</span>}
          />
          <Board>
            <div className={cn(HEAD, COLUMNS)}>
              <span>ID</span>
              <span>Blueprint</span>
              <span>Status</span>
              <span className="text-right">Created</span>
            </div>
            {deployments.map((d) => {
              const isSelected = d.id === selectedId;
              const [tone, word] = deploymentStatus(d.status);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => select(d.id)}
                  aria-current={isSelected || undefined}
                  className={cn(
                    ROW,
                    'w-full text-left',
                    COLUMNS,
                    isSelected && 'bg-zinc-50 shadow-[inset_2px_0_0_#E6212F] dark:bg-zinc-900',
                  )}
                >
                  <span className={cn(INK, idInk, 'truncate')} title={d.id}>
                    {d.id.slice(0, 8)}
                  </span>
                  <span className="flex min-w-0 items-center gap-2 max-md:justify-end">
                    <span
                      className={cn(
                        'min-w-0 truncate text-[13px]',
                        isSelected ? 'font-medium text-zinc-900 dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-300',
                      )}
                    >
                      {titleOf(d.blueprint_id)}
                    </span>
                    {d.stage === 'production' && <Pill tone="prod">production</Pill>}
                  </span>
                  <span>
                    <StatusMark tone={tone}>{word}</StatusMark>
                  </span>
                  <span className={cn(MUTED, 'truncate text-right text-[11px]')}>{timeAgo(d.created_at)}</span>
                </button>
              );
            })}
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
      )}
    </div>
  );
}
