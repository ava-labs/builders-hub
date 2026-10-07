'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { DetailSkeleton, Tabs, idInk } from '@/components/explorer-v2/ui';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import { cn } from '@/lib/utils';
import { api, errorText, type ProjectOverview } from './api';
import { AuditPanel } from './AuditPanel';
import { ChatPanel } from './ChatPanel';
import { ContractsPanel } from './ContractsPanel';
import { DeployPanel } from './DeployPanel';
import { FilesPanel } from './FilesPanel';
import { NetworksPanel } from './NetworksPanel';
import { PlanPanel } from './PlanPanel';
import { PreviewPanel } from './PreviewPanel';
import { ProductionPanel } from './ProductionPanel';
import { useBlueprints } from './StudioHome';
import { Button, LABEL, Notice, Pill } from './ui';
import { useFullScreen } from './useFullScreen';

const TABS = ['plan', 'deploy', 'networks', 'contracts', 'preview', 'files', 'audit', 'production'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  plan: 'Plan',
  deploy: 'Deploy',
  networks: 'Networks',
  contracts: 'Contracts',
  preview: 'Preview',
  files: 'Files',
  audit: 'Audit',
  production: 'Production',
};

/** Tabs with something left to do, and what it is. */
export function attentionMarks(overview: ProjectOverview, openFindings: number): Partial<Record<Tab, string>> {
  const { project, deployments } = overview;
  const marks: Partial<Record<Tab, string>> = {};

  if (project.blueprint_ids.length > 0 && deployments.length === 0) marks.plan = 'Nothing planned yet';

  const waiting = deployments.filter((d) => d.status === 'proposed' || d.status === 'running').length;
  if (waiting > 0) marks.deploy = `${waiting} deployment${waiting === 1 ? '' : 's'} waiting to continue`;

  const l1 = project.runtime.testnet?.l1;
  const needsL1 = Object.values(project.networks).includes('l1');
  if (needsL1 && !l1) marks.networks = 'Bind your L1';
  else if (l1 && l1.teleporter?.messenger && !l1.teleporter.registry)
    marks.networks = 'ICM registry missing on your L1';
  else if (l1?.relayer === 'not-running') marks.networks = "Your L1's relayer is not running";

  if (openFindings > 0) marks.audit = `${openFindings} blocking finding${openFindings === 1 ? '' : 's'}`;
  return marks;
}

export function StudioWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const blueprints = useBlueprints();
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('plan');
  const [chatId, setChatId] = useState<string | null>(search.get('chat'));
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  // Held here so a launch keeps running when the builder switches tabs.
  const [autoRunId, setAutoRunId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialPrompt] = useState(() => search.get('prompt') ?? undefined);
  const shell = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useFullScreen(shell, full, setFull);

  const load = useCallback(async () => {
    try {
      const next = await api<ProjectOverview>(`/api/studio/projects/${projectId}`);
      setOverview(next);
      setChatId((current) => current ?? next.chats[0]?.id ?? null);
      setDeploymentId((current) => current ?? next.deployments[0]?.id ?? null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The queued prompt runs once; drop it from the URL so a reload does not resend it.
  useEffect(() => {
    if (search.get('prompt'))
      router.replace(`/console/studio/${projectId}${chatId ? `?chat=${chatId}` : ''}`, { scroll: false });
  }, [chatId, projectId, router, search]);

  const planned = (id: string, autoRun: boolean) => {
    setDeploymentId(id);
    if (autoRun) setAutoRunId(id);
    void load();
  };

  const deleteProject = async () => {
    setDeleting(true);
    try {
      await api(`/api/studio/projects/${projectId}`, { method: 'DELETE' });
      router.push('/console/studio');
    } catch (e) {
      setError(errorText(e));
      setDeleting(false);
    }
  };

  const build = async () => {
    setBuilding(true);
    try {
      await api(`/api/studio/projects/${projectId}/build`, { method: 'POST' });
      await load();
      setTab('audit');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBuilding(false);
    }
  };

  if (error && !overview) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <Notice tone="bad">
          {error}{' '}
          <Link href="/console/studio" className={idInk}>
            Back to Studio
          </Link>
        </Notice>
      </div>
    );
  }
  if (!overview) return <DetailSkeleton label="Loading project" />;

  const { project } = overview;
  const openFindings = overview.audit
    ? overview.audit.findings.filter(
        (f) =>
          !overview.audit!.acknowledged.some((a) => a.fingerprint === f.fingerprint) &&
          (f.severity === 'critical' || f.severity === 'high'),
      ).length
    : 0;
  const marks = attentionMarks(overview, openFindings);

  return (
    <div
      ref={shell}
      className={cn(
        'flex flex-col border-zinc-200 lg:min-h-0 lg:flex-1 lg:overflow-hidden dark:border-zinc-800',
        full ? 'fixed inset-0 z-[90] overflow-y-auto bg-white dark:bg-zinc-900' : 'border',
      )}
    >
      {/* Same side padding as the chat (left) and the tab content (right), so the header lines up with both. Not a
          <header>: the site navbar's global `header > div` padding would push both sides inward. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 py-3 pl-5 pr-5 md:pr-6 dark:border-zinc-800">
        {/* The title side shrinks and truncates, so the actions always sit at the far right of the row. */}
        <div className="flex min-w-0 flex-1 items-center gap-x-4">
          {full && <AvalancheLogo width={20} height={18} aria-label="Avalanche" className="-mr-1 shrink-0" />}
          <Link href="/console/studio" className={cn(LABEL, 'shrink-0 hover:text-zinc-900 dark:hover:text-zinc-100')}>
            Studio
          </Link>
          <span className="shrink-0 text-zinc-300 dark:text-zinc-700">/</span>
          <h1
            className="min-w-0 truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50"
            title={project.name}
          >
            {project.name}
          </h1>
          <Pill tone={project.stage === 'production' ? 'prod' : 'neutral'}>{project.stage}</Pill>
          {openFindings > 0 && (
            <Pill tone="bad">{`${openFindings} blocking finding${openFindings === 1 ? '' : 's'}`}</Pill>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a
            href={`/api/studio/projects/${project.id}/export`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 px-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </a>
          <Button variant="secondary" onClick={() => void build()} busy={building}>
            Build and audit
          </Button>
          <Button
            variant="ghost"
            className="w-8 px-0"
            onClick={() => setFull((f) => !f)}
            aria-label={full ? 'Exit full screen' : 'Full screen'}
            title={full ? 'Exit full screen (Esc)' : 'Full screen'}
          >
            {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          {/* The negative margin puts the icon itself, not its hit area, on the content's right edge. */}
          <Button
            variant="ghost"
            className="-mr-[9px] w-8 px-0"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete project"
            title="Delete project"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {confirmDelete && (
          <div className="flex w-full flex-wrap items-center gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <span className="min-w-0 flex-1 text-[13px] text-zinc-800 dark:text-zinc-200">
              Delete this project with its chats, files, builds and plans? Contracts and L1s it deployed keep running
              on-chain.
            </span>
            <Button variant="danger" busy={deleting} onClick={() => void deleteProject()}>
              Delete project
            </Button>
            <Button variant="ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(340px,5fr)_minmax(0,7fr)] lg:grid-rows-[minmax(0,1fr)]">
        <aside className="flex h-[70vh] min-h-0 flex-col border-b border-zinc-200 lg:h-auto lg:border-b-0 lg:border-r dark:border-zinc-800">
          <ChatPanel
            projectId={project.id}
            chats={overview.chats}
            activeChatId={chatId}
            onSelectChat={setChatId}
            initialPrompt={initialPrompt}
            onTurnFinished={() => void load()}
          />
        </aside>

        <main className="min-w-0 lg:min-h-0 lg:overflow-y-auto">
          {/* A sticky bar pins inside its scroller's padding. On large screens this pane scrolls and has none; below that
              the console page scrolls, and the negative offsets cancel its p-2 and md:p-3. */}
          <div
            className={cn(
              'sticky z-10 bg-white px-5 pt-5 md:px-6 lg:top-0 dark:bg-zinc-900',
              full ? 'top-0' : '-top-2 md:-top-3',
            )}
          >
            <Tabs tabs={[...TABS]} active={tab} onChange={setTab} labels={TAB_LABELS} marks={marks} />
          </div>
          <div className="flex flex-col gap-6 px-5 pb-5 pt-6 md:px-6">
            {error && <Notice tone="bad">{error}</Notice>}
            {tab === 'plan' && (
              <PlanPanel
                overview={overview}
                blueprints={blueprints ?? []}
                selectedId={deploymentId}
                onSelect={setDeploymentId}
                onPlanned={planned}
                onOpenDeploy={() => setTab('deploy')}
                onOpenAudit={() => setTab('audit')}
              />
            )}
            {tab === 'deploy' && (
              <DeployPanel
                overview={overview}
                blueprints={blueprints ?? []}
                selectedId={deploymentId}
                autoRunId={autoRunId}
                onSelect={setDeploymentId}
                onChanged={() => void load()}
                onOpenPlan={() => setTab('plan')}
                onPlanned={planned}
              />
            )}
            {tab === 'networks' && (
              <NetworksPanel
                overview={overview}
                blueprints={blueprints ?? []}
                autoRunId={autoRunId}
                onPlanned={planned}
                onChanged={() => void load()}
              />
            )}
            {tab === 'contracts' && <ContractsPanel projectId={project.id} deploymentId={deploymentId} />}
            {tab === 'preview' && <PreviewPanel overview={overview} />}
            {tab === 'files' && (
              <FilesPanel
                projectId={project.id}
                projectName={project.name}
                files={overview.files}
                onChanged={() => void load()}
              />
            )}
            {tab === 'audit' && (
              <AuditPanel
                overview={overview}
                onBuild={() => void build()}
                building={building}
                onChanged={() => void load()}
              />
            )}
            {tab === 'production' && (
              <ProductionPanel
                overview={overview}
                onChanged={() => void load()}
                onPromoted={(id) => {
                  setDeploymentId(id);
                  setTab('deploy');
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
