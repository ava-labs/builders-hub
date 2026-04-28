'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, X, ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOOLS, CATEGORY_ORDER, type ToolCard } from './tools';

// Framer variants — staggered children entrance matching console homepage.
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 240, damping: 22 },
  },
};

// ---------------------------------------------------------------------------
// ToolTile — matches homepage BentoCard geometry: rounded-2xl, soft shadow,
// icon tile in the top-left, name + description, chevron on hover.
// ---------------------------------------------------------------------------

function ToolTile({ tool }: { tool: ToolCard }) {
  const Icon = tool.icon;

  const card = (
    <motion.div variants={itemVariants} className="h-full">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
        className={cn(
          'group relative h-full rounded-2xl border p-4 cursor-pointer transition-all duration-200',
          'border-zinc-200/80 dark:border-zinc-800',
          'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm',
          'hover:border-zinc-300 dark:hover:border-zinc-700',
        )}
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)';
        }}
      >
        <div className="flex items-start gap-3">
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
// FeaturedTile — larger accented card for the one "headline" tool per category.
// Each category gets a distinct color scheme so featured tiles don't visually
// merge with each other (or with the homepage's Create L1 hero).
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

const FEATURED_SCHEMES: Record<string, FeaturedScheme> = {
  // Primary Network — Avalanche red (matches primary network branding)
  'Primary Network': {
    background: 'bg-gradient-to-br from-red-950 via-rose-950 to-zinc-950',
    border: 'border-red-900/60',
    borderHover: 'hover:border-red-800',
    iconWrap: 'bg-red-500/15',
    iconWrapHover: 'group-hover:bg-red-500/25',
    iconColor: 'text-red-300 group-hover:text-red-200',
    title: 'text-white',
    description: 'text-red-100/70',
    chevron: 'text-red-400/60',
    chevronHover: 'group-hover:text-red-200',
    shadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(127,29,29,0.25), 0 8px 24px rgba(127,29,29,0.18)',
    shadowHover:
      'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 4px 12px rgba(127,29,29,0.35), 0 16px 40px rgba(127,29,29,0.25)',
  },
  // Create & Deploy — indigo/violet (launching something new)
  'Create & Deploy': {
    background: 'bg-gradient-to-br from-indigo-950 via-violet-950 to-zinc-950',
    border: 'border-indigo-900/60',
    borderHover: 'hover:border-indigo-800',
    iconWrap: 'bg-indigo-500/15',
    iconWrapHover: 'group-hover:bg-indigo-500/25',
    iconColor: 'text-indigo-300 group-hover:text-indigo-200',
    title: 'text-white',
    description: 'text-indigo-100/70',
    chevron: 'text-indigo-400/60',
    chevronHover: 'group-hover:text-indigo-200',
    shadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(49,46,129,0.25), 0 8px 24px rgba(49,46,129,0.18)',
    shadowHover:
      'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 4px 12px rgba(49,46,129,0.35), 0 16px 40px rgba(49,46,129,0.25)',
  },
  // Interchain Messaging — emerald/teal (connection, cross-chain flow)
  'Interchain Messaging': {
    background: 'bg-gradient-to-br from-emerald-950 via-teal-950 to-zinc-950',
    border: 'border-emerald-900/60',
    borderHover: 'hover:border-emerald-800',
    iconWrap: 'bg-emerald-500/15',
    iconWrapHover: 'group-hover:bg-emerald-500/25',
    iconColor: 'text-emerald-300 group-hover:text-emerald-200',
    title: 'text-white',
    description: 'text-emerald-100/70',
    chevron: 'text-emerald-400/60',
    chevronHover: 'group-hover:text-emerald-200',
    shadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(6,78,59,0.25), 0 8px 24px rgba(6,78,59,0.18)',
    shadowHover:
      'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 4px 12px rgba(6,78,59,0.35), 0 16px 40px rgba(6,78,59,0.25)',
  },
  // Encrypted ERC — fuchsia/purple (cryptography, privacy). Distinct from
  // ICM's emerald even though both touch on "privacy" semantically — ICM
  // is "messages between chains", eERC is "values hidden on a chain".
  'Encrypted ERC': {
    background: 'bg-gradient-to-br from-fuchsia-950 via-purple-950 to-zinc-950',
    border: 'border-fuchsia-900/60',
    borderHover: 'hover:border-fuchsia-800',
    iconWrap: 'bg-fuchsia-500/15',
    iconWrapHover: 'group-hover:bg-fuchsia-500/25',
    iconColor: 'text-fuchsia-300 group-hover:text-fuchsia-200',
    title: 'text-white',
    description: 'text-fuchsia-100/70',
    chevron: 'text-fuchsia-400/60',
    chevronHover: 'group-hover:text-fuchsia-200',
    shadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(86,12,86,0.25), 0 8px 24px rgba(86,12,86,0.18)',
    shadowHover:
      'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 4px 12px rgba(86,12,86,0.35), 0 16px 40px rgba(86,12,86,0.25)',
  },
};

// Fallback scheme matches the original dark zinc look.
const DEFAULT_SCHEME: FeaturedScheme = {
  background: 'bg-zinc-800',
  border: 'border-zinc-700',
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

function FeaturedTile({ tool }: { tool: ToolCard }) {
  const Icon = tool.icon;
  const scheme = FEATURED_SCHEMES[tool.category] ?? DEFAULT_SCHEME;

  const content = (
    <motion.div variants={itemVariants} className="h-full">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
        className={cn(
          'group relative h-full rounded-2xl border p-5 cursor-pointer transition-all duration-200 overflow-hidden',
          scheme.background,
          scheme.border,
          scheme.borderHover,
        )}
        style={{ boxShadow: scheme.shadow }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = scheme.shadowHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = scheme.shadow;
        }}
      >
        <div className="flex items-start justify-between h-full gap-4 relative">
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

export default function ToolboxBoard() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return TOOLS;
    const q = search.toLowerCase();
    return TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [search]);

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

  const isSearching = search.trim().length > 0;

  return (
    <div className="relative -m-8 p-8" style={{ minHeight: 'calc(100vh - var(--header-height, 3rem))' }}>
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

          <div className="relative w-full sm:w-80">
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
        </motion.div>

        {/* Results */}
        {grouped.length === 0 ? (
          <div className="py-24 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
              <Search className="h-5 w-5 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No tools match &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <motion.div className="space-y-10" variants={containerVariants} initial="hidden" animate="visible">
            {grouped.map(({ category, tools }) => {
              // Don't hero-promote the featured tile while a search is active —
              // it would visually dominate filtered results. Use a uniform grid
              // of tiles so matches are easy to compare at a glance.
              const featured = !isSearching ? tools.find((t) => t.featured) : undefined;
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
                        <FeaturedTile tool={featured} />
                      </div>
                      {rest.map((tool) => (
                        <ToolTile key={tool.path + tool.name} tool={tool} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {rest.map((tool) => (
                        <ToolTile key={tool.path + tool.name} tool={tool} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </motion.div>
        )}

        {/* Footer count */}
        {grouped.length > 0 && (
          <div className="mt-12 text-center text-xs text-zinc-400 dark:text-zinc-500">
            {filtered.length} {filtered.length === 1 ? 'tool' : 'tools'} across {grouped.length}{' '}
            {grouped.length === 1 ? 'category' : 'categories'}
          </div>
        )}
      </div>
    </div>
  );
}
