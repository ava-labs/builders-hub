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
  data: Array<{ month: string; value: number }>;
}

function ChartSection({ data }: { data: BuilderInsightsData }) {
  const [tab, setTab] = React.useState<ChartKey>("signups");

  const signupsSeries: Series = React.useMemo(
    () => ({
      label: "Signups / month",
      accent: ACCENT_SIGNUPS,
      data: data.monthlySignups.map((r) => ({ month: r.month, value: r.signups })),
    }),
    [data.monthlySignups],
  );
  const visitsSeries: Series = React.useMemo(
    () => ({
      label: "Unique visitors / month",
      accent: ACCENT_VISITS,
      data: data.monthlyVisits.map((r) => ({ month: r.month, value: r.visitors })),
    }),
    [data.monthlyVisits],
  );
  const consoleSeries: Series = React.useMemo(
    () => ({
      label: "Console users / month",
      accent: ACCENT_CONSOLE,
      data: data.monthlyConsoleUsers.map((r) => ({
        month: r.month,
        value: r.visitors,
      })),
    }),
    [data.monthlyConsoleUsers],
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
  const subtitle =
    tab === "all"
      ? "Trailing 12 months · normalized comparison"
      : `Trailing 12 months · ${formatNumber(latest)} latest`;

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
  // Merge all series onto a shared month axis so each point lands at its
  // real calendar position — series that started later (e.g. console)
  // won't be stretched to fill the whole axis.
  const rows = React.useMemo(() => {
    const byMonth = new Map<string, Record<string, string | number>>();
    for (const s of series) {
      const max = Math.max(...s.data.map((p) => p.value), 1);
      for (const p of s.data) {
        const row = byMonth.get(p.month) ?? { month: p.month };
        // Normalized mode plots each series as % of its own peak (single
        // shared 0–100 axis); tooltips always show the raw value.
        row[s.label] = normalized ? (p.value / max) * 100 : p.value;
        row[`${s.label}__raw`] = p.value;
        byMonth.set(p.month, row);
      }
    }
    return Array.from(byMonth.values()).sort((a, b) =>
      String(a.month).localeCompare(String(b.month)),
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
    dataKey: "month",
    tick: AXIS_TICK,
    tickFormatter: (m: string) => m.slice(5),
    axisLine: false,
    tickLine: false,
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
              dot={{ r: 3, fill: s.accent, strokeWidth: 0 }}
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

function LeaderboardSection({ data }: { data: BuilderInsightsData }) {
  const [tab, setTab] = React.useState<LeaderboardKey>("people");
  const [month, setMonth] = React.useState<string>("all");

  const months = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...data.topReferrersMonthly.map((r) => r.month),
          ...data.topTeamReferrersMonthly.map((r) => r.month),
        ]),
      )
        .sort()
        .reverse(),
    [data.topReferrersMonthly, data.topTeamReferrersMonthly],
  );

  const peopleRows = React.useMemo(() => {
    if (month === "all") return data.topReferrers;
    const meta = new Map(data.topReferrers.map((r) => [r.referrerId, r]));
    // ponytail: monthly rows join against the all-time top-100 for name/team
    // metadata; referrers outside that set are dropped. Widen the top-100
    // limit in builderInsights.ts if that ever matters.
    return data.topReferrersMonthly
      .filter((r) => r.month === month && meta.has(r.referrerId))
      .map((r) => ({ ...meta.get(r.referrerId)!, ...r }))
      .sort((a, b) => b.totalReferrals - a.totalReferrals);
  }, [month, data.topReferrers, data.topReferrersMonthly]);

  const teamRows = React.useMemo(() => {
    if (month === "all") return data.topTeamReferrers;
    const meta = new Map(data.topTeamReferrers.map((r) => [r.teamId, r]));
    return data.topTeamReferrersMonthly
      .filter((r) => r.month === month && meta.has(r.teamId))
      .map((r) => ({ ...meta.get(r.teamId)!, ...r }))
      .sort((a, b) => b.totalReferrals - a.totalReferrals);
  }, [month, data.topTeamReferrers, data.topTeamReferrersMonthly]);

  return (
    <section className="pr-insights__section">
      <header className="pr-insights__heading">
        <span className="pr-insights__heading-icon">
          <TrophyIcon size={18} />
        </span>
        <h4 className="pr-insights__title">Referral leaderboard</h4>
        <span className="pr-insights__subtitle">
          {tab === "people"
            ? `${peopleRows.length} top contributors${month === "all" ? "" : ` · ${formatMonthLabel(month)}`}`
            : `${teamRows.length} teams${month === "all" ? "" : ` · ${formatMonthLabel(month)}`}`}
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
        {months.length > 0 && (
          <select
            className="pr-month-select"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Filter referrals by month"
          >
            <option value="all">All time</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        )}
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
                    {month === "all"
                      ? "No referral conversions recorded yet."
                      : `No referral conversions in ${formatMonthLabel(month)}.`}
                  </td>
                </tr>
              ) : (
                peopleRows.slice(0, 20).map((r, i) => (
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
                    {month === "all"
                      ? "No team referral conversions recorded yet."
                      : `No team referral conversions in ${formatMonthLabel(month)}.`}
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
// Event history — flat table view, newest first. Mirrors the referral
// leaderboard styling so the two sections feel like a matched pair.
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
        <h4 className="pr-insights__title">Event history</h4>
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
              <th>Event</th>
              <th className="pr-num">Inscriptions</th>
              <th className="pr-num">Projects submitted</th>
              <th className="pr-num">Top traffic sources (90d)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="pr-leaderboard__empty">
                  No events recorded yet.
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
