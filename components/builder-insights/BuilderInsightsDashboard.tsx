"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { CalendarDays, Copy, Gift, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { BuilderInsightsData } from "@/server/services/builderInsights";
import {
  createReferralLink,
  type ReferralLinkResponse,
} from "@/lib/referrals/client";
import type { ReferralTargetPreset } from "@/lib/referrals/targets";
import { ReferralLinkGenerator } from "@/components/referrals/ReferralLinkGenerator";

interface ReferralLinkSummary {
  id: string;
  code: string;
  target_type: string;
  target_id: string | null;
  destination_url: string;
  created_at: string;
  shareUrl: string;
}

interface BuilderInsightsDashboardProps {
  data: BuilderInsightsData;
  referralLinks: ReferralLinkSummary[];
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function countryCodeToFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  const REGIONAL_INDICATOR_A = 0x1f1e6;
  const A_CHAR_CODE = 65;
  return String.fromCodePoint(
    ...upper.split("").map((c) => REGIONAL_INDICATOR_A + (c.charCodeAt(0) - A_CHAR_CODE)),
  );
}

const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  india: "IN",
  nigeria: "NG",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  turkey: "TR",
  "türkiye": "TR",
  indonesia: "ID",
  argentina: "AR",
  china: "CN",
  philippines: "PH",
  france: "FR",
  kenya: "KE",
  vietnam: "VN",
  "viet nam": "VN",
  mexico: "MX",
  pakistan: "PK",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  brazil: "BR",
  brasil: "BR",
  peru: "PE",
  canada: "CA",
  colombia: "CO",
  rwanda: "RW",
  russia: "RU",
  "russian federation": "RU",
  japan: "JP",
  bolivia: "BO",
  "south korea": "KR",
  "korea (south)": "KR",
  "republic of korea": "KR",
  "united arab emirates": "AE",
  "united arab emirates (uae)": "AE",
  uae: "AE",
  bangladesh: "BD",
  spain: "ES",
  ukraine: "UA",
  germany: "DE",
  chile: "CL",
  italy: "IT",
  netherlands: "NL",
  australia: "AU",
  singapore: "SG",
  switzerland: "CH",
  belgium: "BE",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  poland: "PL",
  portugal: "PT",
  greece: "GR",
  egypt: "EG",
  "south africa": "ZA",
  israel: "IL",
  thailand: "TH",
  malaysia: "MY",
  "saudi arabia": "SA",
  iran: "IR",
  iraq: "IQ",
  "hong kong": "HK",
  taiwan: "TW",
  "new zealand": "NZ",
  ireland: "IE",
  romania: "RO",
  "czech republic": "CZ",
  czechia: "CZ",
  hungary: "HU",
  austria: "AT",
  finland: "FI",
  estonia: "EE",
  lithuania: "LT",
  latvia: "LV",
  bulgaria: "BG",
  croatia: "HR",
  serbia: "RS",
  slovakia: "SK",
  slovenia: "SI",
  ecuador: "EC",
  uruguay: "UY",
  paraguay: "PY",
  venezuela: "VE",
  "costa rica": "CR",
  panama: "PA",
  guatemala: "GT",
  honduras: "HN",
  "dominican republic": "DO",
  "puerto rico": "PR",
  cuba: "CU",
  ghana: "GH",
  ethiopia: "ET",
  uganda: "UG",
  tanzania: "TZ",
  morocco: "MA",
  algeria: "DZ",
  tunisia: "TN",
  "sri lanka": "LK",
  nepal: "NP",
  cambodia: "KH",
  laos: "LA",
  myanmar: "MM",
  mongolia: "MN",
};

function countryNameToFlag(name: string | null | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed.length === 2 && /^[A-Za-z]{2}$/.test(trimmed)) {
    return countryCodeToFlag(trimmed);
  }
  const code = COUNTRY_NAME_TO_ISO2[trimmed.toLowerCase()];
  return code ? countryCodeToFlag(code) : "";
}

function toTitleCase(input: string): string {
  if (!input) return input;
  return input
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((part) => (/^[a-zà-ÿñ]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("");
}

function shortLabel(label: string, maxLength = 22): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
      {label}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="font-medium text-neutral-950 dark:text-neutral-50">{label}</div>
      {payload.map((item: any) => (
        <div key={item.dataKey} className="text-neutral-600 dark:text-neutral-300">
          {item.name}: {formatNumber(Number(item.value))}
        </div>
      ))}
    </div>
  );
}

export function BuilderInsightsDashboard({
  data,
  referralLinks: initialReferralLinks,
}: BuilderInsightsDashboardProps) {
  const [topReferrerTeamFilter, setTopReferrerTeamFilter] = useState("all");
  const [topReferrerPage, setTopReferrerPage] = useState(0);

  const monthlyData = data.monthlySignups;
  const referrerData = data.signupsByReferrer.map((row) => ({
    ...row,
    label: shortLabel(row.referrer, 28),
  }));
  const eventData = data.eventParticipants.map((row) => ({
    ...row,
    label: shortLabel(row.event, 24),
  }));

  const topReferrerTeamOptions = useMemo(() => {
    const teams = new Map<string, string>();
    data.topReferrers.forEach((row) => {
      teams.set(row.teamId ?? "community", row.team);
    });
    return Array.from(teams, ([id, label]) => ({ id, label })).sort((a, b) => {
      if (a.id === "community") return -1;
      if (b.id === "community") return 1;
      return a.label.localeCompare(b.label);
    });
  }, [data.topReferrers]);
  const filteredTopReferrers = useMemo(() => {
    if (topReferrerTeamFilter === "all") return data.topReferrers;
    if (topReferrerTeamFilter === "community") {
      return data.topReferrers.filter((row) => !row.teamId);
    }
    return data.topReferrers.filter((row) => row.teamId === topReferrerTeamFilter);
  }, [data.topReferrers, topReferrerTeamFilter]);

  const TOP_REFERRERS_INITIAL = 20;
  const TOP_REFERRERS_PAGE_SIZE = 50;
  const [topReferrerExpanded, setTopReferrerExpanded] = useState(false);
  const topReferrerPageCount = Math.max(
    1,
    Math.ceil(filteredTopReferrers.length / TOP_REFERRERS_PAGE_SIZE),
  );
  const safeTopReferrerPage = Math.min(topReferrerPage, topReferrerPageCount - 1);
  const isCompactView = !topReferrerExpanded && safeTopReferrerPage === 0;
  const pagedTopReferrers = isCompactView
    ? filteredTopReferrers.slice(0, TOP_REFERRERS_INITIAL)
    : filteredTopReferrers.slice(
        safeTopReferrerPage * TOP_REFERRERS_PAGE_SIZE,
        (safeTopReferrerPage + 1) * TOP_REFERRERS_PAGE_SIZE,
      );
  const showLoadMore = isCompactView && filteredTopReferrers.length > TOP_REFERRERS_INITIAL;
  const showPagination =
    !isCompactView && filteredTopReferrers.length > TOP_REFERRERS_PAGE_SIZE;
  const targetsByGroup = useMemo(
    () => ({
      signup: data.referralTargets.filter((target) => target.group === "signup"),
      event: data.referralTargets.filter((target) => target.group === "event"),
      grant: data.referralTargets.filter((target) => target.group === "grant"),
    }),
    [data.referralTargets]
  );

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Builder Insights</h1>
          <p className="max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
            Account growth, referral attribution, and event participation for Builder Hub.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Builder Hub accounts" value={data.totalAccounts} />
          <MetricCard
            label="Your Builder Hub impact"
            value={data.userGeneratedReferralImpact}
          />
          <MetricCard
            label="Builder Hub signups (last 30 days)"
            value={data.latest30DaySignups}
            deltaPercent={data.rollingSignupDeltaPercent}
          />
          <MetricCard
            label="Builder Hub visits (last 30 days)"
            value={data.latest30DayVisits}
            deltaPercent={data.rollingVisitsDeltaPercent}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Top country (last 30 days)"
            valueOverride={
              data.topCountry30d
                ? `${countryCodeToFlag(data.topCountry30d.countryCode)} ${data.topCountry30d.country}`.trim()
                : "—"
            }
            compactValue
            subText={
              data.topCountry30d
                ? `${data.topCountry30d.sharePct.toFixed(1)}% of last 30 days`
                : "No data yet"
            }
          />
          <MetricCard
            label="Total hackathon submissions"
            value={data.totalHackathonSubmissions}
          />
          <MetricCard
            label="Console users (last 30 days)"
            value={data.consoleUsers30d}
            deltaPercent={data.consoleUsersDeltaPercent}
          />
          <MetricCard
            label="Returning visitor %"
            valueOverride={`${data.returningVisitorPct30d.toFixed(1)}%`}
            deltaPercent={data.returningVisitorDeltaPercent}
          />
        </div>

        <ReferralLinkGenerator initialLinks={initialReferralLinks} targets={targetsByGroup} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Builder Hub Visits By Month (unique visitors)">
            {data.monthlyVisits.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data.monthlyVisits}
                  margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="visitors" name="Unique visitors" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No website visit data yet (PostHog not configured?)" />
            )}
          </ChartCard>

          <ChartCard title="Builder Hub Signups By Month">
            {monthlyData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="signups" name="Signups" fill="#E84142" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No signup data yet" />
            )}
          </ChartCard>

          <ChartCard title="Builder Hub Cumulative Signups By Month">
            {monthlyData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="Cumulative signups"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No cumulative data yet" />
            )}
          </ChartCard>

          <ChartCard title="Builder Hub Signups By Referrer">
            {referrerData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={referrerData}
                  layout="vertical"
                  margin={{ top: 12, right: 18, bottom: 8, left: 64 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    width={120}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="signups" name="BH signups" fill="#0891B2" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No referral signups recorded yet" />
            )}
          </ChartCard>

          <ChartCard title="Hackathon Participants By Event">
            {eventData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={eventData} margin={{ top: 12, right: 12, bottom: 52, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    angle={-28}
                    textAnchor="end"
                    height={72}
                  />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="participants" name="BH participants" fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No event participant data yet" />
            )}
          </ChartCard>

          <ChartCard title="Console Users By Month">
            {data.monthlyConsoleUsers.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data.monthlyConsoleUsers}
                  margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="visitors" name="Console users" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No console usage data yet (PostHog not configured?)" />
            )}
          </ChartCard>

        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Top Referrers</CardTitle>
              <Select
                value={topReferrerTeamFilter}
                onValueChange={(v) => {
                  setTopReferrerTeamFilter(v);
                  setTopReferrerPage(0);
                  setTopReferrerExpanded(false);
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-56">
                  <SelectValue placeholder="Filter by team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {topReferrerTeamOptions.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead className="w-32 text-right">Signups</TableHead>
                    <TableHead className="w-32 text-right">Events</TableHead>
                    <TableHead className="w-32 text-right">Hackathons</TableHead>
                    <TableHead className="w-32 text-right">Grants</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedTopReferrers.length ? (
                    pagedTopReferrers.map((row) => (
                      <TableRow key={row.referrerId}>
                        <TableCell className="font-medium">{toTitleCase(row.referrer)}</TableCell>
                        <TableCell className="w-32 text-right">{formatNumber(row.builderHubSignups)}</TableCell>
                        <TableCell className="w-32 text-right">{formatNumber(row.eventRegistrations)}</TableCell>
                        <TableCell className="w-32 text-right">{formatNumber(row.hackathonRegistrations)}</TableCell>
                        <TableCell className="w-32 text-right">{formatNumber(row.grantApplications)}</TableCell>
                        <TableCell className="w-32 text-right font-medium">{formatNumber(row.totalReferrals)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-neutral-500">
                        No referral conversions recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {showLoadMore && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTopReferrerExpanded(true)}
                  >
                    Load{" "}
                    {Math.min(TOP_REFERRERS_PAGE_SIZE, filteredTopReferrers.length) -
                      TOP_REFERRERS_INITIAL}{" "}
                    more
                  </Button>
                </div>
              )}
              {showPagination && (
                <div className="flex items-center justify-between gap-2 pt-3 text-sm text-neutral-600 dark:text-neutral-400">
                  <div>
                    Showing {safeTopReferrerPage * TOP_REFERRERS_PAGE_SIZE + 1}–
                    {Math.min(
                      (safeTopReferrerPage + 1) * TOP_REFERRERS_PAGE_SIZE,
                      filteredTopReferrers.length,
                    )}{" "}
                    of {filteredTopReferrers.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTopReferrerPage((p) => Math.max(0, p - 1))}
                      disabled={safeTopReferrerPage === 0}
                    >
                      Previous
                    </Button>
                    <span>
                      Page {safeTopReferrerPage + 1} of {topReferrerPageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTopReferrerPage((p) => Math.min(topReferrerPageCount - 1, p + 1))
                      }
                      disabled={safeTopReferrerPage >= topReferrerPageCount - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
            <CardHeader>
              <CardTitle className="text-base">Top Team Referrers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="w-32 text-right">Signups</TableHead>
                    <TableHead className="w-32 text-right">Events</TableHead>
                    <TableHead className="w-32 text-right">Hackathons</TableHead>
                    <TableHead className="w-32 text-right">Grants</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topTeamReferrers.length ? (
                    data.topTeamReferrers.map((row) => (
                      <TableRow key={row.teamId}>
                        <TableCell className="font-medium">{row.team}</TableCell>
                        <TableCell className="w-32 text-right">{formatNumber(row.builderHubSignups)}</TableCell>
                        <TableCell className="w-32 text-right">{formatNumber(row.eventRegistrations)}</TableCell>
                        <TableCell className="w-32 text-right">{formatNumber(row.hackathonRegistrations)}</TableCell>
                        <TableCell className="w-32 text-right">{formatNumber(row.grantApplications)}</TableCell>
                        <TableCell className="w-32 text-right font-medium">{formatNumber(row.totalReferrals)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-neutral-500">
                        No team referral conversions recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  valueOverride,
  deltaPercent,
  subText,
  compactValue,
}: {
  label: string;
  value?: number;
  valueOverride?: string;
  deltaPercent?: number;
  subText?: string;
  compactValue?: boolean;
}) {
  const hasDelta = typeof deltaPercent === "number";
  const deltaClass =
    !hasDelta || deltaPercent === 0
      ? "text-neutral-500 dark:text-neutral-400"
      : deltaPercent > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";
  const formattedDelta = hasDelta
    ? `${deltaPercent > 0 ? "+" : ""}${Math.round(deltaPercent)}%`
    : null;

  const display = valueOverride ?? formatNumber(value ?? 0);
  const valueSizeClass = compactValue ? "text-2xl" : "text-4xl";

  return (
    <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={`${valueSizeClass} font-semibold tracking-tight`}>{display}</div>
        {subText && (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">{subText}</div>
        )}
        {formattedDelta && (
          <div className={`text-sm font-medium ${deltaClass}`}>
            {formattedDelta} vs previous 30 days
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`rounded-lg border-neutral-200 shadow-none dark:border-neutral-800 ${className}`}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
