"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  GitHubIcon,
  GlobeIcon,
  LinkedInIcon,
  LinkIcon,
  SparkleIcon,
  TelegramIcon,
  TrophyIcon,
  XIcon,
} from "./icons";
import type {
  BuilderInsightsData,
  DailyPoint,
  ReferralPeriodData,
  SocialPlatform,
} from "@/server/services/builderInsights";
import {
  countryNameToFlag,
  flagEmoji,
  formatHackathonRange,
  formatNumber,
  initials,
  toTitleCase,
} from "./insights/formatters";

interface Props {
  data: BuilderInsightsData | null;
  loading: boolean;
  error?: string | null;
}

type ChartKey = "signups" | "visits" | "console" | "all";
type GranularityKey = "day" | "month";
type LeaderboardKey = "people" | "teams";
type EventSortKey = "recent" | "top";
type CompletionKey = "platform" | "depth";

const ACCENT_SIGNUPS = "#E84142";
const ACCENT_VISITS = "#7FA6FF";
const ACCENT_CONSOLE = "#B88DFF";

// Per-platform accents for the profile-completion bars — neon variants in
// line with the shell's vivid tokens (--pr-avax-hover, --pr-success-main).
const PLATFORM_ACCENT: Record<SocialPlatform, string> = {
  x: "#ff5658",
  linkedin: "#38bdf8",
  github: "#c084fc",
  telegram: "#9be055",
};

// Soft glow behind neon fills, matching the shell's glowing-dot treatment
// (e.g. the devrel badge). Skipped for CSS-var colors (can't carry alpha).
function neonGlow(accent: string, blur = 8): string | undefined {
  return accent.startsWith("#") ? `0 0 ${blur}px ${accent}73` : undefined;
}

function PlatformIcon({
  platform,
  size = 15,
}: {
  platform: SocialPlatform;
  size?: number;
}) {
  switch (platform) {
    case "x":
      return <XIcon size={size} />;
    case "linkedin":
      return <LinkedInIcon size={size} />;
    case "github":
      return <GitHubIcon size={size} />;
    case "telegram":
      return <TelegramIcon size={size} />;
  }
}

// Completion-quality heat scale for the depth view: gray (no links) through
// the shell's neon red / amber / limes (--pr-warning-main, --pr-success-main).
const DEPTH_ACCENT: Record<number, string> = {
  0: "var(--pr-g-650)",
  1: "#ff5658",
  2: "#fdc85d",
  3: "#b9eb7c",
  4: "#9be055",
};

export function InsightsCard({ data, loading, error }: Props) {
  return (
    <div className="pr-card">
      <div className="pr-head">
        <div
          className="pr-ico"
          style={{
            background: "var(--pr-primary-light)",
            color: "var(--pr-accent-main)",
          }}
        >
          <GlobeIcon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>Builder Insights</h3>
          <div className="pr-desc">
            Growth, engagement, and referral attribution across Builder Hub —
            last 30 days vs. previous 30.
          </div>
        </div>
      </div>
      <div className="pr-body">
        {error ? (
          <div className="pr-empty">{error}</div>
        ) : loading || !data ? (
          <div className="pr-insights__loading">
            <div className="pr-insights__loading-spinner" />
            <span>Loading Builder Insights…</span>
          </div>
        ) : (
          <InsightsBody data={data} />
        )}
      </div>
    </div>
  );
}

function InsightsBody({ data }: { data: BuilderInsightsData }) {
  return (
    <div className="pr-insights">
      <KPIStrip data={data} />
      <ChartSection data={data} />
      <ProfileCompletionSection data={data} />
      <LeaderboardSection data={data} />
      <EventHistorySection data={data} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// KPI strip — 8 panels (same data types as the previous Insights page).
// ───────────────────────────────────────────────────────────────────────────

function KPIStrip({ data }: { data: BuilderInsightsData }) {
  return (
    <div className="pr-kpi-grid">
      {/* Row 1 — top-line Builder Hub volume */}
      <KPI
        label="Total accounts"
        value={formatNumber(data.totalAccounts)}
        sub={`+${formatNumber(data.latest30DaySignups)} this month`}
      />
      <KPI
        label="Builder Hub impact"
        value={formatNumber(data.userGeneratedReferralImpact)}
        sub="user-generated referrals"
      />
      <KPI
        label="30d signups"
        value={formatNumber(data.latest30DaySignups)}
        delta={data.rollingSignupDeltaPercent}
        sub={`vs ${formatNumber(data.previous30DaySignups)}`}
      />
      <KPI
        label="30d visits"
        value={formatNumber(data.latest30DayVisits)}
        delta={data.rollingVisitsDeltaPercent}
        sub={`vs ${formatNumber(data.previous30DayVisits)}`}
      />
      {/* Row 2 — engagement and depth */}
      <KPI
        label="Top country"
        valueSmall
        value={
          data.topCountry30d
            ? `${countryNameToFlag(data.topCountry30d.countryCode) ||
                countryNameToFlag(data.topCountry30d.country) ||
                flagEmoji(data.topCountry30d.countryCode)} ${data.topCountry30d.country}`.trim()
            : "—"
        }
        sub={
          data.topCountry30d
            ? `${data.topCountry30d.sharePct.toFixed(1)}% of 30d visits`
            : "No data yet"
        }
      />
      <KPI
        label="Hackathon submissions"
        value={formatNumber(data.totalHackathonSubmissions)}
        sub="all-time projects"
      />
      <KPI
        label="Console users"
        value={formatNumber(data.consoleUsers30d)}
        delta={data.consoleUsersDeltaPercent}
        sub="/console traffic"
      />
      <KPI
        label="Returning visitors"
        value={`${data.returningVisitorPct30d.toFixed(1)}%`}
        delta={data.returningVisitorDeltaPercent}
        sub="of 30d uniques"
      />
    </div>
  );
}

interface KPIProps {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  valueSmall?: boolean;
}

function KPI({ label, value, sub, delta, valueSmall }: KPIProps) {
  return (
    <div className="pr-kpi">
      <div className="pr-kpi__label">{label}</div>
      <div
        className={`pr-kpi__value${valueSmall ? " pr-kpi__value--small" : ""}`}
      >
        {value}
      </div>
      <div className="pr-kpi__footer">
        {typeof delta === "number" && <Delta pct={delta} />}
        {sub && <span className="pr-kpi__sub">{sub}</span>}
      </div>
    </div>
  );
}

function Delta({ pct }: { pct: number }) {
  if (!Number.isFinite(pct)) return null;
  const up = pct >= 0;
  return (
    <span
      className={`pr-kpi__delta ${up ? "pr-kpi__delta--up" : "pr-kpi__delta--down"}`}
    >
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Big chart with Signups / Visits / Console / All toggle.
// ───────────────────────────────────────────────────────────────────────────

interface Series {
  label: string;
  accent: string;
  // `bucket` is the ISO period the point falls in — "2026-11" for a month,
  // "2026-11-15" for a day. Both sort lexically, so the chart needs no
  // separate handling for the two granularities.
  data: Array<{ bucket: string; value: number }>;
}

const toDailyPoints = (rows: DailyPoint[]) =>
  rows.map((r) => ({ bucket: r.date, value: r.value }));

function ChartSection({ data }: { data: BuilderInsightsData }) {
  const [tab, setTab] = React.useState<ChartKey>("signups");
  const [granularity, setGranularity] = React.useState<GranularityKey>("month");
  const daily = granularity === "day";
  const per = daily ? "day" : "month";

  const signupsSeries: Series = React.useMemo(
    () => ({
      label: `Signups / ${per}`,
      accent: ACCENT_SIGNUPS,
      data: daily
        ? toDailyPoints(data.dailySignups)
        : data.monthlySignups.map((r) => ({ bucket: r.month, value: r.signups })),
    }),
    [daily, per, data.dailySignups, data.monthlySignups],
  );
  const visitsSeries: Series = React.useMemo(
    () => ({
      label: `Unique visitors / ${per}`,
      accent: ACCENT_VISITS,
      data: daily
        ? toDailyPoints(data.dailyVisits)
        : data.monthlyVisits.map((r) => ({ bucket: r.month, value: r.visitors })),
    }),
    [daily, per, data.dailyVisits, data.monthlyVisits],
  );
  const consoleSeries: Series = React.useMemo(
    () => ({
      label: `Console users / ${per}`,
      accent: ACCENT_CONSOLE,
      data: daily
        ? toDailyPoints(data.dailyConsoleUsers)
        : data.monthlyConsoleUsers.map((r) => ({
            bucket: r.month,
            value: r.visitors,
          })),
    }),
    [daily, per, data.dailyConsoleUsers, data.monthlyConsoleUsers],
  );

  const activeSeries: Series[] =
    tab === "signups"
      ? [signupsSeries]
      : tab === "visits"
        ? [visitsSeries]
        : tab === "console"
          ? [consoleSeries]
          : [signupsSeries, visitsSeries, consoleSeries];

  const latest = activeSeries[0]?.data.at(-1)?.value ?? 0;
  // Daily buckets are UTC days server-side (they are cached and shared across
  // viewers, so they cannot follow each viewer's zone the way the referral
  // drill-down does). Say so rather than let the two quietly disagree.
  const window = daily ? "Trailing 90 days · UTC" : "Trailing 12 months";
  const subtitle =
    tab === "all"
      ? `${window} · normalized comparison`
      : `${window} · ${formatNumber(latest)} latest`;

  return (
    <section className="pr-insights__section">
      <header className="pr-insights__heading">
        <span className="pr-insights__heading-icon">
          <GlobeIcon size={18} />
        </span>
        <h4 className="pr-insights__title">
          {tab === "all" ? "Growth signals (normalized)" : activeSeries[0]?.label}
        </h4>
        <span className="pr-insights__subtitle">{subtitle}</span>
      </header>
      <div className="pr-chart-controls">
        <Segmented<ChartKey>
          value={tab}
          onChange={setTab}
          options={[
            { value: "signups", label: "Signups" },
            { value: "visits", label: "Visits" },
            { value: "console", label: "Console" },
            { value: "all", label: "All" },
          ]}
        />
        <Segmented<GranularityKey>
          value={granularity}
          onChange={setGranularity}
          options={[
            { value: "day", label: "Day" },
            { value: "month", label: "Month" },
          ]}
        />
      </div>
      <div className="pr-chart">
        <BigChart series={activeSeries} normalized={tab === "all"} />
      </div>
    </section>
  );
}

const AXIS_TICK = {
  fontSize: 11,
  fill: "var(--pr-g-650)",
  fontFamily: "ui-monospace, monospace",
} as const;

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--pr-g-100)",
  border: "1px solid var(--pr-g-400)",
  borderRadius: 10,
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
};

function formatTick(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
}

function BigChart({
  series,
  normalized,
}: {
  series: Series[];
  normalized: boolean;
}) {
  // Merge all series onto a shared time axis so each point lands at its
  // real calendar position — series that started later (e.g. console)
  // won't be stretched to fill the whole axis.
  const rows = React.useMemo(() => {
    const byBucket = new Map<string, Record<string, string | number>>();
    for (const s of series) {
      const max = Math.max(...s.data.map((p) => p.value), 1);
      for (const p of s.data) {
        const row = byBucket.get(p.bucket) ?? { bucket: p.bucket };
        // Normalized mode plots each series as % of its own peak (single
        // shared 0–100 axis); tooltips always show the raw value.
        row[s.label] = normalized ? (p.value / max) * 100 : p.value;
        row[`${s.label}__raw`] = p.value;
        byBucket.set(p.bucket, row);
      }
    }
    return Array.from(byBucket.values()).sort((a, b) =>
      String(a.bucket).localeCompare(String(b.bucket)),
    );
  }, [series, normalized]);

  if (rows.length === 0) {
    return <div className="pr-leaderboard__empty">No data yet</div>;
  }

  const tooltipFormatter = (
    value: number | string,
    name: string | number,
    item: { payload?: Record<string, string | number> },
  ) => {
    const raw = item.payload?.[`${name}__raw`];
    return [formatNumber(Number(raw ?? value)), String(name)] as [string, string];
  };

  const common = {
    data: rows,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  };
  // NOTE: grid/axes/tooltip/legend must be DIRECT children of the chart —
  // recharts does not find components nested inside a fragment variable.
  const gridProps = {
    stroke: "var(--pr-g-300)",
    strokeDasharray: "2 4",
    vertical: false,
  };
  const xAxisProps = {
    dataKey: "bucket",
    tick: AXIS_TICK,
    // Drops the year: "2026-11" → "11", "2026-11-15" → "11-15".
    tickFormatter: (b: string) => b.slice(5),
    axisLine: false,
    tickLine: false,
    // A daily window is ~90 buckets wide; let recharts thin the labels.
    interval: "preserveStartEnd" as const,
  };
  // Normalized ("All") mode plots shapes only, like the previous chart: each
  // series scaled to its own peak, no y-axis — tooltips carry the raw values.
  const yAxisProps = {
    tick: AXIS_TICK,
    tickFormatter: formatTick,
    axisLine: false,
    tickLine: false,
    width: 44,
    hide: normalized,
    domain: normalized ? ([0, 100] as [number, number]) : undefined,
  };
  const tooltipProps = {
    contentStyle: TOOLTIP_STYLE,
    labelStyle: { color: "var(--pr-g-1000)" },
    cursor: { stroke: "var(--pr-g-400)" },
    formatter: tooltipFormatter,
  };
  const legendProps = {
    iconType: "plainline" as const,
    wrapperStyle: { fontSize: 12, fontFamily: "ui-monospace, monospace" },
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      {normalized ? (
        <LineChart {...common}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {series.map((s) => (
            <Line
              key={s.label}
              dataKey={s.label}
              stroke={s.accent}
              strokeWidth={2.25}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      ) : (
        <AreaChart {...common}>
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.label}
                id={`pr-chart-grad-${s.accent.replace(/\W/g, "")}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.accent} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.accent} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {series.map((s) => (
            <Area
              key={s.label}
              dataKey={s.label}
              stroke={s.accent}
              strokeWidth={2.25}
              fill={`url(#pr-chart-grad-${s.accent.replace(/\W/g, "")})`}
              dot={rows.length > 24 ? false : { r: 3, fill: s.accent, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Segmented control.
// ───────────────────────────────────────────────────────────────────────────

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      className="pr-seg"
      role="tablist"
      style={{ "--pr-seg-cols": options.length } as React.CSSProperties}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`pr-seg__btn${value === o.value ? " pr-on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Profile completion — current snapshot. "By platform" shows adoption per
// social link; "By depth" shows how many of the four links users have.
// ───────────────────────────────────────────────────────────────────────────

function ProfileCompletionSection({ data }: { data: BuilderInsightsData }) {
  const [tab, setTab] = React.useState<CompletionKey>("platform");

  const withAnyLink = data.socialCompletionDepth
    .filter((d) => d.linkCount > 0)
    .reduce((sum, d) => sum + d.users, 0);
  const anyLinkPct =
    data.totalAccounts > 0 ? (withAnyLink / data.totalAccounts) * 100 : 0;
  const avgLinks =
    data.totalAccounts > 0
      ? data.socialCompletionDepth.reduce(
          (sum, d) => sum + d.linkCount * d.users,
          0,
        ) / data.totalAccounts
      : 0;

  return (
    <section className="pr-insights__section">
      <header className="pr-insights__heading">
        <span className="pr-insights__heading-icon">
          <LinkIcon size={18} />
        </span>
        <h4 className="pr-insights__title">Profile completion</h4>
        <span className="pr-insights__subtitle">
          {anyLinkPct.toFixed(1)}% have at least one of these links ·{" "}
          {formatNumber(data.totalAccounts)} accounts
        </span>
      </header>

      {data.totalAccounts === 0 ? (
        <p className="pr-leaderboard__empty">No accounts yet.</p>
      ) : (
        <>
          <Segmented<CompletionKey>
            value={tab}
            onChange={setTab}
            options={[
              { value: "platform", label: "By platform" },
              { value: "depth", label: "By depth" },
            ]}
          />

          {tab === "platform" ? (
            <div className="pr-completion-bars">
              {data.socialCompletion.map((s) => {
                const accent = PLATFORM_ACCENT[s.platform];
                return (
                  <div key={s.platform} className="pr-completion-bar">
                    <span className="pr-completion-bar__label">
                      <span
                        className="pr-completion-bar__icon"
                        style={{ color: accent }}
                      >
                        <PlatformIcon platform={s.platform} />
                      </span>
                      {s.label}
                    </span>
                    <span className="pr-completion-bar__track">
                      <span
                        className="pr-completion-bar__fill"
                        style={{
                          width: `${Math.min(s.pct, 100)}%`,
                          background: accent,
                          boxShadow: neonGlow(accent),
                        }}
                      />
                    </span>
                    <span className="pr-completion-bar__value">
                      <strong>{s.pct.toFixed(1)}%</strong>
                      <span className="pr-completion-bar__count">
                        {formatNumber(s.count)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="pr-completion-bars">
                {[...data.socialCompletionDepth]
                  .sort((a, b) => b.linkCount - a.linkCount)
                  .map((d) => {
                    const accent =
                      DEPTH_ACCENT[d.linkCount] ?? "var(--pr-g-650)";
                    return (
                      <div key={d.linkCount} className="pr-completion-bar">
                        <span className="pr-completion-bar__label">
                          <span
                            className="pr-completion-bar__dot"
                            style={{
                              background: accent,
                              boxShadow: neonGlow(accent, 6),
                            }}
                          />
                          {d.linkCount} {d.linkCount === 1 ? "link" : "links"}
                        </span>
                        <span className="pr-completion-bar__track">
                          <span
                            className="pr-completion-bar__fill"
                            style={{
                              width: `${Math.min(d.pct, 100)}%`,
                              background: accent,
                              boxShadow: neonGlow(accent),
                            }}
                          />
                        </span>
                        <span className="pr-completion-bar__value">
                          <strong>{d.pct.toFixed(1)}%</strong>
                          <span className="pr-completion-bar__count">
                            {formatNumber(d.users)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
              </div>
              <p className="pr-completion-foot">
                {avgLinks.toFixed(1)} links per account on average
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Referral leaderboard — People / Teams toggle.
// ───────────────────────────────────────────────────────────────────────────

function formatMonthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The last 12 months, newest first, as "YYYY-MM". Generated rather than
 * derived from the payload: the server no longer ships a row per
 * referrer × month, so there is nothing to derive the list from — and any
 * month in range is one fetch away regardless of whether it has data.
 */
function trailingMonths(count = 12): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      .toISOString()
      .slice(0, 7),
  );
}

// An event "on the 15th" means the 15th where the event happened, so periods
// are resolved in the viewer's own zone rather than silently in UTC.
const VIEWER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Today in the viewer's zone — east of UTC that is a day ahead of the UTC date. */
function viewerToday(): string {
  // en-CA formats as YYYY-MM-DD, which is what <input type="date"> wants.
  return new Date().toLocaleDateString("en-CA", { timeZone: VIEWER_TIME_ZONE });
}

function LeaderboardSection({ data }: { data: BuilderInsightsData }) {
  const [tab, setTab] = React.useState<LeaderboardKey>("people");
  // "" = all time; otherwise "YYYY-MM" (a month) or "YYYY-MM-DD" (a day).
  // Month and day are one control: picking either clears the other.
  const [period, setPeriod] = React.useState<string>("");
  const [periodData, setPeriodData] = React.useState<ReferralPeriodData | null>(null);
  const [periodLoading, setPeriodLoading] = React.useState(false);
  const [periodError, setPeriodError] = React.useState<string | null>(null);

  const months = React.useMemo(() => trailingMonths(), []);
  const isDay = period.length === 10;

  // Referrer × period rows are far too many to ship with the main payload, so
  // a chosen period is fetched on demand — which also means every referrer in
  // that period shows up, not just those in the all-time top 100.
  React.useEffect(() => {
    if (!period) {
      setPeriodData(null);
      setPeriodError(null);
      return;
    }
    let cancelled = false;
    setPeriodLoading(true);
    setPeriodError(null);
    const query = new URLSearchParams({ period, tz: VIEWER_TIME_ZONE });
    fetch(`/api/profile/insights/referrals?${query}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ReferralPeriodData) => {
        if (!cancelled) setPeriodData(d);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[InsightsCard] failed to load period referrals:", err);
        setPeriodError("Could not load referrals for that period.");
      })
      .finally(() => {
        if (!cancelled) setPeriodLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const peopleRows = period ? (periodData?.people ?? []) : data.topReferrers;
  const teamRows = period ? (periodData?.teams ?? []) : data.topTeamReferrers;

  const periodLabel = !period
    ? null
    : `${isDay ? formatDayLabel(period) : formatMonthLabel(period)} · ${periodData?.timeZone ?? VIEWER_TIME_ZONE}`;

  return (
    <section className="pr-insights__section">
      <header className="pr-insights__heading">
        <span className="pr-insights__heading-icon">
          <TrophyIcon size={18} />
        </span>
        <h4 className="pr-insights__title">Referral leaderboard</h4>
        <span className="pr-insights__subtitle">
          {tab === "people"
            ? `${peopleRows.length}${period ? "" : " top"} contributors`
            : `${teamRows.length} teams`}
          {periodLabel ? ` · ${periodLabel}` : ""}
        </span>
      </header>
      <div className="pr-leaderboard__controls">
        <Segmented<LeaderboardKey>
          value={tab}
          onChange={setTab}
          options={[
            { value: "people", label: "People" },
            { value: "teams", label: "Teams" },
          ]}
        />
        <select
          className="pr-month-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Filter referrals by period"
        >
          <option value="">All time</option>
          {isDay && <option value={period}>{formatDayLabel(period)}</option>}
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="pr-month-select pr-day-input"
          value={isDay ? period : ""}
          max={viewerToday()}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Filter referrals by day"
        />
      </div>

      {tab === "people" ? (
        <div className="pr-leaderboard">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Referrer</th>
                <th>Team</th>
                <th className="pr-num">Builder Hub</th>
                <th className="pr-num">Events</th>
                <th className="pr-num">Hackathons</th>
                <th className="pr-num">Grants</th>
                <th className="pr-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {peopleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pr-leaderboard__empty">
                    {periodLoading
                      ? "Loading…"
                      : (periodError ??
                        (periodLabel
                          ? `No referral conversions for ${periodLabel}.`
                          : "No referral conversions recorded yet."))}
                  </td>
                </tr>
              ) : (
                (period ? peopleRows : peopleRows.slice(0, 20)).map((r, i) => (
                  <tr key={r.referrerId}>
                    <td className="pr-rank">{i + 1}</td>
                    <td>
                      <div className="pr-leaderboard__person">
                        <span className="pr-leaderboard__avatar">
                          {initials(r.referrer)}
                        </span>
                        <div>
                          <div className="pr-leaderboard__name">
                            {toTitleCase(r.referrer)}
                          </div>
                          {r.country && (
                            <div className="pr-leaderboard__country">
                              {countryNameToFlag(r.country)} {r.country}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="pr-leaderboard__team">{r.team}</span>
                    </td>
                    <td className="pr-num">{formatNumber(r.builderHubSignups)}</td>
                    <td className="pr-num">
                      {formatNumber(r.eventRegistrations)}
                    </td>
                    <td className="pr-num">
                      {formatNumber(r.hackathonRegistrations)}
                    </td>
                    <td className="pr-num">{formatNumber(r.grantApplications)}</td>
                    <td className="pr-num pr-leaderboard__total">
                      {formatNumber(r.totalReferrals)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pr-leaderboard">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th className="pr-num">Builder Hub</th>
                <th className="pr-num">Events</th>
                <th className="pr-num">Hackathons</th>
                <th className="pr-num">Grants</th>
                <th className="pr-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="pr-leaderboard__empty">
                    {periodLoading
                      ? "Loading…"
                      : (periodError ??
                        (periodLabel
                          ? `No team referral conversions for ${periodLabel}.`
                          : "No team referral conversions recorded yet."))}
                  </td>
                </tr>
              ) : (
                teamRows.map((r, i) => (
                  <tr key={r.teamId}>
                    <td className="pr-rank">{i + 1}</td>
                    <td>
                      <span className="pr-leaderboard__name">{r.team}</span>
                    </td>
                    <td className="pr-num">{formatNumber(r.builderHubSignups)}</td>
                    <td className="pr-num">
                      {formatNumber(r.eventRegistrations)}
                    </td>
                    <td className="pr-num">
                      {formatNumber(r.hackathonRegistrations)}
                    </td>
                    <td className="pr-num">{formatNumber(r.grantApplications)}</td>
                    <td className="pr-num pr-leaderboard__total">
                      {formatNumber(r.totalReferrals)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Hackathon history — flat table view, newest first. Mirrors the referral
// leaderboard styling so the two sections feel like a matched pair.
//
// Named for what it actually queries: the payload filters to
// event = 'hackathon', while the referral leaderboard counts non-hackathon
// events in its own "Events" column. Two meanings of "event" on one screen
// was confusing.
// ───────────────────────────────────────────────────────────────────────────

function EventHistorySection({ data }: { data: BuilderInsightsData }) {
  const [sortBy, setSortBy] = React.useState<EventSortKey>("recent");

  // "Recent" = newest start date first. "Top" = most inscriptions first,
  // falling back to project count when registrations tie, then to start
  // date so the order stays stable.
  const sorted = React.useMemo(() => {
    const events = [...data.eventParticipants];
    if (sortBy === "top") {
      return events.sort((a, b) => {
        if (b.registrations !== a.registrations) {
          return b.registrations - a.registrations;
        }
        if (b.projects !== a.projects) return b.projects - a.projects;
        const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
        return bStart - aStart;
      });
    }
    return events.sort((a, b) => {
      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      return bStart - aStart;
    });
  }, [data.eventParticipants, sortBy]);

  return (
    <section className="pr-insights__section">
      <header className="pr-insights__heading">
        <span className="pr-insights__heading-icon">
          <SparkleIcon size={18} />
        </span>
        <h4 className="pr-insights__title">Hackathon history</h4>
        <span className="pr-insights__subtitle">
          {formatNumber(data.totalHackathonsHosted)} hosted ·{" "}
          {formatNumber(data.totalHackathonParticipants)} participants ·{" "}
          {formatNumber(data.totalHackathonProjects)} projects
        </span>
      </header>

      <Segmented<EventSortKey>
        value={sortBy}
        onChange={setSortBy}
        options={[
          { value: "recent", label: "Recent" },
          { value: "top", label: "Top" },
        ]}
      />

      <div className="pr-leaderboard">
        <table>
          <thead>
            <tr>
              <th>Hackathon</th>
              <th className="pr-num">Inscriptions</th>
              <th className="pr-num">Participants</th>
              <th className="pr-num">Projects submitted</th>
              <th className="pr-num">Top traffic sources (90d)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="pr-leaderboard__empty">
                  No hackathons recorded yet.
                </td>
              </tr>
            ) : (
              sorted.map((e) => (
                <tr key={e.eventId}>
                  <td>
                    <div className="pr-leaderboard__name">{e.event}</div>
                    {(e.startDate || e.endDate) && (
                      <div className="pr-leaderboard__country">
                        {formatHackathonRange(e.startDate, e.endDate)}
                      </div>
                    )}
                  </td>
                  <td className="pr-num">{formatNumber(e.registrations)}</td>
                  <td className="pr-num">{formatNumber(e.participants)}</td>
                  <td className="pr-num">{formatNumber(e.projects)}</td>
                  <td>
                    {e.topTrafficSources.length === 0 ? (
                      <div className="pr-traffic-sources__empty">No data</div>
                    ) : (
                      <ul className="pr-traffic-sources">
                        {e.topTrafficSources.map((src) => (
                          <li key={src.source}>
                            <span className="pr-traffic-sources__name">{src.source}</span>
                            <span className="pr-traffic-sources__count">
                              {formatNumber(src.visitors)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
