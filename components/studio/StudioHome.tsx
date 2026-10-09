'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowRight, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { ConsoleWalletsDialog } from '@/components/console-wallets/ConsoleWalletsManager';
import {
  Board,
  EmptyRow,
  HEAD,
  INK,
  MUTED,
  Rise,
  RowDoor,
  RowSkeleton,
  ROW,
  SectionHeader,
  Tabs,
  CellLabel,
} from '@/components/explorer-v2/ui';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { cn } from '@/lib/utils';
import { api, errorText, type BlueprintCard, type ProjectSummary } from './api';
import { ImportNewProject } from './ImportProject';
import { PromptComposer } from './PromptComposer';
import { Button, LABEL, Notice, Pill, STATUS_TONE, timeAgo } from './ui';

const CATEGORIES = ['all', 'payments', 'defi', 'data', 'interop', 'privacy', 'infra'] as const;
type CategoryTab = (typeof CATEGORIES)[number];
const CATEGORY_LABELS: Record<CategoryTab, string> = {
  all: 'All',
  payments: 'Payments',
  defi: 'DeFi',
  data: 'Data',
  interop: 'Interop',
  privacy: 'Privacy',
  infra: 'Infra',
};

/** Sized so the widest cell, a "testnet · succeeded" pill, fits on one line; project and blueprints share the rest. */
const PROJECT_COLUMNS = 'md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_96px_176px_104px]';

/** The first blueprint and how many more, since the full list rarely fits a column. */
function blueprintSummary(ids: string[]) {
  if (ids.length === 0) return '—';
  return ids.length === 1 ? ids[0] : `${ids[0]} +${ids.length - 1}`;
}

export function useBlueprints() {
  const [blueprints, setBlueprints] = useState<BlueprintCard[] | null>(null);
  useEffect(() => {
    api<{ blueprints: BlueprintCard[] }>('/api/studio/blueprints')
      .then((r) => setBlueprints(r.blueprints))
      .catch(() => setBlueprints([]));
  }, []);
  return blueprints;
}

export function StudioHome() {
  const router = useRouter();
  const { status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const blueprints = useBlueprints();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [tab, setTab] = useState<CategoryTab>('all');
  const [starting, setStarting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [walletsOpen, setWalletsOpen] = useState(false);

  const deleteProject = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      await api(`/api/studio/projects/${id}`, { method: 'DELETE' });
      setProjects((list) => (list ?? []).filter((p) => p.id !== id));
      setConfirmDelete(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setDeleting(false);
    }
  };
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      if (status === 'unauthenticated') setProjects([]);
      return;
    }
    api<{ projects: ProjectSummary[] }>('/api/studio/projects')
      .then((r) => setProjects(r.projects))
      .catch((e) => {
        setError(errorText(e));
        setProjects([]);
      });
  }, [status]);

  const visible = useMemo(
    () => (blueprints ?? []).filter((b) => tab === 'all' || b.category === tab),
    [blueprints, tab],
  );
  const examples = useMemo(
    () =>
      (blueprints ?? [])
        .filter((b) => b.level === 'advanced')
        .slice(0, 3)
        .map((b) => b.prompts[0])
        .filter(Boolean),
    [blueprints],
  );

  const startFrom = async (blueprint: BlueprintCard) => {
    if (status !== 'authenticated') {
      openLoginModal();
      return;
    }
    setStarting(blueprint.id);
    try {
      const { project, chatId } = await api<{ project: { id: string }; chatId: string }>('/api/studio/projects', {
        method: 'POST',
        json: { name: blueprint.title, blueprintIds: [blueprint.id] },
      });
      router.push(`/console/studio/${project.id}${chatId ? `?chat=${chatId}` : ''}`);
    } catch (e) {
      setError(errorText(e));
      setStarting(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 pb-20 pt-2">
      <Rise className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className={LABEL}>Studio · build agent</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
            Describe an app. Ship it to testnet. Promote it when it works.
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Studio writes the Solidity and the Foundry tests, audits every build against the OWASP Smart Contract Top
            10, and deploys step by step with your wallet. Everything runs on testnet first; production is a gated
            migration of the exact bytecode you tested.
          </p>
        </div>
        <PromptComposer examples={examples} beam="colorful" />
        {importing ? (
          <ImportNewProject onCancel={() => setImporting(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => (status === 'authenticated' ? setImporting(true) : openLoginModal())}
            >
              Import a project you already started
            </Button>
            <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
              Bring a Foundry or Hardhat project to improve it, audit it, or plan its deploy steps.
            </span>
          </div>
        )}
      </Rise>

      {error && <Notice tone="bad">{error}</Notice>}

      <Rise delay={0.08} className="flex flex-col gap-4">
        <SectionHeader
          label="Your projects"
          action={
            <Button variant="ghost" className="h-6 px-1" onClick={() => setWalletsOpen(true)}>
              <KeyRound className="h-3.5 w-3.5" /> Console wallets
            </Button>
          }
        />
        {walletsOpen && <ConsoleWalletsDialog onClose={() => setWalletsOpen(false)} />}
        <Board>
          <div className={cn(HEAD, PROJECT_COLUMNS)}>
            <span>Project</span>
            <span>Blueprints</span>
            <span>Stage</span>
            <span>Last deployment</span>
            <span className="text-right">Updated</span>
          </div>
          {projects === null ? (
            <RowSkeleton n={3} />
          ) : status !== 'authenticated' ? (
            <div className="flex items-center justify-between gap-4 px-5 py-4 md:px-6">
              <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Sign in to keep projects, chats and deployments.
              </span>
              <Button variant="secondary" onClick={() => openLoginModal()}>
                Sign in
              </Button>
            </div>
          ) : projects.length === 0 ? (
            <EmptyRow>No projects yet. Describe one above or start from a template below.</EmptyRow>
          ) : (
            projects.map((p) => {
              const last = p.deployments[0];
              if (confirmDelete === p.id) {
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 bg-zinc-50 px-5 py-2.5 md:px-6 dark:bg-zinc-900"
                  >
                    <span className="min-w-0 flex-1 text-[13px] text-zinc-800 dark:text-zinc-200">
                      Delete <span className="font-medium">{p.name}</span> with its chats, files, builds and plans?
                      Contracts and L1s it deployed keep running on-chain.
                    </span>
                    <Button variant="danger" busy={deleting} onClick={() => void deleteProject(p.id)}>
                      Delete project
                    </Button>
                    <Button variant="ghost" disabled={deleting} onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </Button>
                  </div>
                );
              }
              return (
                <RowDoor key={p.id} href={`/console/studio/${p.id}`} className={cn(ROW, PROJECT_COLUMNS)}>
                  <span className="min-w-0">
                    <CellLabel>Project</CellLabel>
                    <span className={cn(INK, 'block truncate font-sans text-[13.5px] font-medium')}>{p.name}</span>
                  </span>
                  <span className="min-w-0">
                    <CellLabel>Blueprints</CellLabel>
                    <span className={cn(MUTED, 'block truncate')} title={p.blueprint_ids.join(', ')}>
                      {blueprintSummary(p.blueprint_ids)}
                    </span>
                  </span>
                  <span>
                    <CellLabel>Stage</CellLabel>
                    <Pill tone={p.stage === 'production' ? 'prod' : 'neutral'}>{p.stage}</Pill>
                  </span>
                  <span>
                    <CellLabel>Last deployment</CellLabel>
                    {last ? (
                      <Pill tone={STATUS_TONE[last.status] ?? 'neutral'}>{`${last.stage} · ${last.status}`}</Pill>
                    ) : (
                      <span className={MUTED}>none</span>
                    )}
                  </span>
                  <span className={cn(MUTED, 'flex items-center gap-2 md:justify-end')}>
                    <span>
                      <CellLabel>Updated</CellLabel>
                      {timeAgo(p.updated_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(p.id)}
                      aria-label={`Delete ${p.name}`}
                      title="Delete project"
                      className="p-1 text-zinc-400 transition-colors hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </RowDoor>
              );
            })
          )}
        </Board>
      </Rise>

      <Rise delay={0.16} className="flex flex-col gap-5">
        <SectionHeader
          label="Templates"
          action={<span className={cn(MUTED, 'hidden sm:inline')}>{blueprints?.length ?? 0} blueprints</span>}
        />
        <Tabs tabs={[...CATEGORIES]} active={tab} onChange={setTab} labels={CATEGORY_LABELS} />
        <div className="grid grid-cols-1 border-l border-t border-zinc-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800">
          {blueprints === null
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse border-b border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
                />
              ))
            : visible.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => void startFrom(b)}
                  disabled={starting !== null}
                  className="group/tpl flex min-h-44 flex-col gap-3 border-b border-r border-zinc-200 bg-white/80 p-5 text-left transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={LABEL}>{CATEGORY_LABELS[b.category]}</span>
                    <span className="flex items-center gap-1.5">
                      {b.contracts.some((c) => c.audited) && (
                        <ShieldCheck
                          className="h-3.5 w-3.5 text-zinc-400"
                          aria-label="Uses audited Ava Labs contracts"
                        />
                      )}
                      <Pill tone={b.level === 'advanced' ? 'info' : 'neutral'}>{b.level}</Pill>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                      {b.title}
                      <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/tpl:translate-x-0 group-hover/tpl:opacity-100" />
                    </span>
                    <span className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{b.summary}</span>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">
                    <span>
                      {Object.values(b.networks)
                        .map((n) => n.defaultName)
                        .filter((v, i, all) => all.indexOf(v) === i)
                        .join(' · ')}
                    </span>
                    <span>{b.steps} steps</span>
                    {starting === b.id && <span className="text-zinc-900 dark:text-zinc-100">Creating…</span>}
                  </div>
                </button>
              ))}
        </div>
      </Rise>
    </div>
  );
}
