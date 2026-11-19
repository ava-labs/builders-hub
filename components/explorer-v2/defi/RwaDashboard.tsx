"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveDot, SectionHeader } from "@/components/explorer-v2/ui";
import { dayShort } from "@/components/explorer-v2/format";
import { StickyNavBar } from "@/components/stats/StickyNavBar";
import { useSectionNavigation } from "@/hooks/use-section-navigation";
import { isLineFacility } from "@/lib/rwa/facilities";
import { firstDay } from "@/lib/rwa/series";
import type { FacilityMetrics, FenceHistoricalData, FenceMetrics, HistoricalData } from "@/lib/rwa/types";
import { isLineMetrics } from "@/lib/rwa/utils";
import { CHIP, OFF } from "./ProtocolFilters";
import { DEFI_SCOPE, DEFI_STYLE } from "./palette";
import { FacilityFigures, KeyMetrics, LineKeyMetrics, OatFiBreakdown, PartnerLogos, fenceAsOfDay } from "./rwa-parts";
import { CapitalFlow } from "./rwa-flow";
import { ExportMenu } from "./rwa-export";
import { RwaCollections } from "./RwaCollections";
import { RwaIncidentBanner } from "./rwa-incident";
import { RwaHistory } from "./RwaHistory";
import { RwaTransactions } from "./RwaTransactions";
import type { RwaView } from "./rwa-views";

/* A facility's dashboard, laid out as the old one laid out the Valinor x
   OatFi x Fence pilot, in the explorer's chrome; its copy comes from the
   facility's view (rwa-views.ts). The title with the partners and the live
   line; a section rail that sticks under the explorer's own subnav and
   carries the export menu and a refresh (on a phone the two sit under the
   title); then OatFi's key metrics, its breakdown and Fence's facility
   figures with the collections over time, or a line of credit's key
   metrics; the capital flow pipeline, the historical trends and the
   ledger. Each chart section keeps its own interval and range. */

export interface RwaFeeds {
  metrics: FacilityMetrics | null;
  metricsFailed: boolean;
  historical: HistoricalData | null;
  historicalFailed: boolean;
  fence: FenceMetrics | null;
  fenceFailed: boolean;
  fenceHistory: FenceHistoricalData | null;
  fenceHistoryFailed: boolean;
}

/** the element the PDF report and the image capture */
const CONTENT_ID = "rwa-dashboard-content";
/* the rail's top before the explorer subnav is measured: the navbar's 56px and the subnav's one-row height */
const RAIL_TOP = 56 + 45;
/* the rail's own height and a breath under it, so a section scrolled to lands below the rail, not behind it */
const RAIL_CLEARANCE = 60;
/* the reader's own time, with its zone named: the ledger and Fence's as-of day read in UTC */
const UPDATED = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const NOTE = "font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";

/** where the section rail sticks: right under the explorer's sticky subnav, which grows when its tabs wrap */
function useRailTop(): number {
  const [top, setTop] = useState(RAIL_TOP);
  useEffect(() => {
    const subnav = document.querySelector<HTMLElement>("[data-explorer-subnav]");
    if (!subnav) return;
    const measure = () => setTop(parseFloat(getComputedStyle(subnav).top) + subnav.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(subnav);
    return () => observer.disconnect();
  }, []);
  return top;
}

function Actions({ slug, feeds, onRefresh }: { slug: string; feeds: RwaFeeds; onRefresh: () => Promise<unknown> }) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <ExportMenu slug={slug} metrics={feeds.metrics} historical={feeds.historical} target={CONTENT_ID} />
      <button type="button" onClick={refresh} disabled={refreshing} className={cn(CHIP, OFF, "uppercase tracking-[0.1em]")}>
        <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} strokeWidth={1.75} />
        Refresh
      </button>
    </div>
  );
}

function Header({ view, metrics }: { view: RwaView; metrics: FacilityMetrics | null }) {
  return (
    // a div, not a header: the site's stylesheet pads every header > div by 3rem
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-[26px] dark:text-zinc-50">{view.title}</h1>
        <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{view.subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PartnerLogos partners={view.partners} />
        {metrics && (
          <p aria-live="polite" className="flex items-center gap-2 font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">
            <LiveDot />
            Updated {UPDATED.format(new Date(metrics.lastUpdated))} · every 5 min
          </p>
        )}
      </div>
    </div>
  );
}

export function RwaDashboard({ view, feeds, onRefresh }: { view: RwaView; feeds: RwaFeeds; onRefresh: () => Promise<unknown> }) {
  const top = useRailTop();
  const { activeSection, scrollToSection } = useSectionNavigation({ categories: view.sections, offset: top + RAIL_CLEARANCE, initialSection: "rwa-metrics", updateHash: false });
  const line = isLineFacility(view.facility);
  // the figures in each facility's own shape: a line of credit's, or OatFi's with its breakdown
  const lineMetrics = feeds.metrics && isLineMetrics(feeds.metrics) ? feeds.metrics : null;
  const poolMetrics = feeds.metrics && !isLineMetrics(feeds.metrics) ? feeds.metrics : null;
  // the facility's first day: OatFi's first tranche to borrower transfer, a line's first draw
  const since = feeds.historical ? firstDay(feeds.historical.assetsFinanced) : null;
  const asOf = fenceAsOfDay(feeds.fence);
  const actions = <Actions slug={view.facility.slug} feeds={feeds} onRefresh={onRefresh} />;

  return (
    <div className={`${DEFI_SCOPE} flex flex-col gap-8`}>
      <style>{DEFI_STYLE}</style>
      <RwaIncidentBanner facilityPool={view.facility.pool.address} />
      <Header view={view} metrics={feeds.metrics} />
      {/* the rail bleeds across the shell's padding like the subnav above it, so nothing peeks past its edges */}
      <StickyNavBar
        categories={view.sections}
        activeSection={activeSection}
        onNavigate={scrollToSection}
        inset={false}
        style={{ top }}
        className="-mx-5 hidden w-auto px-5 md:-mx-6 md:block md:px-6"
      >
        {actions}
      </StickyNavBar>
      <div className="flex justify-end md:hidden">{actions}</div>

      <div id={CONTENT_ID} className="flex flex-col gap-12" aria-busy={!feeds.metrics && !feeds.metricsFailed}>
        {line ? (
          <LineKeyMetrics metrics={lineMetrics} failed={feeds.metricsFailed} />
        ) : (
          <>
            <KeyMetrics metrics={poolMetrics} failed={feeds.metricsFailed} />
            <OatFiBreakdown metrics={poolMetrics} failed={feeds.metricsFailed} />
            {view.facility.features.fence && (
              <section id="rwa-fence" className="flex scroll-mt-40 flex-col gap-5">
                <SectionHeader label="Facility Performance" action={asOf ? <span className={NOTE}>as of {dayShort(asOf)}</span> : undefined} />
                <FacilityFigures fence={feeds.fence} failed={feeds.fenceFailed} />
                <RwaCollections history={feeds.fenceHistory} failed={feeds.fenceHistoryFailed} />
              </section>
            )}
          </>
        )}
        <CapitalFlow copy={view.flow} metrics={feeds.metrics} since={since} failed={feeds.metricsFailed} />
        <RwaHistory historical={feeds.historical} failed={feeds.historicalFailed} volume={!line} />
        {/* keyed by facility, so a cut or a full read never carries from one facility's ledger to another's */}
        <RwaTransactions key={view.facility.slug} slug={view.facility.slug} ledger={view.ledger} />
        <p className="font-mono text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">{view.source}</p>
      </div>
    </div>
  );
}
