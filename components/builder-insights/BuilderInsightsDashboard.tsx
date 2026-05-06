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
  const [creatingTargetKey, setCreatingTargetKey] = useState<string | null>(null);
  const [qrLinkId, setQrLinkId] = useState<string | null>(null);
  const [topReferrerTeamFilter, setTopReferrerTeamFilter] = useState("all");
  const { copiedId: copiedLinkId, copyToClipboard } = useCopyToClipboard({
    resetDelay: 1600,
  });

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
  const targetsByGroup = useMemo(
    () => ({
      signup: data.referralTargets.filter((target) => target.group === "signup"),
      event: data.referralTargets.filter((target) => target.group === "event"),
      grant: data.referralTargets.filter((target) => target.group === "grant"),
    }),
    [data.referralTargets]
  );
  const selectedQrLink = referralLinks.find((link) => link.id === qrLinkId) ?? null;

  const getLatestLinkForTarget = (target: ReferralTargetPreset) =>
    referralLinks.find(
      (link) =>
        link.target_type === target.targetType &&
        (link.target_id ?? null) === target.targetId &&
        link.destination_url === target.destinationUrl
    );

  const handleCopy = async (link: ReferralLinkSummary) => {
    await copyToClipboard(link.shareUrl, link.id);
  };

  const handleGenerateAndCopy = async (target: ReferralTargetPreset) => {
    const existingLink = getLatestLinkForTarget(target);
    if (existingLink && /^[A-Z]{5}$/.test(existingLink.code)) {
      await handleCopy(existingLink);
      setQrLinkId(existingLink.id);
      return;
    }

    setCreatingTargetKey(target.key);
    try {
      const link: ReferralLinkResponse = await createReferralLink({
        targetType: target.targetType,
        targetId: target.targetId,
        destinationUrl: target.destinationUrl,
      });
      setReferralLinks((current) => [link, ...current.filter((item) => item.id !== link.id)].slice(0, 25));
      setQrLinkId(link.id);
      await handleCopy(link);
    } finally {
      setCreatingTargetKey(null);
    }
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
          <MetricCard
            label="Your Builder Impact"
            value={data.userGeneratedReferralImpact}
          />
          <MetricCard
            label="Latest monthly signups"
            value={data.latest30DaySignups}
            deltaPercent={data.rollingSignupDeltaPercent}
          />
        </div>

        <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Referral Link Generator</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ReferralTargetGroup
              title="Builder Hub"
              icon={<UserPlus className="h-4 w-4" />}
              targets={targetsByGroup.signup}
              getLatestLinkForTarget={getLatestLinkForTarget}
              creatingTargetKey={creatingTargetKey}
              copiedLinkId={copiedLinkId}
              onGenerateAndCopy={handleGenerateAndCopy}
            />

            <ReferralTargetGroup
              title="Active And Upcoming Events"
              icon={<CalendarDays className="h-4 w-4" />}
              targets={targetsByGroup.event}
              emptyLabel="No active or upcoming public events found."
              getLatestLinkForTarget={getLatestLinkForTarget}
              creatingTargetKey={creatingTargetKey}
              copiedLinkId={copiedLinkId}
              onGenerateAndCopy={handleGenerateAndCopy}
            />

            <ReferralTargetGroup
              title="Active Grants"
              icon={<Gift className="h-4 w-4" />}
              targets={targetsByGroup.grant}
              getLatestLinkForTarget={getLatestLinkForTarget}
              creatingTargetKey={creatingTargetKey}
              copiedLinkId={copiedLinkId}
              onGenerateAndCopy={handleGenerateAndCopy}
            />

            {selectedQrLink && (
              <div className="grid gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="rounded-md bg-white p-3">
                  <QRCodeSVG value={selectedQrLink.shareUrl} size={132} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">QR Code</div>
                  <div className="truncate text-sm text-neutral-600 dark:text-neutral-400">
                    {selectedQrLink.shareUrl}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleCopy(selectedQrLink)}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copiedLinkId === selectedQrLink.id ? "Copied" : "Copy link"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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

        <div className="grid grid-cols-1 gap-4">
          <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Top Referrers</CardTitle>
              <Select value={topReferrerTeamFilter} onValueChange={setTopReferrerTeamFilter}>
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
                    <TableHead className="text-right">Builder Hub Sign Up</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Hackathons</TableHead>
                    <TableHead className="text-right">Grants</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopReferrers.length ? (
                    filteredTopReferrers.map((row) => (
                      <TableRow key={row.referrerId}>
                        <TableCell className="font-medium">{row.referrer}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.builderHubSignups)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.eventRegistrations)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.hackathonRegistrations)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.grantApplications)}</TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(row.totalReferrals)}</TableCell>
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

          <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
            <CardHeader>
              <CardTitle className="text-base">Team Referrers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Builder Hub Sign Up</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Hackathons</TableHead>
                    <TableHead className="text-right">Grants</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topTeamReferrers.length ? (
                    data.topTeamReferrers.map((row) => (
                      <TableRow key={row.teamId}>
                        <TableCell className="font-medium">{row.team}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.builderHubSignups)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.eventRegistrations)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.hackathonRegistrations)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.grantApplications)}</TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(row.totalReferrals)}</TableCell>
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

function ReferralTargetGroup({
  title,
  icon,
  targets,
  emptyLabel = "No referral targets available.",
  getLatestLinkForTarget,
  creatingTargetKey,
  copiedLinkId,
  onGenerateAndCopy,
}: {
  title: string;
  icon: ReactNode;
  targets: ReferralTargetPreset[];
  emptyLabel?: string;
  getLatestLinkForTarget: (target: ReferralTargetPreset) => ReferralLinkSummary | undefined;
  creatingTargetKey: string | null;
  copiedLinkId: string | null;
  onGenerateAndCopy: (target: ReferralTargetPreset) => Promise<void>;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {icon}
        {title}
      </div>
      {targets.length ? (
        <div className="flex flex-wrap gap-2">
          {targets.map((target) => {
            const existingLink = getLatestLinkForTarget(target);
            const isCreating = creatingTargetKey === target.key;
            const isCopied = existingLink ? copiedLinkId === existingLink.id : false;

            return (
              <Button
                key={target.key}
                size="sm"
                onClick={() => onGenerateAndCopy(target)}
                disabled={isCreating}
                title={target.detail}
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCopied ? "Copied" : target.label}
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-neutral-200 px-3 py-6 text-center text-sm text-neutral-500 dark:border-neutral-800">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  deltaPercent,
}: {
  label: string;
  value: number;
  deltaPercent?: number;
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

  return (
    <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-4xl font-semibold tracking-tight">{formatNumber(value)}</div>
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
