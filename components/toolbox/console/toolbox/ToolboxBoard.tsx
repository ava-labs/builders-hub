'use client';

import { useState, useMemo, type CSSProperties } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, ExternalLink, Layers, Search, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFavoriteTools } from '@/hooks/useFavoriteTools';
import { useSubStepSearchToggle } from '@/hooks/useSubStepSearchToggle';
import { boardContainer, boardItem } from '@/components/console/motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLS, CATEGORY_ORDER, type ToolCard } from './tools';

// Star control rendered absolutely in the top-right of every toolbox tile.
// Click toggles pin state in localStorage; mandatory paths render the star
// filled-but-disabled because they're permanent fixtures of the sidebar.
// `e.preventDefault()` + `e.stopPropagation()` so clicking the star never
// navigates to the tile's destination.
function StarButton({
  path,
  name,
  starred,
  mandatory,
  onToggle,
  /** Surface style — featured tile is dark, regular tile is light/dark-adapt. */
  variant,
}: {
  path: string;
  name: string;
  starred: boolean;
  mandatory: boolean;
  onToggle: () => void;
  variant: 'regular' | 'featured';
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mandatory) onToggle();
  };

  const label = mandatory
    ? `${name} is pinned to the sidebar`
    : starred
      ? `Unpin ${name} from sidebar`
      : `Pin ${name} to sidebar`;

  // Color logic:
  // - starred (any reason) → amber-500 fill, always visible
  // - unstarred → muted outline that brightens on hover/focus, fades in on
  //   parent group-hover so the star doesn't crowd the tile at rest
  const idleColor =
    variant === 'featured'
      ? 'text-zinc-500 hover:text-amber-400'
      : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-500';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mandatory}
      title={label}
      aria-label={label}
      aria-pressed={starred}
      data-path={path}
      className={cn(
        'absolute top-2 right-2 inline-flex items-center justify-center h-7 w-7 rounded-md',
        'transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40',
        starred
          ? 'text-amber-500 opacity-100'
          : `${idleColor} opacity-0 group-hover:opacity-100 focus-visible:opacity-100`,
        mandatory && 'cursor-default',
      )}
    >
      <Star className="h-4 w-4" fill={starred ? 'currentColor' : 'none'} strokeWidth={starred ? 1.5 : 2} />
    </button>
  );
}

const STARRED_TILE_PATTERN: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, rgba(113, 113, 122, 0.14) 0px, rgba(113, 113, 122, 0.14) 1px, transparent 1px, transparent 8px)',
};

const STARRED_FEATURED_PATTERN: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, rgba(212, 212, 216, 0.08) 0px, rgba(212, 212, 216, 0.08) 1px, transparent 1px, transparent 9px)',
};

// ---------------------------------------------------------------------------
// ToolTile — matches homepage BentoCard geometry: rounded-2xl, soft shadow,
// icon tile in the top-left, name + description, chevron on hover.
// ---------------------------------------------------------------------------

function ToolTile({
  tool,
  starred,
  mandatory,
  onToggleStar,
}: {
  tool: ToolCard;
  starred: boolean;
  mandatory: boolean;
  onToggleStar: () => void;
}) {
  const Icon = tool.icon;

  const card = (
    <motion.div variants={boardItem} className="h-full">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
        className={cn(
          'group relative h-full rounded-2xl border p-4 cursor-pointer transition-all duration-200',
          // Starred tiles get an amber-tinted border + subtle bg wash so
          // the user can spot what they've pinned at a glance. The gray
          // hatch stays subtle but gives mandatory/sidebar-pinned tools a
          // second visual cue beyond the yellow star.
          starred
            ? 'border-amber-300/70 dark:border-amber-500/35 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-sm'
            : 'border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm hover:border-zinc-300 dark:hover:border-zinc-700',
        )}
        style={{
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)',
          ...(starred ? STARRED_TILE_PATTERN : {}),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)';
        }}
      >
        <StarButton
          path={tool.path}
          name={tool.name}
          starred={starred}
          mandatory={mandatory}
          onToggle={onToggleStar}
          variant="regular"
        />
        <div className="flex items-start gap-3 pr-7">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
            <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{tool.name}</h3>
              {tool.external && <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" />}
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{tool.description}</p>
          </div>
          {!tool.external && (
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  if (tool.external) {
    return (
      <a href={tool.path} target="_blank" rel="noopener noreferrer" className="h-full block">
        {card}
      </a>
    );
  }
  return (
    <Link href={tool.path} className="h-full block">
      {card}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// FeaturedTile — larger headline card for the one "lead" tool per category.
// Single monochrome scheme that adapts to light/dark theme — mirrors the
// neutral palette used by the eERC Overview's TileShells. Per-category
// gradients (red / indigo / emerald / fuchsia) were tried and rejected:
// they made the toolbox feel like a paint sample shop and clashed with the
// rest of the console's restrained look.
// ---------------------------------------------------------------------------

type FeaturedScheme = {
  background: string;
  border: string;
  borderHover: string;
  iconWrap: string;
  iconWrapHover: string;
  iconColor: string;
  title: string;
  description: string;
  chevron: string;
  chevronHover: string;
  shadow: string;
  shadowHover: string;
};

// Always-dark hero card. The featured tile is the "premium" element on the
// toolbox — it stays dark in both light and dark mode so it pops against
// any page bg. White-on-dark gives the strongest visual contrast and
// matches the eERC Overview aesthetic that worked for the user.
const DEFAULT_SCHEME: FeaturedScheme = {
  background: 'bg-zinc-800',
  border: 'border-zinc-700/80',
  borderHover: 'hover:border-zinc-600',
  iconWrap: 'bg-white/[0.08]',
  iconWrapHover: 'group-hover:bg-white/[0.14]',
  iconColor: 'text-zinc-200 group-hover:text-white',
  title: 'text-white',
  description: 'text-zinc-400',
  chevron: 'text-zinc-500',
  chevronHover: 'group-hover:text-zinc-300',
  shadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
  shadowHover: 'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.2), 0 16px 40px rgba(0,0,0,0.15)',
};

function FeaturedTile({
  tool,
  starred,
  mandatory,
  onToggleStar,
}: {
  tool: ToolCard;
  starred: boolean;
  mandatory: boolean;
  onToggleStar: () => void;
}) {
  const Icon = tool.icon;
  const scheme = DEFAULT_SCHEME;

  const content = (
    <motion.div variants={boardItem} className="h-full">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
        className={cn(
          'group relative h-full rounded-2xl border p-5 cursor-pointer transition-all duration-200 overflow-hidden',
          scheme.background,
          scheme.border,
          starred ? 'border-amber-400/45 hover:border-amber-400/60' : scheme.borderHover,
        )}
        style={{
          boxShadow: scheme.shadow,
          ...(starred ? STARRED_FEATURED_PATTERN : {}),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = scheme.shadowHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = scheme.shadow;
        }}
      >
        <StarButton
          path={tool.path}
          name={tool.name}
          starred={starred}
          mandatory={mandatory}
          onToggle={onToggleStar}
          variant="featured"
        />
        <div className="flex items-start justify-between h-full gap-4 relative pr-7">
          <div className="min-w-0">
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-colors',
                scheme.iconWrap,
                scheme.iconWrapHover,
              )}
            >
              <Icon className={cn('w-5 h-5 transition-colors', scheme.iconColor)} />
            </div>
            <h3 className={cn('text-base font-semibold mb-1', scheme.title)}>{tool.name}</h3>
            <p className={cn('text-sm leading-relaxed', scheme.description)}>{tool.description}</p>
          </div>
          <ChevronRight
            className={cn(
              'w-5 h-5 shrink-0 self-center transition-all duration-200 group-hover:translate-x-0.5',
              scheme.chevron,
              scheme.chevronHover,
            )}
          />
        </div>
      </motion.div>
    </motion.div>
  );

  if (tool.external) {
    return (
      <a href={tool.path} target="_blank" rel="noopener noreferrer" className="h-full block">
        {content}
      </a>
    );
  }
  return (
    <Link href={tool.path} className="h-full block">
      {content}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type SubStepResult = {
  parent: ToolCard;
  name: string;
  path: string;
  description?: string;
};

export default function ToolboxBoard() {
  const [search, setSearch] = useState('');
  const { isStarred, isMandatory, toggle } = useFavoriteTools();
  const { includeSubSteps, toggle: toggleSubSteps } = useSubStepSearchToggle();

  // Match on the visible name only. Searching "convert" should return
  // Convert to L1 / Format Converter / Unit Converter — not every tool
  // whose description happens to contain "encrypted" or "deploy". Tight
  // matches > broad matches for a tool catalog.
  const filtered = useMemo(() => {
    if (!search.trim()) return TOOLS;
    const q = search.toLowerCase();
    return TOOLS.filter((t) => t.name.toLowerCase().includes(q));
  }, [search]);

  const filteredSubSteps = useMemo<SubStepResult[]>(() => {
    if (!includeSubSteps || !search.trim()) return [];
    const q = search.toLowerCase();
    return TOOLS.flatMap((tool) => (tool.subSteps ?? []).map((step) => ({ parent: tool, ...step }))).filter((step) =>
      step.name.toLowerCase().includes(q),
    );
  }, [includeSubSteps, search]);

  // Bucket sub-step results by their parent's category so the Sub-steps
  // section reads with the same Permissioned / Permissionless / etc.
  // structure as the top-level grid above. Without this, sub-steps from
  // unrelated flows pile into a single grid and the user has to read
  // every "Add Validator › …" / "Stake › …" prefix to find their category.
  const groupedSubSteps = useMemo(() => {
    if (filteredSubSteps.length === 0) return [];
    const map = new Map<string, SubStepResult[]>();
    for (const step of filteredSubSteps) {
      const cat = step.parent.category;
      const existing = map.get(cat) ?? [];
      existing.push(step);
      map.set(cat, existing);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      steps: map.get(c)!,
    }));
  }, [filteredSubSteps]);

  const grouped = useMemo(() => {
    const map = new Map<string, ToolCard[]>();
    for (const tool of filtered) {
      const existing = map.get(tool.category) ?? [];
      existing.push(tool);
      map.set(tool.category, existing);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      tools: map.get(c)!,
    }));
  }, [filtered]);

  return (
    <div className="relative -m-4 md:-m-8 p-4 md:p-8" style={{ minHeight: 'calc(100vh - var(--header-height, 3rem))' }}>
      {/* Grid background — matches the console homepage */}
      <div
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(148 163 184 / 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(148 163 184 / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Toolbox</h1>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">Every Console tool in one place.</p>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search tools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm pl-9 pr-9 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-600/40 focus:border-zinc-500 dark:focus:border-zinc-500 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Inline filter chip — sits on the same row as the search input
                so it reads as a search refinement, not a separate control.
                Full label on desktop so the affordance is self-explanatory;
                icon-only on narrow screens to keep the row compact. Radix
                tooltip carries a fuller explanation on hover. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleSubSteps}
                  aria-pressed={includeSubSteps}
                  aria-label={
                    includeSubSteps ? 'Hide sub-steps from search results' : 'Include sub-steps in search results'
                  }
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors',
                    includeSubSteps
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-300 bg-white/80 text-zinc-600 hover:text-zinc-900 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:border-zinc-600',
                  )}
                >
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Include sub-steps</span>
                  <span className="sm:hidden">Sub-steps</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {includeSubSteps
                  ? 'Sub-steps are included. Search will surface individual steps inside multi-step flows (e.g. “Convert to L1” step inside Create L1).'
                  : 'Search inside multi-step flows. Lets you find a single step (e.g. “Initialize Validator Set”) without going through the parent flow.'}
              </TooltipContent>
            </Tooltip>
          </div>
        </motion.div>

        {/* Results */}
        {grouped.length === 0 && filteredSubSteps.length === 0 ? (
          <div className="py-24 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
              <Search className="h-5 w-5 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No tools match &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          // `initial={false}` skips the hidden→visible transform on first
          // mount. Without this, a hydration mismatch under React 18 strict
          // mode left tiles stuck at the `hidden` opacity:0 state and the
          // toolbox rendered empty even though grouping produced rows.
          <motion.div className="space-y-10" variants={boardContainer} initial={false} animate="visible">
            {grouped.map(({ category, tools }) => {
              // Keep the same hierarchy during search. If the category's
              // featured tool is part of the filtered result, it stays large
              // instead of switching into a separate "search mode" layout.
              const featured = tools.find((t) => t.featured);
              const rest = featured ? tools.filter((t) => t !== featured) : tools;

              return (
                <section key={category}>
                  {/* Section header — mimics the homepage's "Built on Avalanche" bar */}
                  <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{category}</h2>
                    <div className="h-px flex-1 bg-zinc-200/80 dark:bg-zinc-800" />
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                      {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
                    </span>
                  </div>

                  {featured ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2 md:row-span-2">
                        <FeaturedTile
                          tool={featured}
                          starred={isStarred(featured.path)}
                          mandatory={isMandatory(featured.path)}
                          onToggleStar={() => toggle(featured.path)}
                        />
                      </div>
                      {rest.map((tool) => (
                        <ToolTile
                          key={tool.path + tool.name}
                          tool={tool}
                          starred={isStarred(tool.path)}
                          mandatory={isMandatory(tool.path)}
                          onToggleStar={() => toggle(tool.path)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {rest.map((tool) => (
                        <ToolTile
                          key={tool.path + tool.name}
                          tool={tool}
                          starred={isStarred(tool.path)}
                          mandatory={isMandatory(tool.path)}
                          onToggleStar={() => toggle(tool.path)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {groupedSubSteps.length > 0 && (
              <section>
                {/* Top-level Sub-steps banner — total count, plus a bold
                    visual break from the Tools sections above. */}
                <div className="mb-5 flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Sub-steps</h2>
                  <div className="h-px flex-1 bg-zinc-200/80 dark:bg-zinc-800" />
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                    {filteredSubSteps.length} {filteredSubSteps.length === 1 ? 'step' : 'steps'}
                  </span>
                </div>
                {/* One nested block per category — same hierarchy as the
                    top-level grid so users can pattern-match between the
                    two halves of the page. */}
                <div className="space-y-7">
                  {groupedSubSteps.map(({ category, steps }) => (
                    <div key={category}>
                      <div className="mb-3 flex items-center gap-3 pl-3">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          {category}
                        </h3>
                        <div className="h-px flex-1 bg-zinc-200/60 dark:bg-zinc-800/70" />
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                          {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {steps.map((step) => (
                          <SubStepTile key={step.path} step={step} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        )}

        {/* Footer count */}
        {grouped.length > 0 || filteredSubSteps.length > 0 ? (
          <div className="mt-12 text-center text-xs text-zinc-400 dark:text-zinc-500">
            {filtered.length + filteredSubSteps.length}{' '}
            {filtered.length + filteredSubSteps.length === 1 ? 'result' : 'results'} across {grouped.length}{' '}
            {grouped.length === 1 ? 'category' : 'categories'}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SubStepTile({ step }: { step: SubStepResult }) {
  const Icon = step.parent.icon;
  return (
    <Link href={step.path} className="group block h-full">
      <motion.div variants={boardItem} className="h-full">
        <div className="h-full rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-3 py-2.5 hover:border-zinc-300 dark:hover:border-zinc-700 hover:-translate-y-px hover:shadow-sm transition-all duration-150">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{step.parent.name} ›</p>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{step.name}</h3>
              {step.description && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{step.description}</p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
