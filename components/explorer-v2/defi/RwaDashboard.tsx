"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveDot, SectionHeader } from "@/components/explorer-v2/ui";
import { dayShort } from "@/components/explorer-v2/format";
import { StickyNavBar } from "@/components/stats/StickyNavBar";
import { useSectionNavigation, type NavCategory } from "@/hooks/use-section-navigation";
import { firstDay } from "@/lib/rwa/series";
import type { AllMetrics, FenceHistoricalData, FenceMetrics, HistoricalData } from "@/lib/rwa/types";
import { CHIP, OFF } from "./ProtocolFilters";
import { DEFI_SCOPE, DEFI_STYLE } from "./palette";
import { FacilityFigures, KeyMetrics, OatFiBreakdown, PartnerLogos, fenceAsOfDay } from "./rwa-parts";
import { CapitalFlow } from "./rwa-flow";
import { ExportMenu } from "./rwa-export";
import { RwaCollections } from "./RwaCollections";
import { RwaHistory } from "./RwaHistory";
import { RwaTransactions } from "./RwaTransactions";

/* The Valinor x OatFi x Fence pilot as the old dashboard laid it out, in
   the explorer's chrome: the title with the partners and the live line; a
   section rail that sticks under the explorer's own subnav and carries the
   export menu and a refresh (on a phone the two sit under the title); then
   the key metrics, the OatFi breakdown, Fence's facility figures with the
   collections over time, the capital flow pipeline, the historical trends
   and every transfer. Each chart section keeps its own interval and range. */

export interface RwaFeeds {
  metrics: AllMetrics | null;
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
const SECTIONS: NavCategory[] = [
  { id: "rwa-metrics", label: "Metrics" },
  { id: "rwa-oatfi", label: "OatFi" },
  { id: "rwa-fence", label: "Facility" },
  { id: "rwa-capital-flow", label: "Capital Flow" },
  { id: "rwa-historical", label: "Historical" },
  { id: "rwa-transactions", label: "Transactions" },
];
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

function Header({ metrics }: { metrics: AllMetrics | null }) {
  return (
    // a div, not a header: the site's stylesheet pads every header > div by 3rem
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-[26px] dark:text-zinc-50">Valinor × OatFi × Fence Pilot</h1>
        <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">SPV capital flow dashboard on Avalanche C-Chain</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PartnerLogos />
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

export function RwaDashboard({ slug, feeds, onRefresh }: { slug: string; feeds: RwaFeeds; onRefresh: () => Promise<unknown> }) {
  const top = useRailTop();
  const { activeSection, scrollToSection } = useSectionNavigation({ categories: SECTIONS, offset: top + RAIL_CLEARANCE, initialSection: "rwa-metrics", updateHash: false });
  // the pool's first day is its first tranche to borrower transfer
  const since = feeds.historical ? firstDay(feeds.historical.assetsFinanced) : null;
  const asOf = fenceAsOfDay(feeds.fence);
  const actions = <Actions slug={slug} feeds={feeds} onRefresh={onRefresh} />;

  return (
    <div className={`${DEFI_SCOPE} flex flex-col gap-8`}>
      <style>{DEFI_STYLE}</style>
      <Header metrics={feeds.metrics} />
      {/* the rail bleeds across the shell's padding like the subnav above it, so nothing peeks past its edges */}
      <StickyNavBar
        categories={SECTIONS}
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
        <KeyMetrics metrics={feeds.metrics} failed={feeds.metricsFailed} />
        <OatFiBreakdown metrics={feeds.metrics} failed={feeds.metricsFailed} />
        <section id="rwa-fence" className="flex scroll-mt-40 flex-col gap-5">
          <SectionHeader label="Facility Performance" action={asOf ? <span className={NOTE}>as of {dayShort(asOf)}</span> : undefined} />
          <FacilityFigures fence={feeds.fence} failed={feeds.fenceFailed} />
          <RwaCollections history={feeds.fenceHistory} failed={feeds.fenceHistoryFailed} />
        </section>
        <CapitalFlow metrics={feeds.metrics} since={since} failed={feeds.metricsFailed} />
        <RwaHistory historical={feeds.historical} failed={feeds.historicalFailed} />
        <RwaTransactions slug={slug} />
        <p className="font-mono text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          USDC transfers, native and bridged, of the tranche pool, the borrower&apos;s operating wallet and the two lenders, indexed from the C-Chain. The facility
          figures come from Fence and refresh every 30 minutes.
        </p>
      </div>
    </div>
  );
}
