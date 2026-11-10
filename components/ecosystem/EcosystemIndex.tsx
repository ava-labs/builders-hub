import { ArrowRight, ArrowUpRight } from 'lucide-react';
import SheetBackdrop from '@/components/landing-v2/SheetBackdrop';
import { HoverPrefetchLink } from '@/components/landing-v2/HoverPrefetchLink';
import { Reveal } from '@/components/landing-v2/SpecKit';
import type { EcosystemFigures } from '@/server/services/ecosystem';
import EcosystemHero from './EcosystemHero';
import { ECOSYSTEM_GROUPS, type EcosystemEntry } from './entries';

/* ------------------------------------------------------------------ */
/* /ecosystem: every item of the Ecosystem menu as one index           */
/*                                                                      */
/* The /solutions sheet (90rem column, hairline edges, the snow         */
/* lattice in the margins) and the pillar pages' resource index: a      */
/* group per menu column, a row per item. Each row says what the page   */
/* is, quotes its live figure when the page has one, and opens it.      */
/* ------------------------------------------------------------------ */

type Figure = { label: string; value: string; detail?: string };

/** A date in the event's own time zone, or UTC when the zone is unknown. */
function formatDate(iso: string, timeZone = 'UTC'): string {
  const options = { month: 'short', day: 'numeric', year: 'numeric' } as const;
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(iso));
  }
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** The host and path a visitor lands on, without the tracking query. */
function siteOf(href: string): string {
  const url = new URL(href);
  return `${url.host.replace(/^www\./, '')}${url.pathname === '/' ? '' : url.pathname}`;
}

function figureOf(entry: EcosystemEntry, figures: EcosystemFigures): Figure | null {
  if (entry.external) return { label: 'External site', value: siteOf(entry.href) };
  switch (entry.figure) {
    case 'events': {
      const events = figures.events;
      if (!events) return null;
      const ongoing = events.ongoing > 0 ? plural(events.ongoing, 'event', 'events') + ' ongoing' : undefined;
      if (events.next) {
        const date = formatDate(events.next.startDate, events.next.timezone);
        return { label: 'Next event', value: events.next.title, detail: ongoing ? `${date} · ${ongoing}` : date };
      }
      return events.ongoing > 0 ? { label: 'Ongoing', value: plural(events.ongoing, 'event', 'events') } : null;
    }
    case 'auditFirms':
      return figures.auditFirms ? { label: 'Vetted firms', value: figures.auditFirms.toLocaleString('en-US') } : null;
    case 'latestPost':
      return figures.latestPost
        ? { label: 'Latest article', value: figures.latestPost.title, detail: formatDate(figures.latestPost.date) }
        : null;
    case 'integrations':
      return figures.integrations
        ? {
            label: 'Listed',
            value: plural(figures.integrations.count, 'integration', 'integrations'),
            detail: plural(figures.integrations.categories, 'category', 'categories'),
          }
        : null;
    default:
      return null;
  }
}

export default function EcosystemIndex({ figures }: { figures: EcosystemFigures }) {
  return (
    // a div, not a main: the site layout already renders the page's main
    <div className="relative overflow-x-clip bg-white dark:bg-zinc-950">
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white px-5 pb-24 pt-14 md:px-6 md:pt-20 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
        <EcosystemHero />

        <section aria-label="Ecosystem overview" className="mt-14 md:mt-20">
          {ECOSYSTEM_GROUPS.map((group, i) => (
            <Reveal key={group.id} id={group.id} className="scroll-mt-32">
              <div
                className={`grid gap-6 border-t border-zinc-900 pt-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20 lg:pt-0 dark:border-zinc-100 ${
                  i < ECOSYSTEM_GROUPS.length - 1 ? 'pb-12 md:pb-16' : ''
                }`}
              >
                {/* lg:pt-7 sets the numeral on the first row's line */}
                <div className="lg:pt-7">
                  <p
                    aria-hidden
                    className="font-mono text-[11px] tabular-nums tracking-[0.16em] text-zinc-400 dark:text-zinc-500"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h2 className="v2-heading mt-3 text-3xl text-zinc-900 md:text-[2.5rem] dark:text-zinc-50">
                    {group.title}
                    <span aria-hidden className="text-[#E6212F]">
                      .
                    </span>
                  </h2>
                </div>
                <ul>
                  {group.entries.map((entry) => (
                    <li key={entry.href} className="border-b border-zinc-200 dark:border-zinc-800">
                      <Row entry={entry} figure={figureOf(entry, figures)} />
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </section>
      </div>
    </div>
  );
}

const ROW =
  'group relative grid gap-x-10 gap-y-4 py-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_1rem] md:items-center md:py-7 dark:focus-visible:outline-zinc-100';

function Row({ entry, figure }: { entry: EcosystemEntry; figure: Figure | null }) {
  const Arrow = entry.external ? ArrowUpRight : ArrowRight;
  const body = (
    <>
      {/* the pillar index's hover mark: a red rule grows on the left edge (keyboard focus too) */}
      <span
        aria-hidden
        className="absolute -left-4 bottom-5 top-5 hidden w-0.5 origin-top scale-y-0 bg-[#E6212F] transition-transform duration-300 group-hover:scale-y-100 group-focus-visible:scale-y-100 lg:block"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[19px] font-medium tracking-[-0.01em] text-zinc-900 transition-transform duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1 md:text-xl dark:text-zinc-50">
          {entry.title}
          {entry.badge && (
            <span className="border border-brand/40 px-1.5 py-px font-mono text-[9px] font-normal uppercase tracking-[0.1em] text-brand dark:border-brand-soft/40 dark:text-brand-soft">
              {entry.badge}
            </span>
          )}
          {/* phones have no arrow column: the arrow follows the title */}
          <Arrow aria-hidden className="h-4 w-4 shrink-0 text-zinc-400 md:hidden dark:text-zinc-500" />
        </span>
        <span className="mt-1.5 block max-w-xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {entry.line}
        </span>
      </span>
      {figure ? (
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {figure.label}
          </span>
          {/* live figures in full ink; an external site's host stays quiet */}
          <span
            className={`line-clamp-3 text-pretty text-[15px] leading-snug tabular-nums ${
              entry.external ? 'text-zinc-500 dark:text-zinc-400' : 'font-medium text-zinc-900 dark:text-zinc-100'
            }`}
          >
            {figure.value}
          </span>
          {figure.detail && (
            <span className="font-mono text-[11px] tabular-nums tracking-[0.04em] text-zinc-500 dark:text-zinc-400">
              {figure.detail}
            </span>
          )}
        </span>
      ) : (
        <span aria-hidden className="hidden md:block" />
      )}
      <Arrow
        aria-hidden
        className="hidden h-4 w-4 text-zinc-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#E6212F] group-focus-visible:translate-x-0.5 group-focus-visible:text-[#E6212F] md:block dark:text-zinc-600"
      />
    </>
  );

  if (entry.external) {
    return (
      <a href={entry.href} target="_blank" rel="noreferrer noopener" className={ROW}>
        {body}
      </a>
    );
  }
  return (
    <HoverPrefetchLink href={entry.href} className={ROW}>
      {body}
    </HoverPrefetchLink>
  );
}
