"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, ExternalLink, Flame, ArrowRightLeft, Zap } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { isAddress } from "viem";

// ── Types ──────────────────────────────────────────────────────────────

interface AddressInfo {
  address: string;
  name: string | null;
  protocol: string | null;
  category: string | null;
}

interface FlowEntry extends AddressInfo {
  gas: number;
  txCount: number;
  gasPercent: number;
}

interface ContractGasFlowResponse {
  target: AddressInfo;
  classification: "entry_point" | "gas_burner" | "mixed";
  selfGasRatio: number;
  summary: {
    totalGasReceived: number;
    totalGasGiven: number;
    selfGas: number;
    totalTransactions: number;
    uniqueCallers: number;
  };
  callers: FlowEntry[];
  callees: FlowEntry[];
  timeRange: string;
}

type TimeRange = "1" | "7" | "30" | "90";

const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1", label: "1D" },
  { value: "7", label: "1W" },
  { value: "30", label: "1M" },
  { value: "90", label: "3M" },
];

// ── Helpers ────────────────────────────────────────────────────────────

function formatGas(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

function shortAddr(addr: string): string {
  if (addr === "others") return "Others";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function snowtraceUrl(addr: string): string {
  return `https://snowtrace.io/address/${addr}`;
}

const CLASSIFICATION_CONFIG = {
  entry_point: { label: "Entry Point (Router)", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: ArrowRightLeft },
  gas_burner: { label: "Gas Burner", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", icon: Flame },
  mixed: { label: "Mixed", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30", icon: Zap },
} as const;

// ── SVG Flow Diagram ───────────────────────────────────────────────────

function FlowDiagram({ data }: { data: ContractGasFlowResponse }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { callers, callees, summary, target } = data;
  const isMobile = width < 500;

  // Layout constants
  const height = isMobile ? 320 : Math.max(280, Math.max(callers.length, callees.length) * 32 + 60);
  const pad = { x: isMobile ? 10 : 16, y: 24 };
  const nodeW = isMobile ? 8 : 12;
  const centerW = isMobile ? 80 : 120;
  const innerW = width - pad.x * 2;
  const centerX = innerW / 2;

  // Column positions
  const leftX = pad.x;
  const rightX = innerW - pad.x - nodeW;
  const centerLeft = centerX - centerW / 2;
  const centerRight = centerX + centerW / 2;

  // Node layout: distribute vertically proportional to gas
  function layoutNodes(entries: FlowEntry[], totalGas: number) {
    const gap = 3;
    const usable = height - pad.y * 2 - (entries.length - 1) * gap;
    let y = pad.y;
    return entries.map((e) => {
      const ratio = totalGas > 0 ? e.gas / totalGas : 1 / entries.length;
      const h = Math.max(6, ratio * usable);
      const pos = { y, h, mid: y + h / 2 };
      y += h + gap;
      return pos;
    });
  }

  const callerPositions = layoutNodes(callers, summary.totalGasReceived);
  const calleePositions = layoutNodes(callees, summary.totalGasGiven);

  // Center node spans full height
  const centerTop = pad.y;
  const centerBottom = height - pad.y;
  const centerH = centerBottom - centerTop;

  // Bezier path from a source point to a target point
  function bezier(x1: number, y1: number, x2: number, y2: number): string {
    const cx = (x1 + x2) / 2;
    return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
  }

  // Stroke width: proportional to gas, min 1, max 8
  function strokeW(gas: number, total: number): number {
    if (total === 0) return 1;
    return Math.max(1, Math.min(8, (gas / total) * 20));
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="callerGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="calleeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Caller → Center flows */}
        {callers.map((entry, i) => {
          const pos = callerPositions[i];
          const sw = strokeW(entry.gas, summary.totalGasReceived);
          return (
            <path
              key={`c-${i}`}
              d={bezier(leftX + nodeW, pos.mid, centerLeft, centerTop + (pos.mid - pad.y) / (height - pad.y * 2) * centerH)}
              fill="none"
              stroke="url(#callerGrad)"
              strokeWidth={sw}
              opacity={0.7}
            />
          );
        })}

        {/* Center → Callee flows */}
        {callees.map((entry, i) => {
          const pos = calleePositions[i];
          const sw = strokeW(entry.gas, summary.totalGasGiven);
          return (
            <path
              key={`e-${i}`}
              d={bezier(centerRight, centerTop + (pos.mid - pad.y) / (height - pad.y * 2) * centerH, rightX, pos.mid)}
              fill="none"
              stroke="url(#calleeGrad)"
              strokeWidth={sw}
              opacity={0.7}
            />
          );
        })}

        {/* Left caller nodes */}
        {callers.map((entry, i) => {
          const pos = callerPositions[i];
          return (
            <g key={`cn-${i}`}>
              <rect x={leftX} y={pos.y} width={nodeW} height={pos.h} rx={2} fill="#3b82f6" opacity={0.8} />
              {!isMobile && (
                <text x={leftX + nodeW + 6} y={pos.mid + 4} fontSize={10} fill="currentColor" className="text-zinc-500 dark:text-zinc-400">
                  {entry.name || shortAddr(entry.address)}
                </text>
              )}
            </g>
          );
        })}

        {/* Center target node */}
        <rect
          x={centerLeft}
          y={centerTop}
          width={centerW}
          height={centerH}
          rx={6}
          className="fill-zinc-200 dark:fill-zinc-700"
          opacity={0.5}
        />
        <text
          x={centerX}
          y={centerTop + centerH / 2 - 6}
          textAnchor="middle"
          fontSize={isMobile ? 10 : 12}
          fontWeight="bold"
          fill="currentColor"
          className="text-zinc-700 dark:text-zinc-200"
        >
          {target.name || shortAddr(target.address)}
        </text>
        <text
          x={centerX}
          y={centerTop + centerH / 2 + 12}
          textAnchor="middle"
          fontSize={isMobile ? 9 : 10}
          fill="currentColor"
          className="text-zinc-400 dark:text-zinc-500"
        >
          Self: {formatGas(summary.selfGas)} ({(data.selfGasRatio * 100).toFixed(1)}%)
        </text>

        {/* Right callee nodes */}
        {callees.map((entry, i) => {
          const pos = calleePositions[i];
          return (
            <g key={`en-${i}`}>
              <rect x={rightX} y={pos.y} width={nodeW} height={pos.h} rx={2} fill="#f59e0b" opacity={0.8} />
              {!isMobile && (
                <text x={rightX - 6} y={pos.mid + 4} fontSize={10} textAnchor="end" fill="currentColor" className="text-zinc-500 dark:text-zinc-400">
                  {entry.name || shortAddr(entry.address)}
                </text>
              )}
            </g>
          );
        })}

        {/* Column labels */}
        <text x={leftX + nodeW / 2} y={14} textAnchor="middle" fontSize={10} fontWeight="600" fill="currentColor" className="text-zinc-400">
          Callers
        </text>
        <text x={rightX + nodeW / 2} y={14} textAnchor="middle" fontSize={10} fontWeight="600" fill="currentColor" className="text-zinc-400">
          Callees
        </text>
      </svg>
    </div>
  );
}

// ── Flow Table ─────────────────────────────────────────────────────────

function FlowTable({ title, entries, color }: { title: string; entries: FlowEntry[]; color: string }) {
  if (entries.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{title}</h4>
        <p className="text-xs text-zinc-400">No data</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left py-1.5 pr-2 font-medium text-zinc-500">Address</th>
              <th className="text-right py-1.5 px-2 font-medium text-zinc-500">Gas</th>
              <th className="text-right py-1.5 px-2 font-medium text-zinc-500">%</th>
              <th className="text-right py-1.5 pl-2 font-medium text-zinc-500">Txs</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.address} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                    <div className="flex flex-col">
                      {entry.name && (
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{entry.name}</span>
                      )}
                      {entry.address !== "others" ? (
                        <a
                          href={snowtraceUrl(entry.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-blue-500 transition-colors inline-flex items-center gap-0.5"
                        >
                          {shortAddr(entry.address)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-zinc-400">{entry.name}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="text-right py-1.5 px-2 font-mono text-zinc-600 dark:text-zinc-400">{formatGas(entry.gas)}</td>
                <td className="text-right py-1.5 px-2 font-mono text-zinc-500">{entry.gasPercent.toFixed(1)}%</td>
                <td className="text-right py-1.5 pl-2 font-mono text-zinc-500">{formatGas(entry.txCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function ContractGasXray() {
  const [isOpen, setIsOpen] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [days, setDays] = useState<TimeRange>("30");
  const [data, setData] = useState<ContractGasFlowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidAddress = useMemo(() => {
    if (!addressInput) return false;
    try {
      return isAddress(addressInput);
    } catch {
      return false;
    }
  }, [addressInput]);

  const analyze = useCallback(async () => {
    if (!isValidAddress) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/dapps/contract-gas-flow?address=${addressInput}&days=${days}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [addressInput, days, isValidAddress]);

  // Re-analyze when days change (if we already have data)
  const prevDaysRef = useRef(days);
  useEffect(() => {
    if (prevDaysRef.current !== days && data) {
      prevDaysRef.current = days;
      analyze();
    }
  }, [days, data, analyze]);

  const classConfig = data ? CLASSIFICATION_CONFIG[data.classification] : null;
  const ClassIcon = classConfig?.icon;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Search className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Contract Gas X-Ray</span>
          <span className="text-xs text-zinc-400">Paste an address to investigate gas flows</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-5 py-4 space-y-5">
          {/* Input row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value.trim())}
                onKeyDown={(e) => e.key === "Enter" && analyze()}
                placeholder="0x..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono"
              />
              {addressInput && !isValidAddress && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400">Invalid</span>
              )}
            </div>

            {/* Time range pills */}
            <div className="flex gap-1 items-center">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    days === opt.value
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              onClick={analyze}
              disabled={!isValidAddress || loading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? <Spinner className="w-4 h-4" /> : "Analyze"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-zinc-400">
              <Spinner className="w-4 h-4" />
              Querying traces...
            </div>
          )}

          {/* Results */}
          {data && !loading && (
            <div className="space-y-5">
              {/* Classification + Summary */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Classification badge */}
                <div className="flex items-center gap-2">
                  {classConfig && ClassIcon && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border ${classConfig.color}`}>
                      <ClassIcon className="w-3.5 h-3.5" />
                      {classConfig.label}
                    </span>
                  )}
                  {data.target.name && (
                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                      {data.target.name}
                      {data.target.protocol && (
                        <span className="text-zinc-400 font-normal"> ({data.target.protocol})</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-zinc-400 mb-1">Gas Received</div>
                  <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono">{formatGas(data.summary.totalGasReceived)}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">from {data.summary.uniqueCallers.toLocaleString()} callers</div>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-zinc-400 mb-1">Self-Gas Burned</div>
                  <div className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">{formatGas(data.summary.selfGas)}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{(data.selfGasRatio * 100).toFixed(1)}% of received</div>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-zinc-400 mb-1">Gas Delegated</div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">{formatGas(data.summary.totalGasGiven)}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">to {data.callees.length} contracts</div>
                </div>
              </div>

              {/* Flow diagram */}
              {(data.callers.length > 0 || data.callees.length > 0) && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-800/30">
                  <FlowDiagram data={data} />
                </div>
              )}

              {/* Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FlowTable title="Top Callers" entries={data.callers} color="bg-blue-500" />
                <FlowTable title="Top Callees" entries={data.callees} color="bg-amber-500" />
              </div>

              {/* Footer stats */}
              <div className="flex flex-wrap gap-4 text-xs text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <span>Total txs: {data.summary.totalTransactions.toLocaleString()}</span>
                <span>Time range: {data.timeRange}</span>
                <span>Self-gas ratio: {(data.selfGasRatio * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
