'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Layers, Search, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFavoriteTools } from '@/hooks/useFavoriteTools';
import { useSubStepSearchToggle } from '@/hooks/useSubStepSearchToggle';
import { Board, BoardHeader, Rise, SectionHeader } from '@/components/explorer-v2/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLS, CATEGORY_ORDER, categoryAnchor, type ToolCard } from './tools';

const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';
const COUNT = 'font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500';
/** Cells draw their right and bottom edges; the grid draws the top and left, so neighbours share one hairline. */
const GRID = 'grid border-l border-t border-zinc-200 dark:border-zinc-800';
const CELL = 'border-b border-r border-zinc-200 dark:border-zinc-800';

/* Star in a cell's corner: pins the tool to the sidebar. Sidebar fixtures show it filled and can't be unpinned. */
function PinButton({
  name,
  starred,
  mandatory,
  onToggle,
}: {
  name: string;
  starred: boolean;
  mandatory: boolean;
  onToggle: () => void;
}) {
  const label = mandatory
    ? `${name} is always in the sidebar`
    : starred
      ? `Unpin ${name} from the sidebar`
      : `Pin ${name} to the sidebar`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!mandatory) onToggle();
      }}
      disabled={mandatory}
      title={label}
      aria-label={label}
      aria-pressed={starred}
      className={cn(
        'relative z-10 -m-1.5 inline-flex h-7 w-7 items-center justify-center transition-opacity focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400',
        starred
          ? 'text-amber-500'
          : 'text-zinc-300 opacity-0 hover:text-amber-500 focus-visible:opacity-100 group-hover/tool:opacity-100 dark:text-zinc-600',
        mandatory && 'cursor-default',
      )}
    >
      <Star className="h-3.5 w-3.5" fill={starred ? 'currentColor' : 'none'} />
    </button>
  );
}

function ToolLink({ tool, className, children }: { tool: ToolCard; className: string; children: React.ReactNode }) {
  return tool.external ? (
    <a href={tool.path} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={tool.path} className={className}>
      {children}
    </Link>
  );
}

/** One tool as a grid cell. The category's lead tool spans two columns and reads a size up. */
function ToolCell({ tool, lead = false }: { tool: ToolCard; lead?: boolean }) {
  const { isStarred, isMandatory, toggle } = useFavoriteTools();
  const Icon = tool.icon;
  const Arrow = tool.external ? ArrowUpRight : ArrowRight;
  return (
    <ToolLink
      tool={tool}
      className={cn(
        CELL,
        'group/tool flex flex-col gap-3 bg-white/80 p-5 dark:bg-zinc-950/80',
        lead ? 'min-h-44 @xl:col-span-2' : 'min-h-36',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex items-center justify-center border border-zinc-200 text-zinc-500 transition-colors group-hover/tool:border-zinc-400 group-hover/tool:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:group-hover/tool:border-zinc-600 dark:group-hover/tool:text-zinc-100',
            lead ? 'h-9 w-9' : 'h-8 w-8',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex items-center gap-3">
          {lead && <span className={EYEBROW}>Start here</span>}
          <PinButton
            name={tool.name}
            starred={isStarred(tool.path)}
            mandatory={isMandatory(tool.path)}
            onToggle={() => toggle(tool.path)}
          />
        </span>
      </span>
      <span
        className={cn(
          'mt-auto flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50',
          lead ? 'text-[18px]' : 'text-[15px]',
        )}
      >
        <span className="underline-offset-4 group-hover/tool:underline">{tool.name}</span>
        <Arrow className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/tool:translate-x-0 group-hover/tool:opacity-100" />
      </span>
      <span
        className={cn(
          'leading-relaxed text-zinc-500 dark:text-zinc-400',
          lead ? 'max-w-md text-[14px]' : 'line-clamp-2 text-[13px]',
        )}
      >
        {tool.description}
      </span>
    </ToolLink>
  );
}

type SubStepResult = { parent: ToolCard; name: string; path: string; description?: string };

function SubStepRow({ step }: { step: SubStepResult }) {
  const Icon = step.parent.icon;
  return (
    <Link href={step.path} className="group/row flex items-center gap-3 px-5 py-2.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-zinc-900 underline-offset-4 group-hover/row:underline dark:text-zinc-50">
          {step.name}
        </span>
        <span className="block truncate text-[12px] text-zinc-500 dark:text-zinc-400">in {step.parent.name}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/row:translate-x-0 group-hover/row:opacity-100" />
    </Link>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type RailItem = { id: string; label: string; count: number };

/* The console scrolls inside its own panel, where a smooth scrollIntoView often stops short; scroll that panel. */
function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  let scroller: HTMLElement | null = target.parentElement;
  while (scroller) {
    const { overflowY } = getComputedStyle(scroller);
    if (/(auto|scroll)/.test(overflowY) && scroller.scrollHeight > scroller.clientHeight) break;
    scroller = scroller.parentElement;
  }
  const box = scroller ?? (document.scrollingElement as HTMLElement);
  const offset = scroller ? scroller.getBoundingClientRect().top : 0;
  const from = box.scrollTop;
  const to = Math.min(from + target.getBoundingClientRect().top - offset - 24, box.scrollHeight - box.clientHeight);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    box.scrollTop = to;
    return;
  }
  // Stepped by hand: the browser's own smooth scroll gets cancelled by other scroll writes on this page.
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - start) / 450, 1);
    box.scrollTop = from + (to - from) * (1 - (1 - t) ** 3);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** The page's sections beside the grid: the one in view is marked, and a click scrolls to it. */
function SectionRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const ids = items.map((i) => i.id).join('|');

  useEffect(() => {
    const sections = ids
      .split('|')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;
    // The last sections can't scroll up to the marker line, so once the last one ends on screen it is current.
    const last = sections[sections.length - 1];
    const lastInView = () => last.getBoundingClientRect().bottom <= window.innerHeight;
    // A section counts as current while it crosses a line a fifth of the way down the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        if (lastInView()) return setActive(last.id);
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    const onScroll = () => lastInView() && setActive(last.id);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [ids]);

  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Toolbox sections"
      className="sticky top-8 hidden max-h-[calc(100vh-12rem)] w-44 shrink-0 self-start overflow-y-auto xl:block"
    >
      <p className={cn(EYEBROW, 'mb-3')}>On this page</p>
      <ul className="border-l border-zinc-200 dark:border-zinc-800">
        {items.map((item) => {
          const on = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={on ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(item.id);
                  setActive(item.id);
                }}
                className={cn(
                  '-ml-px flex items-baseline justify-between gap-3 border-l py-1.5 pl-3 text-[13px] transition-colors',
                  on
                    ? 'border-[#E6212F] font-medium text-zinc-900 dark:text-zinc-50'
                    : 'border-transparent text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100',
                )}
              >
                <span className="truncate">{item.label}</span>
                <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                  {item.count}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function ToolboxBoard() {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { userStarred, isHydrated } = useFavoriteTools();
  const { includeSubSteps, toggle: toggleSubSteps } = useSubStepSearchToggle();
  const query = search.trim().toLowerCase();

  // "/" jumps to search from anywhere on the page, unless the reader is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== '/' || target?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Names only: "convert" should find the converters, not every tool whose description mentions a conversion.
  const filtered = useMemo(() => (query ? TOOLS.filter((t) => t.name.toLowerCase().includes(query)) : TOOLS), [query]);

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({ category, tools: filtered.filter((t) => t.category === category) })).filter(
        (g) => g.tools.length > 0,
      ),
    [filtered],
  );

  const subSteps = useMemo<SubStepResult[]>(() => {
    if (!includeSubSteps || !query) return [];
    return TOOLS.flatMap((tool) => (tool.subSteps ?? []).map((step) => ({ parent: tool, ...step }))).filter((s) =>
      s.name.toLowerCase().includes(query),
    );
  }, [includeSubSteps, query]);

  // Several tiles share a path (the staking variants open Add Validator), so pins list each path once.
  const pinned = useMemo(() => {
    if (!isHydrated || query) return [];
    const seen = new Set<string>();
    return userStarred.flatMap((path) => {
      const tool = TOOLS.find((t) => t.path === path);
      if (!tool || seen.has(path)) return [];
      seen.add(path);
      return [tool];
    });
  }, [isHydrated, query, userStarred]);

  const nothing = grouped.length === 0 && subSteps.length === 0;

  const railItems = useMemo<RailItem[]>(
    () => [
      ...(pinned.length > 0 ? [{ id: 'pinned', label: 'Pinned', count: pinned.length }] : []),
      ...grouped.map((g) => ({ id: categoryAnchor(g.category), label: g.category, count: g.tools.length })),
      ...(subSteps.length > 0 ? [{ id: 'sub-steps', label: 'Sub-steps', count: subSteps.length }] : []),
    ],
    [grouped, pinned.length, subSteps.length],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-20 pt-2">
      <Rise className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className={EYEBROW}>Toolbox</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
            Every console tool, in one place.
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {plural(TOOLS.length, 'tool')} across {plural(CATEGORY_ORDER.length, 'area')}. Star one to pin it to the
            sidebar.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="group/search relative flex flex-1 items-center border border-zinc-300 bg-white/80 transition-colors focus-within:border-zinc-900 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/80 dark:focus-within:border-zinc-100 dark:hover:border-zinc-600">
            <Search className="pointer-events-none ml-3.5 h-4 w-4 shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search tools by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
              aria-label="Search tools"
              className="h-11 w-full bg-transparent px-3 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  inputRef.current?.focus();
                }}
                className="mr-2 p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="mr-3 border border-zinc-200 px-1.5 font-mono text-[11px] text-zinc-400 dark:border-zinc-800">
                /
              </kbd>
            )}
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSubSteps}
                aria-pressed={includeSubSteps}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center justify-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors',
                  includeSubSteps
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-zinc-300 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50',
                )}
              >
                <Layers className="h-3.5 w-3.5" aria-hidden />
                Sub-steps
              </button>
            </TooltipTrigger>
            <TooltipContent
              sideOffset={6}
              className="max-w-xs rounded-none border border-zinc-900 bg-zinc-900 px-2.5 py-1.5 font-mono text-[11px] text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 [&>span>svg]:hidden"
            >
              {includeSubSteps
                ? 'Search also finds single steps inside multi-step flows. Click to search tools only.'
                : 'Also search single steps inside multi-step flows, like “Initialize Validator Set”.'}
            </TooltipContent>
          </Tooltip>
        </div>

        {!query && (
          <nav aria-label="Toolbox areas" className="flex flex-wrap gap-x-5 gap-y-2 xl:hidden">
            {CATEGORY_ORDER.map((category) => (
              <a
                key={category}
                href={`#${categoryAnchor(category)}`}
                className="group/area inline-flex items-baseline gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                {category}
                <span className="text-zinc-300 group-hover/area:text-[#E6212F] dark:text-zinc-600">
                  {TOOLS.filter((t) => t.category === category).length}
                </span>
              </a>
            ))}
          </nav>
        )}
      </Rise>

      {/* Below the search, the sections and the rail that follows them share the page width. */}
      <div className="flex gap-8">
        <div className="@container flex min-w-0 flex-1 flex-col gap-10">
          {pinned.length > 0 && (
            <Rise delay={0.04}>
              <section id="pinned" className="flex scroll-mt-24 flex-col gap-4">
                <SectionHeader label="Pinned" action={<span className={COUNT}>{plural(pinned.length, 'tool')}</span>} />
                <div className={cn(GRID, 'grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3')}>
                  {pinned.map((tool) => (
                    <ToolCell key={tool.path} tool={tool} />
                  ))}
                </div>
              </section>
            </Rise>
          )}

          {nothing ? (
            <div className="flex flex-col items-start gap-3 border border-zinc-200 bg-white/80 px-5 py-8 md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
              <p className={cn(EYEBROW, 'flex items-center gap-2')}>
                <Search className="h-3.5 w-3.5" />
                No matches
              </p>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                No tool is called &ldquo;{search.trim()}&rdquo;.
              </p>
              {!includeSubSteps && (
                <button
                  type="button"
                  onClick={toggleSubSteps}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                >
                  Search sub-steps too
                </button>
              )}
            </div>
          ) : (
            <>
              {grouped.map(({ category, tools }, i) => {
                const lead = tools.find((t) => t.featured);
                const rest = lead ? tools.filter((t) => t !== lead) : tools;
                return (
                  <Rise key={category} delay={Math.min(0.06 + i * 0.03, 0.2)}>
                    <section id={categoryAnchor(category)} className="flex scroll-mt-24 flex-col gap-4">
                      <SectionHeader
                        label={category}
                        action={<span className={COUNT}>{plural(tools.length, 'tool')}</span>}
                      />
                      <div className={cn(GRID, 'grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3')}>
                        {lead && <ToolCell tool={lead} lead />}
                        {rest.map((tool) => (
                          <ToolCell key={tool.path + tool.name} tool={tool} />
                        ))}
                      </div>
                    </section>
                  </Rise>
                );
              })}

              {subSteps.length > 0 && (
                <Rise>
                  <section id="sub-steps" className="flex scroll-mt-24 flex-col gap-4">
                    <SectionHeader
                      label="Sub-steps"
                      action={<span className={COUNT}>{plural(subSteps.length, 'step')}</span>}
                    />
                    <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2">
                      {CATEGORY_ORDER.map((category) => {
                        const steps = subSteps.filter((s) => s.parent.category === category);
                        if (steps.length === 0) return null;
                        return (
                          <Board key={category} className="border-x border-t">
                            <BoardHeader label={category} />
                            {steps.map((step) => (
                              <SubStepRow key={step.path} step={step} />
                            ))}
                          </Board>
                        );
                      })}
                    </div>
                  </section>
                </Rise>
              )}

              {query && (
                <p className={cn(COUNT, 'text-center')}>
                  {plural(filtered.length + subSteps.length, 'result')} in{' '}
                  {plural(new Set([...filtered, ...subSteps.map((s) => s.parent)].map((t) => t.category)).size, 'area')}
                </p>
              )}
            </>
          )}
        </div>
        <SectionRail items={railItems} />
      </div>
    </div>
  );
}
