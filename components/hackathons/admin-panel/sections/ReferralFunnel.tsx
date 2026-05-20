"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

interface SourceMeta {
  kind: "user" | "team" | "team_other";
  id: string;
  label: string;
  handle: string | null;
  email: string | null;
}

interface FunnelRow {
  source: SourceMeta;
  registered: number;
  submitted: number;
  won: number;
}

interface ReferralFunnelProps {
  hackathonId: string;
}

const fmtPct = (numerator: number, denominator: number): string => {
  if (denominator === 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
};

const labelForSource = (source: SourceMeta): string => {
  if (source.kind === "user") {
    return source.handle ? `@${source.handle}` : source.label;
  }
  if (source.kind === "team_other") return `Team (other): ${source.label}`;
  return `Team: ${source.label}`;
};

export default function ReferralFunnel({ hackathonId }: ReferralFunnelProps) {
  const [rows, setRows] = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const fetchFunnel = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ hackathon_id: hackathonId });
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());
      const res = await axios.get(`/api/admin/referral-funnel?${params.toString()}`);
      setRows(res.data.rows ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? "Failed to load funnel");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnel();
    // intentionally don't depend on `from`/`to` — explicit Apply button below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hackathonId]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          registered: acc.registered + r.registered,
          submitted: acc.submitted + r.submitted,
          won: acc.won + r.won,
        }),
        { registered: 0, submitted: 0, won: 0 },
      ),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">From</label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">To</label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={fetchFunnel}
          className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded-md text-sm text-white cursor-pointer"
        >
          Apply
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-400">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-zinc-800">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-right">Registered</th>
                <th className="px-3 py-2 text-right">Submitted</th>
                <th className="px-3 py-2 text-right">Won</th>
                <th className="px-3 py-2 text-right">Reg→Sub</th>
                <th className="px-3 py-2 text-right">Sub→Won</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                    No attributed registrations for this event yet.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={`${row.source.kind}:${row.source.id}`} className="border-t border-zinc-800">
                  <td className="px-3 py-2">{labelForSource(row.source)}</td>
                  <td className="px-3 py-2 text-right">{row.registered}</td>
                  <td className="px-3 py-2 text-right">{row.submitted}</td>
                  <td className="px-3 py-2 text-right">{row.won}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">
                    {fmtPct(row.submitted, row.registered)}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-400">
                    {fmtPct(row.won, row.submitted)}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-zinc-900 border-t border-zinc-800">
                <tr className="font-medium">
                  <td className="px-3 py-2">Totals</td>
                  <td className="px-3 py-2 text-right">{totals.registered}</td>
                  <td className="px-3 py-2 text-right">{totals.submitted}</td>
                  <td className="px-3 py-2 text-right">{totals.won}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">
                    {fmtPct(totals.submitted, totals.registered)}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-400">
                    {fmtPct(totals.won, totals.submitted)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Source rows come from <code>ReferralAttribution</code>: <code>?ref=&lt;code&gt;</code> links and
        manual "who referred you" picks. UTM-source/medium breakdowns live in PostHog.
      </p>
    </div>
  );
}
