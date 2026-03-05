"use client";

import { useState } from "react";
import { Search, Activity, Blocks, Shield, AlertTriangle, Copy, Check } from "lucide-react";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
  title: "Validator Lookup",
  description: "Look up any Avalanche Primary Network validator by Node ID to view uptime, block production, staking details, and health metrics.",
  toolRequirements: [],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

interface ValidatorDetail {
  node_id: string;
  current_p50_uptime: number;
  bench_observers: number;
  weight: number;
  delegator_weight: number;
  delegator_count: number;
  delegation_fee: number;
  potential_reward: number;
  version: string;
  public_ip: string;
  days_left: number;
  miss_rate_14d: number;
  missed_14d: number;
  proposed_14d: number;
  uptime_details: {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
  };
  slots: { slot: number; cnt: number }[];
}

function formatAvax(nAvax: number): string {
  return (nAvax / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " AVAX";
}

function MetricCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color || "text-zinc-900 dark:text-zinc-100"}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`text-sm font-medium ${color || ""}`}>{value}</span>
    </div>
  );
}

function ValidatorLookupInner(_props: BaseConsoleToolProps) {
  const [nodeId, setNodeId] = useState("");
  const [data, setData] = useState<ValidatorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleLookup = async () => {
    let id = nodeId.trim();
    if (!id) return;
    if (!id.startsWith("NodeID-")) id = `NodeID-${id}`;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/validators/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Validator not found");
        throw new Error(`Failed to fetch (${res.status})`);
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyNodeId = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.node_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const uptimeColor = (v: number) =>
    v >= 99 ? "text-emerald-600 dark:text-emerald-400" : v >= 80 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const missColor = (v: number) =>
    v === 0 ? "text-emerald-600 dark:text-emerald-400" : v < 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const daysColor = (v: number) =>
    v < 7 ? "text-red-600 dark:text-red-400" : v < 30 ? "text-yellow-600 dark:text-yellow-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Enter Node ID (e.g. NodeID-1aA7BtLfTX4SRXaWR8HttP4z2UapE1R9)"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleLookup}
          disabled={loading || !nodeId.trim()}
          className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Looking up..." : "Lookup"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-5">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <h3 className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{data.node_id}</h3>
              <button onClick={copyNodeId} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0 translate-y-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
              </button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {data.version && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{data.version}</span>
              )}
              {data.public_ip && (
                <span className="text-xs text-zinc-400 font-mono">{data.public_ip}</span>
              )}
              <a
                href={`/stats/validators/node/${encodeURIComponent(data.node_id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Full Details &rarr;
              </a>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Uptime (p50)"
              value={`${data.current_p50_uptime.toFixed(2)}%`}
              color={uptimeColor(data.current_p50_uptime)}
              sub={data.uptime_details ? `min ${data.uptime_details.min.toFixed(2)}% / p95 ${data.uptime_details.p95.toFixed(2)}%` : undefined}
            />
            <MetricCard
              label="Miss Rate (14d)"
              value={`${data.miss_rate_14d.toFixed(1)}%`}
              color={missColor(data.miss_rate_14d)}
              sub={`${data.missed_14d} missed / ${data.proposed_14d + data.missed_14d} total`}
            />
            <MetricCard
              label="Total Stake"
              value={formatAvax(data.weight + data.delegator_weight)}
              sub={data.delegator_weight > 0 ? `+ ${formatAvax(data.delegator_weight)} delegated` : undefined}
            />
            <MetricCard
              label="Days Left"
              value={String(data.days_left)}
              color={daysColor(data.days_left)}
            />
          </div>

          {/* Staking Details */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-zinc-400" /> Staking
              </h4>
              <DetailRow label="Own Stake" value={formatAvax(data.weight)} />
              <DetailRow label="Delegated" value={formatAvax(data.delegator_weight)} />
              <DetailRow label="Delegators" value={String(data.delegator_count)} />
              <DetailRow label="Delegation Fee" value={`${data.delegation_fee}%`} />
              <DetailRow label="Potential Reward" value={formatAvax(data.potential_reward)} color="text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-zinc-400" /> Health
              </h4>
              {data.uptime_details && (
                <>
                  <DetailRow label="Uptime Observers" value={String(data.uptime_details.count)} />
                  <DetailRow label="Uptime Avg" value={`${data.uptime_details.avg.toFixed(4)}%`} />
                  <DetailRow label="Uptime P50" value={`${data.uptime_details.p50.toFixed(4)}%`} />
                  <DetailRow label="Uptime P95" value={`${data.uptime_details.p95.toFixed(4)}%`} />
                </>
              )}
              <DetailRow
                label="Bench Observers"
                value={String(data.bench_observers)}
                color={data.bench_observers > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-emerald-600 dark:text-emerald-400"}
              />
              <DetailRow label="Blocks Proposed (14d)" value={String(data.proposed_14d)} />
              <DetailRow
                label="Blocks Missed (14d)"
                value={String(data.missed_14d)}
                color={data.missed_14d > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
              />
            </div>
          </div>

          {/* Proposal Timing */}
          {data.slots && data.slots.length > 0 && (() => {
            const total = data.slots.reduce((s, x) => s + x.cnt, 0);
            if (total === 0) return null;
            const slot0 = data.slots.find(s => s.slot === 0)?.cnt ?? 0;
            const slot1 = data.slots.find(s => s.slot === 1)?.cnt ?? 0;
            const slot2plus = data.slots.filter(s => s.slot >= 2).reduce((s, x) => s + x.cnt, 0);
            const pct = (v: number) => ((v / total) * 100).toFixed(1);

            return (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-1.5">
                  <Blocks className="h-3.5 w-3.5 text-zinc-400" /> Proposal Timing (14d)
                </h4>
                <div className="h-3 rounded-full overflow-hidden flex bg-zinc-200 dark:bg-zinc-700 mb-3">
                  <div className="bg-emerald-500 dark:bg-emerald-400 transition-all" style={{ width: `${pct(slot0)}%` }} />
                  {slot1 > 0 && <div className="bg-yellow-500 dark:bg-yellow-400 transition-all" style={{ width: `${pct(slot1)}%` }} />}
                  {slot2plus > 0 && <div className="bg-red-500 dark:bg-red-400 transition-all" style={{ width: `${Math.max(parseFloat(pct(slot2plus)), 1)}%` }} />}
                </div>
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1" />
                    <span className="text-zinc-500 dark:text-zinc-400">Slot 0</span>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">{pct(slot0)}%</p>
                    <p className="text-xs text-zinc-400">{slot0.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="inline-block w-2 h-2 rounded-sm bg-yellow-500 mr-1" />
                    <span className="text-zinc-500 dark:text-zinc-400">Slot 1</span>
                    <p className="font-semibold text-yellow-600 dark:text-yellow-400">{pct(slot1)}%</p>
                    <p className="text-xs text-zinc-400">{slot1.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />
                    <span className="text-zinc-500 dark:text-zinc-400">Slot 2+</span>
                    <p className="font-semibold text-red-600 dark:text-red-400">{pct(slot2plus)}%</p>
                    <p className="text-xs text-zinc-400">{slot2plus.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {data.bench_observers > 0 && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This validator currently has {data.bench_observers} bench observer(s). This may indicate connectivity or performance issues.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ValidatorLookup = withConsoleToolMetadata(ValidatorLookupInner, metadata);
export default ValidatorLookup;
