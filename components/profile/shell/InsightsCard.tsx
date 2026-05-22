"use client";

import * as React from "react";
import { GlobeIcon, SparkleIcon, TrophyIcon } from "./icons";
import type { BuilderInsightsData } from "@/server/services/builderInsights";
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

const ACCENT_SIGNUPS = "#E84142";
const ACCENT_VISITS = "#7FA6FF";
const ACCENT_CONSOLE = "#B88DFF";

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
        {tab === "all" && (
          <div className="pr-chart__legend">
            {activeSeries.map((s) => (
              <span key={s.label} className="pr-chart__legend-item">
                <span
                  className="pr-chart__legend-swatch"
                  style={{ background: s.accent }}
                />
                {s.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BigChart({
  series,
  normalized,
}: {
  series: Series[];
  normalized: boolean;
}) {
  const W = 880;
  const H = 260;
  const PAD_L = normalized ? 14 : 52;
  const PAD_R = 14;
  const PAD_T = 20;
  const PAD_B = 32;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // X-axis is the union of months across the active series, sorted. This way
  // each point lands at its real calendar position — series that started
  // later (e.g. console) won't be stretched to fill the whole axis.
  const monthSet = new Set<string>();
  for (const s of series) for (const p of s.data) monthSet.add(p.month);
  const months = Array.from(monthSet).sort();

  if (months.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          fontSize={12}
          fill="var(--pr-g-650)"
          fontFamily="ui-monospace, monospace"
        >
          No data yet
        </text>
      </svg>
    );
  }

  const step = innerW / Math.max(months.length - 1, 1);
  const xForMonth = (month: string) => {
    const idx = months.indexOf(month);
    return PAD_L + idx * step;
  };

  const seriesScales = series.map((s) => {
    const vals = s.data.map((r) => r.value);
    const max = Math.max(...vals, 1);
    const min = normalized ? 0 : Math.min(...vals, 0);
    return { vals, max, min, span: Math.max(max - min, 1) };
  });

  const yFor = (sIdx: number, v: number) => {
    const { min, span } = seriesScales[sIdx];
    return PAD_T + innerH - ((v - min) / span) * innerH;
  };

  const ticks =
    !normalized && seriesScales[0]
      ? [0, 0.25, 0.5, 0.75, 1].map(
          (t) => seriesScales[0].min + t * seriesScales[0].span,
        )
      : [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        {series.map((s) => {
          const id = `pr-chart-grad-${s.accent.replace(/\W/g, "")}`;
          return (
            <linearGradient key={id} id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.accent} stopOpacity={0} />
            </linearGradient>
          );
        })}
      </defs>

      {ticks.map((t, i) => (
        <g key={`tick-${i}`}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yFor(0, t)}
            y2={yFor(0, t)}
            stroke="var(--pr-g-300)"
            strokeDasharray="2 4"
          />
          <text
            x={PAD_L - 10}
            y={yFor(0, t) + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--pr-g-650)"
            fontFamily="ui-monospace, monospace"
          >
            {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : Math.round(t)}
          </text>
        </g>
      ))}

      {series.map((s, sIdx) => {
        if (s.data.length === 0) return null;
        const pts = s.data.map(
          (r) => `${xForMonth(r.month)},${yFor(sIdx, r.value)}`,
        );
        const line = `M${pts.join(" L")}`;
        const firstX = xForMonth(s.data[0].month);
        const lastX = xForMonth(s.data[s.data.length - 1].month);
        const area = `M${pts[0]} L${pts.join(" ")} L${lastX},${PAD_T + innerH} L${firstX},${PAD_T + innerH} Z`;
        const gradId = `pr-chart-grad-${s.accent.replace(/\W/g, "")}`;
        return (
          <g key={`${s.label}-${sIdx}`}>
            {!normalized && <path d={area} fill={`url(#${gradId})`} />}
            <path
              d={line}
              fill="none"
              stroke={s.accent}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {!normalized &&
              s.data.map((r) => {
                const px = xForMonth(r.month);
                const py = yFor(sIdx, r.value);
                return (
                  <circle
                    key={`${s.label}-pt-${r.month}`}
                    cx={px}
                    cy={py}
                    r={3}
                    fill={s.accent}
                  />
                );
              })}
          </g>
        );
      })}

      {months.map((month) => (
        <text
          key={month}
          x={xForMonth(month)}
          y={H - 10}
          textAnchor="middle"
          fontSize={11}
          fill="var(--pr-g-650)"
          fontFamily="ui-monospace, monospace"
        >
          {month.slice(5)}
        </text>
      ))}
    </svg>
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
// Referral leaderboard — People / Teams toggle.
// ───────────────────────────────────────────────────────────────────────────

function LeaderboardSection({ data }: { data: BuilderInsightsData }) {
  const [tab, setTab] = React.useState<LeaderboardKey>("people");

  return (
    <section className="pr-insights__section">
      <header className="pr-insights__heading">
        <span className="pr-insights__heading-icon">
          <TrophyIcon size={18} />
        </span>
        <h4 className="pr-insights__title">Referral leaderboard</h4>
        <span className="pr-insights__subtitle">
          {tab === "people"
            ? `${data.topReferrers.length} top contributors`
            : `${data.topTeamReferrers.length} teams`}
        </span>
      </header>
      <Segmented<LeaderboardKey>
        value={tab}
        onChange={setTab}
        options={[
          { value: "people", label: "People" },
          { value: "teams", label: "Teams" },
        ]}
      />

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
              {data.topReferrers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pr-leaderboard__empty">
                    No referral conversions recorded yet.
                  </td>
                </tr>
              ) : (
                data.topReferrers.slice(0, 20).map((r, i) => (
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
              {data.topTeamReferrers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="pr-leaderboard__empty">
                    No team referral conversions recorded yet.
                  </td>
                </tr>
              ) : (
                data.topTeamReferrers.map((r, i) => (
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
