'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderX,
  Maximize2,
  Minimize2,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import { cn } from '@/lib/utils';
import { ApiError, api, errorText, type ProjectOverview } from './api';
import { AuditPanel } from './AuditPanel';
import { ComposerBeam } from './Beam';
import { ChatPanel } from './ChatPanel';
import { ContractsPanel } from './ContractsPanel';
import { DeployPanel } from './DeployPanel';
import { FilesPanel } from './FilesPanel';
import { NetworksPanel } from './NetworksPanel';
import { PlanPanel } from './PlanPanel';
import { PreviewPanel } from './PreviewPanel';
import { ProductionPanel } from './ProductionPanel';
import { useBlueprints } from './StudioHome';
import { Appear, Bone, Button, EmptyState, LABEL, MarkedTabs, Notice } from './ui';
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

/* The frame's parts, shared by the skeleton and the loaded page so that nothing moves when the project arrives. */

/** The pane's own ground. Not bg-white: the light console tints .bg-white boards in its pane (app/global.css). */
const GROUND = 'bg-[#fff] dark:bg-zinc-900';
const FRAME = 'flex flex-col border-zinc-200 lg:min-h-0 lg:flex-1 lg:overflow-hidden dark:border-zinc-800';
// Same side padding as the chat (left) and the tab content (right), so the header lines up with both. Not a <header>:
// the site navbar's global `header > div` padding would push both sides inward.
const HEADER =
  'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-b border-zinc-200 py-3 pl-5 pr-5 md:pr-6 dark:border-zinc-800';
// From sm up, one row: Studio / title, stage. The title shrinks and truncates, so the actions keep the far right.
// Baselines, so the small labels sit on the title's first line. A phone stacks it: the Studio label and the stage on a
// small first line, then the title on the full width (two lines at most), then the actions.
const TITLE_SIDE =
  'flex min-w-0 basis-full flex-wrap items-baseline gap-x-3 gap-y-1.5 sm:grow sm:basis-0 sm:flex-nowrap';
const TITLE_BLOCK = 'flex min-w-0 max-sm:order-last max-sm:basis-full';
const ACTIONS = 'ml-auto flex shrink-0 items-center gap-1';
// The chat gets 4 parts of 11, so all eight tabs fit at 1440 px with the console sidebar open.
const GRID =
  'grid grid-cols-1 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(340px,4fr)_minmax(0,7fr)] lg:grid-rows-[minmax(0,1fr)]';
const CHAT_COLUMN =
  'flex h-[70vh] min-h-0 flex-col border-b border-zinc-200 lg:h-auto lg:border-b-0 lg:border-r dark:border-zinc-800';
const PANEL_COLUMN = 'min-w-0 lg:min-h-0 lg:overflow-y-auto';
// A sticky bar pins inside its scroller's padding. On large screens the panel column scrolls and has none; below that
// the console page scrolls, and the negative offsets cancel its p-2 and md:p-3. The bar's own bottom padding keeps
// text that scrolls under it off the hairline.
const tabBar = (full: boolean) =>
  cn('sticky z-10 px-5 pb-2 pt-5 md:px-6 lg:top-0', GROUND, full ? 'top-0' : '-top-2 md:-top-3');
const PANEL_BODY = 'flex flex-col gap-6 px-5 pb-5 pt-4 md:px-6';
const ICON_BUTTON = 'w-8 px-0';
const STUDIO_LINK = cn(LABEL, 'shrink-0 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100');
// A phone puts the title under the Studio label, so it needs no slash.
const SLASH = 'shrink-0 text-[13px] text-zinc-300 max-sm:hidden dark:text-zinc-700';
// The console breadcrumb and sidebar already say Studio on a desktop narrower than xl, so the title gets that room.
// A phone and full screen keep the link: neither shows the breadcrumb's Studio.
const crumb = (full: boolean) => (full ? undefined : 'sm:max-xl:hidden');
// Below xl, Export is an icon like its neighbours, so the title is the last thing to truncate.
const EXPORT =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 xl:mr-1 xl:w-auto xl:px-2 dark:text-zinc-400 dark:hover:text-zinc-100';
const LINK_BUTTON =
  'inline-flex h-8 items-center gap-2 border px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors';
const LINK_PRIMARY = cn(
  LINK_BUTTON,
  'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
);
const LINK_GHOST = cn(
  LINK_BUTTON,
  'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
);

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

/**
 * Fades in without Appear's rise, for parts that take over their bones' place: a rise would move them off that spot.
 * Instant under reduced motion.
 */
function FadeIn({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const FADE = 64;

/**
 * The tab row, with a fade and an arrow on each cut edge, so a row wider than its pane reads as scrollable. An arrow
 * carries the amber mark when a marked tab is hidden behind it.
 */
function ScrollingTabs({ active, marked, children }: { active: Tab; marked: boolean[]; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState({ start: false, end: false, startMark: false, endMark: false });
  // MarkedTabs renders the scroller itself, as the box's only child.
  const scroller = () => box.current?.firstElementChild as HTMLElement | null | undefined;
  const markKey = marked.join();

  useEffect(() => {
    const row = scroller();
    if (!row) return;
    const flags = markKey.split(',').map((m) => m === 'true');
    const update = () => {
      const r = row.getBoundingClientRect();
      const tabs = [...row.children].map((tab) => tab.getBoundingClientRect());
      const next = {
        start: row.scrollLeft > 1,
        end: row.scrollLeft + row.clientWidth < row.scrollWidth - 1,
        startMark: tabs.some((t, i) => flags[i] && t.left < r.left + FADE / 2),
        endMark: tabs.some((t, i) => flags[i] && t.right > r.right - FADE / 2),
      };
      setCut((c) =>
        c.start === next.start && c.end === next.end && c.startMark === next.startMark && c.endMark === next.endMark
          ? c
          : next,
      );
    };
    update();
    row.addEventListener('scroll', update, { passive: true });
    // The row's own size, and each tab's, since a tab grows when it gains a mark.
    const observer = new ResizeObserver(update);
    observer.observe(row);
    for (const tab of row.children) observer.observe(tab);
    return () => {
      row.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [markKey]);

  // Bring the open tab into view when something else opens it (a build opens Audit). Sideways only: scrollIntoView
  // would also scroll the page on a phone, where the tabs sit below the chat.
  useEffect(() => {
    const row = scroller();
    const tab = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !tab) return;
    const r = row.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    const room = FADE * 0.6;
    const by =
      t.right > r.right - room ? t.right - r.right + room : t.left < r.left + room ? t.left - r.left - room : 0;
    if (by) row.scrollBy({ left: by, behavior: smooth() });
  }, [active]);

  const page = (direction: 1 | -1) => {
    const row = scroller();
    row?.scrollBy({ left: direction * row.clientWidth * 0.6, behavior: smooth() });
  };

  return (
    <div ref={box} className="relative">
      {children}
      {(['start', 'end'] as const).map((edge) => {
        if (!cut[edge]) return null;
        const mark = edge === 'end' ? cut.endMark : cut.startMark;
        return (
          // Above the hairline, so the row's rule runs on under the fade. A pointer aid only: tabbing through the
          // tabs scrolls the row by itself, and each mark is read out on its own tab.
          <div
            key={edge}
            style={{ width: FADE }}
            className={cn(
              'pointer-events-none absolute bottom-px top-0 flex items-start from-[#fff] from-40% to-transparent dark:from-zinc-900',
              edge === 'end' ? 'right-0 justify-end bg-gradient-to-l' : 'left-0 justify-start bg-gradient-to-r',
            )}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => page(edge === 'end' ? 1 : -1)}
              className={cn(
                'pointer-events-auto relative flex h-[17px] items-center px-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100',
                edge === 'end' ? '-mr-1' : '-ml-1',
              )}
            >
              {edge === 'end' ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              {/* On the arrow's corner, so it reads as the arrow's and not as the cut tab's. */}
              {mark && <span className="absolute -top-0.5 right-0 h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

const smooth = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** The project's stage, quiet next to its name: a grey dot on testnet, an emerald one in production. */
function Stage({ stage, className }: { stage: ProjectOverview['project']['stage']; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          stage === 'production' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600',
        )}
      />
      {stage}
    </span>
  );
}

// Label widths of the eight tabs, Plan to Production, so the real row lands on its bones.
const TAB_BONES = ['w-[34px]', 'w-[51px]', 'w-[69px]', 'w-[77px]', 'w-[60px]', 'w-[43px]', 'w-[43px]', 'w-[86px]'];

/** A text line at the chat's line height, so the bones stand as tall as the text that replaces them. */
function LineBone({ width, delay, className }: { width: string; delay: number; className?: string }) {
  return (
    <span className="flex h-[22.75px] items-center">
      <Bone className={cn('h-3', width, className)} delay={delay} />
    </span>
  );
}

// A turn of the builder's sits in a tinted block, and its line bone a shade darker so it still shows.
const USER_TURN = 'bg-zinc-100 px-4 py-3 dark:bg-zinc-800/60';
const ON_TINT = 'bg-zinc-200 dark:bg-zinc-700/60';

/**
 * The chat column before the project arrives, in the shape ChatPanel takes while its history loads: its bar, two
 * turns, and its composer box with the send button outlined, as a disabled one is drawn.
 */
function ChatBones() {
  return (
    <>
      <div className="flex h-[49px] shrink-0 items-center gap-1 border-b border-zinc-200 px-5 lg:pt-2 dark:border-zinc-800">
        <span className="flex min-w-0 flex-1">
          <Bone className="h-2.5 w-24" delay={0.1} />
        </span>
        <span className="flex h-8 w-8 items-center justify-center">
          <Bone className="h-3.5 w-3.5" delay={0.1} />
        </span>
        <span className="-mr-3 flex h-8 items-center px-3">
          <Bone className="h-2.5 w-[52px]" delay={0.1} />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-5 pb-3 pt-5">
        <div className="flex flex-col gap-6">
          <div className={USER_TURN}>
            <LineBone width="w-3/5" delay={0.1} className={ON_TINT} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="border border-zinc-200 px-3 py-[9px] dark:border-zinc-800">
              <Bone className="h-2.5 w-2/5" delay={0.1} />
            </div>
            <div>
              <LineBone width="w-full" delay={0.1} />
              <LineBone width="w-11/12" delay={0.1} />
              <LineBone width="w-2/3" delay={0.1} />
            </div>
          </div>
          <div className={USER_TURN}>
            <LineBone width="w-2/5" delay={0.1} className={ON_TINT} />
          </div>
          <div>
            <LineBone width="w-full" delay={0.1} />
            <LineBone width="w-5/6" delay={0.1} />
            <LineBone width="w-1/2" delay={0.1} />
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <ComposerBeam>
          <div className="flex items-end gap-2 bg-white px-3 py-2 dark:bg-zinc-950">
            <span className="flex h-[45.5px] min-w-0 flex-1 flex-col">
              <LineBone width="w-3/5" delay={0.1} className={ON_TINT} />
            </span>
            <span className="flex h-8 w-10 shrink-0 items-center justify-center border border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              <ArrowUp className="h-3.5 w-3.5" />
            </span>
          </div>
        </ComposerBeam>
        <div className="mt-2 flex h-4 items-center">
          <Bone className="h-2.5 w-64 max-w-full" delay={0.1} />
        </div>
      </div>
    </>
  );
}

/** A section rule as SectionHeader draws it: the label, the hairline, and a status at its end when there is one. */
function RuleBones({ width, status = false }: { width: string; status?: boolean }) {
  return (
    <div className="flex min-h-6 items-center gap-4">
      <Bone className={cn('h-2.5', width)} delay={0.2} />
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      {status && <Bone className="h-2.5 w-[86px]" delay={0.2} />}
    </div>
  );
}

const CARD_ROW = 'flex h-[19.5px] min-w-0 items-center gap-2.5';
const CARD_LINE = 'flex h-[17.2px] items-center pl-6';

/**
 * The Plan tab before the project arrives, in the shape it opens with: the signing wallet's two cards, then the
 * blueprint's title, summary and checklist. Hairlines and card edges are drawn for real.
 */
function PlanBones() {
  return (
    <div className="@container flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <RuleBones width="w-[126px]" status />
        <div className="grid items-stretch gap-2 @xl:grid-cols-2">
          <div className="flex min-h-[66.7px] flex-col gap-1 border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className={CARD_ROW}>
              <Bone className="h-3.5 w-3.5 shrink-0" delay={0.2} />
              <Bone className="h-3 w-28" delay={0.2} />
              <span className="flex-1" />
              <Bone className="h-2 w-24" delay={0.2} />
            </span>
            <span className={CARD_LINE}>
              <Bone className="h-2.5 w-44 max-w-full" delay={0.2} />
            </span>
          </div>
          <div className="flex h-[104.7px] flex-col border border-zinc-200 dark:border-zinc-800">
            <span className="flex flex-col gap-1 px-4 pt-3">
              <span className={CARD_ROW}>
                <Bone className="h-3.5 w-3.5 shrink-0" delay={0.2} />
                <Bone className="h-3 w-28" delay={0.2} />
              </span>
              <span className={CARD_LINE}>
                <Bone className="h-2.5 w-52 max-w-full" delay={0.2} />
              </span>
            </span>
            <span className="flex items-center gap-4 pb-3 pl-10 pr-4 pt-2.5">
              <Bone className="h-7 w-[92px]" delay={0.2} />
              <Bone className="h-2.5 w-20" delay={0.2} />
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <RuleBones width="w-[226px]" />
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="flex h-[25.5px] items-center">
              <Bone className="h-5 w-64 max-w-full" delay={0.2} />
            </span>
            <span className="flex h-[21.9px] items-center">
              <Bone className="h-3 w-80 max-w-full" delay={0.2} />
            </span>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="flex h-[15px] items-center">
                <Bone className="h-2.5 w-28" delay={0.2} />
              </span>
              <div className="flex flex-col gap-1.5">
                {['w-11/12', 'w-4/5', 'w-2/3'].map((width) => (
                  <span key={width} className="flex items-start gap-2.5">
                    <span className="mt-[7px] h-1 w-1 shrink-0 bg-zinc-200 dark:bg-zinc-700" />
                    <span className="flex h-[17.9px] min-w-0 flex-1 items-center">
                      <Bone className={cn('h-3', width)} delay={0.2} />
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <span className="flex h-6 items-center">
              <Bone className="h-2.5 w-72 max-w-full" delay={0.2} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The workspace before its project arrives: the real frame, with bones where the content goes. */
export function WorkspaceSkeleton() {
  return (
    <div role="status" aria-label="Loading project" className={cn(FRAME, 'border')}>
      <div className={HEADER}>
        <div className={TITLE_SIDE}>
          <Link href="/console/studio" className={cn(STUDIO_LINK, crumb(false))}>
            Studio
          </Link>
          <span aria-hidden className={cn(SLASH, crumb(false))}>
            /
          </span>
          {/* In the title's and the stage's type, each with a zero-width space, so the row keeps their baselines. */}
          <span className={cn(TITLE_BLOCK, 'flex h-[21.25px] items-center text-[17px] leading-tight')}>
            {'​'}
            <Bone className="h-4 w-56 max-w-full" />
          </span>
          <span className="inline-flex items-center font-mono text-[10px]">
            {'​'}
            <Bone className="h-2 w-16" />
          </span>
        </div>
        <div className={ACTIONS}>
          <span className="flex h-8 w-8 items-center justify-center xl:hidden">
            <Bone className="h-3.5 w-3.5" />
          </span>
          <span className="mr-1 hidden h-8 items-center px-2 xl:flex">
            <Bone className="h-3 w-[69px]" />
          </span>
          <span className="flex h-8 w-8 items-center justify-center">
            <Bone className="h-3.5 w-3.5" />
          </span>
          <span className="flex h-8 w-8 items-center justify-center">
            <Bone className="h-3.5 w-3.5" />
          </span>
          <Bone className="ml-3 h-8 w-[148px]" />
        </div>
      </div>
      <div className={GRID}>
        <div className={CHAT_COLUMN}>
          <ChatBones />
        </div>
        <div className={PANEL_COLUMN}>
          <div className={tabBar(false)}>
            <div className="flex items-start gap-5 overflow-hidden border-b border-zinc-200 sm:gap-6 dark:border-zinc-800">
              {TAB_BONES.map((width, i) => (
                <span
                  key={width + i}
                  className={cn(
                    '-mb-px h-[28.5px] shrink-0 border-b-2 pt-1',
                    i === 0 ? 'border-[#E6212F]' : 'border-transparent',
                  )}
                >
                  <Bone className={cn('h-2', width)} delay={0.2} />
                </span>
              ))}
            </div>
          </div>
          <div className={PANEL_BODY}>
            <PlanBones />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudioWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const blueprints = useBlueprints();
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
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
  const header = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useFullScreen(shell, full, setFull);

  const load = useCallback(async () => {
    try {
      const next = await api<ProjectOverview>(`/api/studio/projects/${projectId}`);
      setOverview(next);
      setChatId((current) => current ?? next.chats[0]?.id ?? null);
      setDeploymentId((current) => current ?? next.deployments[0]?.id ?? null);
    } catch (e) {
      setMissing(e instanceof ApiError && e.status === 404);
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

  // Closing the confirmation gives focus back to the delete button that opened it.
  const closeConfirm = () => {
    setConfirmDelete(false);
    requestAnimationFrame(() => header.current?.querySelector<HTMLElement>('[data-delete-project]')?.focus());
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

  const retry = () => {
    setError(null);
    setMissing(false);
    void load();
  };

  if (error && !overview) {
    const back = (
      <Link href="/console/studio" className={missing ? LINK_PRIMARY : LINK_GHOST}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Studio
      </Link>
    );
    return (
      <Appear className="mx-auto w-full max-w-xl py-16">
        <EmptyState
          icon={FolderX}
          title={missing ? 'Project not found' : 'This project did not load'}
          action={
            missing ? (
              back
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={retry}>
                  <RotateCw className="h-3.5 w-3.5" /> Try again
                </Button>
                {back}
              </div>
            )
          }
        >
          {missing ? 'It was deleted, or it belongs to another account.' : error}
        </EmptyState>
      </Appear>
    );
  }
  if (!overview) return <WorkspaceSkeleton />;

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
    <div ref={shell} className={cn(FRAME, full ? cn('fixed inset-0 z-[90] overflow-y-auto', GROUND) : 'border')}>
      <div ref={header} className={HEADER}>
        <div className={TITLE_SIDE}>
          {full && (
            <AvalancheLogo width={20} height={18} aria-label="Avalanche" className="-mr-1 shrink-0 self-center" />
          )}
          <Link href="/console/studio" className={cn(STUDIO_LINK, crumb(full))}>
            Studio
          </Link>
          <span aria-hidden className={cn(SLASH, crumb(full))}>
            /
          </span>
          <FadeIn className={TITLE_BLOCK}>
            <h1
              className="min-w-0 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-zinc-900 max-sm:line-clamp-2 sm:truncate dark:text-zinc-50"
              title={project.name}
            >
              {project.name}
            </h1>
          </FadeIn>
          <FadeIn className="flex shrink-0">
            <Stage stage={project.stage} />
          </FadeIn>
        </div>
        <FadeIn className={ACTIONS}>
          <a
            href={`/api/studio/projects/${project.id}/export`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Export"
            title="Download the project's files"
            className={EXPORT}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Export</span>
          </a>
          <Button
            variant="ghost"
            className={ICON_BUTTON}
            onClick={() => setFull((f) => !f)}
            aria-label={full ? 'Exit full screen' : 'Full screen'}
            title={full ? 'Exit full screen (Esc)' : 'Full screen'}
          >
            {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            className={ICON_BUTTON}
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete project"
            aria-expanded={confirmDelete}
            title="Delete project"
            data-delete-project
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {/* An outline while the delete confirmation is open, so the pane keeps one strong action. */}
          <Button className="ml-3" onClick={() => void build()} busy={building} disabled={confirmDelete}>
            Build and audit
          </Button>
        </FadeIn>
        {confirmDelete && (
          <Appear className="w-full">
            <div
              role="group"
              aria-label="Delete this project"
              onKeyDown={(e) => {
                if (e.key !== 'Escape' || deleting) return;
                // Esc closes the confirmation only, not full screen as well.
                e.stopPropagation();
                closeConfirm();
              }}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <span className="min-w-0 flex-1 text-[13px] text-zinc-700 dark:text-zinc-300">
                Delete this project and its chats, files, builds and plans? Deployed contracts and L1s keep running.
              </span>
              <Button variant="ghost" autoFocus disabled={deleting} onClick={closeConfirm}>
                Cancel
              </Button>
              <Button variant="danger" busy={deleting} onClick={() => void deleteProject()}>
                Delete project
              </Button>
            </div>
          </Appear>
        )}
      </div>

      <div className={GRID}>
        <aside className={CHAT_COLUMN}>
          {/* No fade here: ChatPanel opens on the same bones as the skeleton, then fades its history in itself. */}
          <ChatPanel
            projectId={project.id}
            chats={overview.chats}
            activeChatId={chatId}
            onSelectChat={setChatId}
            initialPrompt={initialPrompt}
            onTurnFinished={() => void load()}
            hasFiles={overview.files.length > 0}
            blueprints={blueprints ?? undefined}
          />
        </aside>

        <section className={PANEL_COLUMN}>
          <div className={tabBar(full)}>
            <FadeIn>
              <ScrollingTabs active={tab} marked={TABS.map((t) => Boolean(marks[t]))}>
                <MarkedTabs tabs={[...TABS]} active={tab} onChange={setTab} labels={TAB_LABELS} marks={marks} />
              </ScrollingTabs>
            </FadeIn>
          </div>
          <div className={PANEL_BODY}>
            {error && <Notice tone="bad">{error}</Notice>}
            <Appear key={tab}>
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
                  onOpenProduction={() => setTab('production')}
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
                  onOpenPlan={() => setTab('plan')}
                />
              )}
              {tab === 'contracts' && (
                <ContractsPanel
                  projectId={project.id}
                  deploymentId={deploymentId}
                  hasContracts={overview.files.some((f) => f.path.startsWith('contracts/') && f.path.endsWith('.sol'))}
                  onOpenPlan={() => setTab('plan')}
                />
              )}
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
                  blueprints={blueprints ?? []}
                  onOpenDeploy={() => setTab('deploy')}
                  onChanged={() => void load()}
                  onPromoted={(id) => {
                    setDeploymentId(id);
                    setTab('deploy');
                  }}
                />
              )}
            </Appear>
          </div>
        </section>
      </div>
    </div>
  );
}
