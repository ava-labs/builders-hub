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
import { Copy, Link2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BuilderInsightsData } from "@/server/services/builderInsights";
import type { ReferralTargetType } from "@/lib/referrals/constants";

interface ReferralLinkSummary {
  id: string;
  code: string;
  target_type: string;
  target_id: string | null;
  destination_url: string;
  created_at: string | Date;
  shareUrl: string;
}

interface BuilderInsightsDashboardProps {
  data: BuilderInsightsData;
  referralLinks: ReferralLinkSummary[];
}

const TARGET_OPTIONS: Array<{ value: ReferralTargetType; label: string; destination: string }> = [
  { value: "bh_signup", label: "BH signup", destination: "/profile" },
  { value: "hackathon_registration", label: "Hackathon registration", destination: "/events/registration-form" },
  { value: "build_games_application", label: "Build Games application", destination: "/build-games/apply" },
  { value: "grant_application", label: "Grant application", destination: "/grants" },
];

function formatNumber(value: number): string {
  return value.toLocaleString();
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
  const [referralLinks, setReferralLinks] = useState(initialReferralLinks);
  const [targetType, setTargetType] = useState<ReferralTargetType>("bh_signup");
  const [targetId, setTargetId] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("/profile");
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const monthlyData = data.monthlySignups;
  const referrerData = data.signupsByReferrer.map((row) => ({
    ...row,
    label: shortLabel(row.referrer, 28),
  }));
  const eventData = data.eventParticipants.map((row) => ({
    ...row,
    label: shortLabel(row.event, 24),
  }));
  const sourceData = data.signupSources;

  const latestMonthlySignups = monthlyData.length
    ? monthlyData[monthlyData.length - 1].signups
    : 0;
  const topEvent = useMemo(() => data.eventParticipants[0], [data.eventParticipants]);

  const handleTargetTypeChange = (value: ReferralTargetType) => {
    setTargetType(value);
    const option = TARGET_OPTIONS.find((target) => target.value === value);
    setDestinationUrl(option?.destination ?? "/profile");
  };

  const handleCreateLink = async () => {
    setIsCreatingLink(true);
    try {
      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId: targetId.trim() || null,
          destinationUrl: destinationUrl.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create referral link");
      }

      const link = await response.json();
      setReferralLinks((current) => [link, ...current].slice(0, 25));
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopy = async (link: ReferralLinkSummary) => {
    await navigator.clipboard.writeText(link.shareUrl);
    setCopiedLinkId(link.id);
    setTimeout(() => setCopiedLinkId(null), 1600);
  };

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Builder Insights</h1>
          <p className="max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
            Account growth, referral attribution, and event participation for Builder Hub.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard label="Total BH accounts" value={data.totalAccounts} />
          <MetricCard label="Build Games BH participants" value={data.buildGamesParticipants} />
          <MetricCard label="Latest monthly signups" value={latestMonthlySignups} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="BH Signups By Month">
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

          <ChartCard title="BH Cumulative Signups By Month">
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

          <ChartCard title="BH Signups By Referrer">
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
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Signup Source Breakdown" className="lg:col-span-1">
            {sourceData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourceData} layout="vertical" margin={{ top: 12, right: 18, bottom: 8, left: 92 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="source" tickLine={false} axisLine={false} fontSize={12} width={130} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="signups" name="Signups" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No source data yet" />
            )}
          </ChartCard>

          <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Top Referrers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead className="text-right">BH</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Build Games</TableHead>
                    <TableHead className="text-right">Grants</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topReferrers.length ? (
                    data.topReferrers.map((row) => (
                      <TableRow key={row.referrerId}>
                        <TableCell className="font-medium">{row.referrer}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.bhSignups)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.hackathonRegistrations)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.buildGamesApplications)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.grantApplications)}</TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(row.totalConversions)}</TableCell>
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
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base">Referral Link Generator</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[220px_1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">Target</span>
              <select
                value={targetType}
                onChange={(event) => handleTargetTypeChange(event.target.value as ReferralTargetType)}
                className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm dark:border-neutral-800 dark:bg-neutral-950"
              >
                {TARGET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">Destination path</span>
              <Input value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">Target ID optional</span>
              <Input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="event or program id" />
            </label>
            <Button className="self-end" onClick={handleCreateLink} disabled={isCreatingLink}>
              {isCreatingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </CardContent>
          <CardContent>
            <div className="grid gap-2">
              {referralLinks.length ? (
                referralLinks.map((link) => (
                  <div
                    key={link.id}
                    className="grid gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800 md:grid-cols-[180px_1fr_auto]"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Link2 className="h-4 w-4 text-neutral-500" />
                      {link.target_type.replaceAll("_", " ")}
                    </div>
                    <div className="truncate text-neutral-600 dark:text-neutral-400">{link.shareUrl}</div>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(link)}>
                      <Copy className="mr-2 h-4 w-4" />
                      {copiedLinkId === link.id ? "Copied" : "Copy"}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-neutral-200 px-3 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
                  No referral links created yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-semibold tracking-tight">{formatNumber(value)}</div>
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
