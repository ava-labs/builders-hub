"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

/**
 * Self-contained wrapper components for metrics visualizations.
 * Each wrapper fetches its own data so the AI only needs to call
 * render_component with no (or minimal) props.
 */

function MetricsLoading({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-8 flex items-center justify-center gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Loading {label}...</span>
    </div>
  );
}

function MetricsError({ label, retry }: { label: string; retry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm text-destructive">Failed to load {label}</p>
      <button onClick={retry} className="mt-2 text-xs font-medium text-primary hover:underline">
        Try again
      </button>
    </div>
  );
}

// ─── ICM Flow Visualization ──────────────────────────────────────────────────

export function ICMFlowWrapper() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ICMFlowChart, setICMFlowChart] = useState<any>(null);

  const fetchData = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      apiFetch<any>("/api/icm-flow"),
      import("@/components/stats/ICMFlowChart"),
    ])
      .then(([flowData, mod]) => {
        setData(flowData);
        setICMFlowChart(() => mod.default);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <MetricsLoading label="ICM flow diagram" />;
  if (error || !ICMFlowChart) return <MetricsError label="ICM flow diagram" retry={fetchData} />;

  return (
    <div className="rounded-xl border overflow-hidden">
      <ICMFlowChart data={data} maxFlows={30} showLabels animationEnabled />
    </div>
  );
}

// ─── ICTT Dashboard ──────────────────────────────────────────────────────────

export function ICTTDashboardWrapper() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ICTTDashboard, setICTTDashboard] = useState<any>(null);

  const fetchData = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      apiFetch<any>("/api/ictt-stats"),
      import("@/components/stats/ICTTDashboard"),
    ])
      .then(([statsData, mod]) => {
        setData(statsData);
        setICTTDashboard(() => mod.ICTTDashboard);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <MetricsLoading label="ICTT dashboard" />;
  if (error || !ICTTDashboard) return <MetricsError label="ICTT dashboard" retry={fetchData} />;

  return (
    <div className="rounded-xl border overflow-hidden p-4">
      <ICTTDashboard data={data} showTitle={false} />
    </div>
  );
}

// ─── Overview Stats Card ─────────────────────────────────────────────────────

interface OverviewStats {
  aggregated: {
    totalTxCount: number;
    totalTps: number;
    totalActiveAddresses: number;
    totalICMMessages: number;
    totalMarketCap: number;
    totalValidators: number;
    activeChains: number;
  };
  chains: Array<{
    chainId: string;
    chainName: string;
    chainLogoURI: string;
    txCount: number;
    tps: number;
    activeAddresses: number;
    validatorCount: number | string;
    marketCap: number | null;
  }>;
}

function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

export function OverviewStatsCard() {
  const [data, setData] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(false);
    apiFetch<OverviewStats>("/api/overview-stats?timeRange=day")
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <MetricsLoading label="network stats" />;
  if (error || !data) return <MetricsError label="network stats" retry={fetchData} />;

  const { aggregated, chains } = data;
  // Sort chains by active addresses descending for the top chains list
  const topChains = [...chains]
    .filter((c) => c.activeAddresses > 0)
    .sort((a, b) => b.activeAddresses - a.activeAddresses)
    .slice(0, 8);

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Aggregate metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        {[
          { label: "Active Addresses", value: formatNumber(aggregated.totalActiveAddresses) },
          { label: "Transactions (24h)", value: formatNumber(aggregated.totalTxCount) },
          { label: "Avg TPS", value: aggregated.totalTps.toFixed(1) },
          { label: "Validators", value: formatNumber(aggregated.totalValidators) },
          { label: "ICM Messages", value: formatNumber(aggregated.totalICMMessages) },
          { label: "Market Cap", value: formatUSD(aggregated.totalMarketCap) },
          { label: "Active Chains", value: String(aggregated.activeChains) },
        ].map((stat) => (
          <div key={stat.label} className="bg-background p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-semibold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Top chains table */}
      {topChains.length > 0 && (
        <div className="border-t">
          <div className="px-4 py-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">Top Chains by Active Addresses</p>
          </div>
          <div className="divide-y">
            {topChains.map((chain) => (
              <div key={chain.chainId} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {chain.chainLogoURI && (
                    <img src={chain.chainLogoURI} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="font-medium">{chain.chainName}</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground text-xs">
                  <span>{formatNumber(chain.activeAddresses)} addr</span>
                  <span>{formatNumber(chain.txCount)} txns</span>
                  <span>{chain.tps.toFixed(1)} tps</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
