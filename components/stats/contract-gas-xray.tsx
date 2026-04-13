"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { CustomDateRangePicker } from "@/components/custom-date-range-picker";
import { differenceInCalendarDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { isAddress } from "viem";

import type { ContractGasFlowResponse, XrayTimeRange } from "./contract-gas-xray/types";
import { TIME_OPTIONS } from "./contract-gas-xray/types";
import { formatAvax, formatGas, estimateXrayLoadTime, shortAddr, CLASSIFICATION_CONFIG } from "./contract-gas-xray/utils";
import { FlowDiagram } from "./contract-gas-xray/flow-diagram";
import { FlowTable } from "./contract-gas-xray/flow-table";

// ── Main Component ─────────────────────────────────────────────────────

interface ContractGasXrayProps {
  initialAddress?: string | null;
}

export default function ContractGasXray({ initialAddress }: ContractGasXrayProps = {}) {
  const [isOpen, setIsOpen] = useState(!!initialAddress);
  const [addressInput, setAddressInput] = useState(initialAddress || "");
  const [days, setDays] = useState<XrayTimeRange>("30");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [data, setData] = useState<ContractGasFlowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStartTime, setLoadingStartTime] = useState(() => Date.now());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Compute active days from preset or custom range
  const activeDays = useMemo(() => {
    if (days === "custom" && customRange?.from && customRange?.to) {
      return Math.min(differenceInCalendarDays(customRange.to, customRange.from) + 1, 183);
    }
    return parseInt(days) || 30;
  }, [days, customRange]);

  const customLabel = days === "custom" && customRange?.from && customRange?.to
    ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d")}`
    : null;

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
    // Abort previous
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadingStartTime(Date.now());
    setLoadingProgress(0);
    setError(null);
    setData(null);
    try {
      const result = await apiFetch<ContractGasFlowResponse>(`/api/dapps/contract-gas-flow?address=${addressInput}&days=${activeDays}`, {
        signal: controller.signal,
      });
      setData(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [addressInput, activeDays, isValidAddress]);

  // Auto-analyze when initialAddress is provided
  const hasAutoAnalyzed = useRef(false);
  useEffect(() => {
    if (initialAddress && isValidAddress && !hasAutoAnalyzed.current) {
      hasAutoAnalyzed.current = true;
      analyze();
    }
  }, [initialAddress, isValidAddress, analyze]);

  // Update address when initialAddress changes externally
  const prevInitialAddress = useRef(initialAddress);
  useEffect(() => {
    if (initialAddress && initialAddress !== prevInitialAddress.current) {
      prevInitialAddress.current = initialAddress;
      setAddressInput(initialAddress);
      setIsOpen(true);
      hasAutoAnalyzed.current = false;
    }
  }, [initialAddress]);

  // Re-analyze when activeDays change (if we already have data)
  const prevDaysRef = useRef(activeDays);
  useEffect(() => {
    if (prevDaysRef.current !== activeDays && data) {
      prevDaysRef.current = activeDays;
      analyze();
    }
  }, [activeDays, data, analyze]);

  // Loading progress animation
  useEffect(() => {
    if (!loading) return;
    const estimate = estimateXrayLoadTime(activeDays);
    const interval = setInterval(() => {
      const elapsed = (Date.now() - loadingStartTime) / 1000;
      setLoadingProgress(Math.min(95, (elapsed / estimate) * 80));
    }, 200);
    return () => clearInterval(interval);
  }, [loading, loadingStartTime, activeDays]);

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
            <div className="flex flex-wrap gap-1 items-center">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setDays(opt.value); setCustomRange(undefined); }}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    days === opt.value
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              <CustomDateRangePicker
                customRange={customRange}
                setCustomRange={setCustomRange}
                isCustomActive={days === "custom"}
                open={customPopoverOpen}
                onOpenChange={setCustomPopoverOpen}
                timeRangeLabel={customLabel}
                onApply={() => {
                  if (customRange?.from && customRange?.to) {
                    const span = differenceInCalendarDays(customRange.to, customRange.from);
                    if (span <= 183) {
                      setDays("custom");
                      setCustomPopoverOpen(false);
                    }
                  }
                }}
              />
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
            <div className="py-8 space-y-4">
              {/* 3-column skeleton mimicking flow layout */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
                <div className="flex items-center justify-center">
                  <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
                </div>
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                  ))}
                </div>
              </div>

              {/* Progress indicator */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Spinner className="w-4 h-4" />
                  Querying traces for {shortAddr(addressInput)}...
                </div>
                <div className="w-48 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-amber-500 transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500">
                  ~{estimateXrayLoadTime(activeDays)}s estimated
                </div>
              </div>
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
                  <div className="text-xs text-zinc-400 mb-1">AVAX Received</div>
                  <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono">{formatAvax(data.summary.totalAvaxReceived)} AVAX</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    <span className="text-zinc-500">{formatGas(data.summary.totalGasReceived)} gas</span> · from {data.summary.uniqueCallers.toLocaleString()} callers
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-zinc-400 mb-1">Self-AVAX Burned</div>
                  <div className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">{formatAvax(data.summary.selfAvax)} AVAX</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    <span className="text-zinc-500">{formatGas(data.summary.selfGas)} gas</span> · {(data.selfGasRatio * 100).toFixed(1)}% of received
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-zinc-400 mb-1">AVAX Delegated</div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">{formatAvax(data.summary.totalAvaxGiven)} AVAX</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    <span className="text-zinc-500">{formatGas(data.summary.totalGasGiven)} gas</span> · to {data.callees.length} contracts
                  </div>
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
