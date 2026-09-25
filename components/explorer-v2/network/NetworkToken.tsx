"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { Board, HashChip, SectionHeader, SpecLine, SpecSheet } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { RANGE_DAYS, RANGE_LABEL, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { parseDateString } from "@/components/stats/chart-axis-utils";
import { BurnBoard, FeeBlock, LiveBurnsBoard, SupplyBoard, TOKEN_CAP, avax, usdOf, usePriceHistory } from "./token-parts";
import { HoldersSection } from "./token-holders";

/* The network scope's Token facet: AVAX across the P-, C-, and X-Chains
   (formerly /stats/avax-token). The figures lead; then where the cap
   sits and what each chain has burned, the fees burned on the page clock
   beside the live burn, the institutions holding AVAX, and the token's
   record at the foot. Mainnet-only. */

const AVAX_ASSET_ID = "FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z";
const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";

interface AvaxSupplyData {
  totalSupply: string;
  circulatingSupply: string;
  totalPBurned: string;
  totalCBurned: string;
  totalXBurned: string;
  totalStaked: string;
  totalLocked: string;
  totalRewards: string;
  lastUpdated: string;
  genesisUnlock: string;
  l1ValidatorFees: string;
  price: number;
  priceChange24h: number;
}

interface FeeDataPoint {
  date: string;
  timestamp: number;
  value: number;
}

interface CChainFeesResponse {
  feesPaid: {
    data: Array<{ date: string; timestamp: number; value: string | number }>;
  };
}

interface ICMFeesResponse {
  data: Array<{
    date: string;
    timestamp: number;
    feesPaid: number;
    txCount: number;
  }>;
  totalFees: number;
  lastUpdated: string;
}

type Period = "D" | "W" | "M";

export function NetworkToken() {
  const [data, setData] = useState<AvaxSupplyData | null>(null);
  const [cChainFees, setCChainFees] = useState<FeeDataPoint[]>([]);
  const [icmFees, setICMFees] = useState<FeeDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // the page clock in the subnav windows the fee history; bucket width
  // follows it (daily bars up to a month, weekly for a quarter, monthly
  // for a year) so the chart stays readable at every window
  const clock = useExplorerTimeRange();
  const period: Period = clock === "year" || clock === "all" ? "M" : clock === "quarter" ? "W" : "D";
  const prices = usePriceHistory(RANGE_DAYS[clock]);

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const [supplyRes, cChainRes, icmRes] = await Promise.all([
        fetch("/api/avax-supply", { signal: controller.signal }),
        fetch("/api/chain-stats/43114?timeRange=1y", { signal: controller.signal }),
        fetch("/api/icm-contract-fees?timeRange=1y", { signal: controller.signal }),
      ]);

      if (!supplyRes.ok || !cChainRes.ok) {
        throw new Error(
          `Failed to fetch required data (supply: HTTP ${supplyRes.status}, c-chain: HTTP ${cChainRes.status})`
        );
      }

      const supplyData = await supplyRes.json();
      const cChainData: CChainFeesResponse = await cChainRes.json();

      setData(supplyData);

      const cChainFeesRaw = cChainData?.feesPaid?.data;
      if (!Array.isArray(cChainFeesRaw)) {
        throw new Error("C-Chain fees response is missing expected shape");
      }
      const cChainFeesData: FeeDataPoint[] = cChainFeesRaw
        .map((item) => ({
          date: item.date,
          timestamp: item.timestamp,
          value: typeof item.value === "string" ? parseFloat(item.value) : item.value,
        }))
        .reverse();

      setCChainFees(cChainFeesData);

      if (icmRes.ok) {
        const icmData: ICMFeesResponse = await icmRes.json();
        if (icmData.data && Array.isArray(icmData.data)) {
          const icmFeesData: FeeDataPoint[] = icmData.data
            .map((item) => ({
              date: item.date,
              timestamp: item.timestamp,
              value: item.feesPaid / 1e18,
            }))
            .reverse();
          setICMFees(icmFeesData);
        }
      } else {
        // ICM data is non-critical: log and continue without breaking the page.
        console.warn(`ICM contract fees fetch failed: HTTP ${icmRes.status}`);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const aggregatedFeeData = useMemo(() => {
    if (cChainFees.length === 0 && icmFees.length === 0) return [];

    const allDates = new Set([...cChainFees.map((d) => d.date), ...icmFees.map((d) => d.date)]);
    const cChainMap = new Map(cChainFees.map((d) => [d.date, d.value]));
    const icmMap = new Map(icmFees.map((d) => [d.date, d.value]));

    let mergedData = Array.from(allDates)
      .map((date) => ({
        date,
        cChainFees: cChainMap.get(date) || 0,
        icmFees: icmMap.get(date) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      // the fetch stays at the full year; the page clock slices the window,
      // floored at a week because one bar says nothing
      .slice(-Math.max(7, RANGE_DAYS[clock]));

    if (period === "D") return mergedData;

    const grouped = new Map<
      string,
      { cChainSum: number; icmSum: number; date: string }
    >();

    mergedData.forEach((point) => {
      const [year, month, day] = point.date.split("-").map(Number);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(year, month - 1, day);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const wy = weekStart.getFullYear();
        const wm = String(weekStart.getMonth() + 1).padStart(2, "0");
        const wd = String(weekStart.getDate()).padStart(2, "0");
        key = `${wy}-${wm}-${wd}`;
      } else {
        key = `${year}-${String(month).padStart(2, "0")}`;
      }

      if (!grouped.has(key)) {
        grouped.set(key, { cChainSum: 0, icmSum: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.cChainSum += point.cChainFees;
      group.icmSum += point.icmFees;
    });

    return Array.from(grouped.values())
      .map((group) => ({
        date: group.date,
        cChainFees: group.cChainSum,
        icmFees: group.icmSum,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [cChainFees, icmFees, period, clock]);

  const formatTooltipDate = (value: string) => {
    const date = parseDateString(value);

    if (period === "M") {
      return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }

    if (period === "W") {
      const endDate = new Date(date.getTime());
      endDate.setDate(date.getDate() + 6);

      const startMonth = date.toLocaleDateString("en-US", { month: "long" });
      const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
      const startDay = date.getDate();
      const endDay = endDate.getDate();
      const year = endDate.getFullYear();

      if (startMonth === endMonth) {
        return `${startMonth} ${startDay}-${endDay}, ${year}`;
      } else {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
      }
    }

    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // the clock's window of the ICM series, for its readout
  const icmWindow = useMemo(() => icmFees.slice(-Math.min(365, RANGE_DAYS[clock])), [icmFees, clock]);
  const icmTotal = icmWindow.reduce((sum, item) => sum + item.value, 0);

  const n = (v: string | undefined) => {
    const x = parseFloat(v ?? "");
    return Number.isFinite(x) ? x : 0;
  };
  const price = data?.price ?? 0;
  const burned = data ? n(data.totalPBurned) + n(data.totalCBurned) + n(data.totalXBurned) : 0;
  // the cap less every burn
  const totalSupply = TOKEN_CAP - burned;
  const circulating = n(data?.circulatingSupply);
  const pctOf = (v: number, of: number) => (of > 0 ? `${((v / of) * 100).toFixed(1)}%` : undefined);
  const fig = (v: number) => (data ? avax(v) : loading ? null : "—");
  const windowNote = clock === "day" ? "7 days" : clock === "all" ? `${RANGE_LABEL.year}, longest window` : RANGE_LABEL[clock];

  return (
    <NetworkShell>
      {error ? (
        // the chrome stands; only the data column reports the failure
        <div className="flex flex-col items-center gap-4 border border-zinc-200 bg-white/80 py-16 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
          <p className="max-w-md px-6 text-center font-mono text-[12px] text-[#E6212F]">{error}</p>
          <button
            onClick={fetchData}
            className="border border-zinc-300 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          <ReadoutRow cols={5}>
            <Readout
              label="AVAX Price"
              live
              value={data ? (price > 0 ? `$${price.toFixed(2)}` : "—") : null}
              sub={data && data.priceChange24h ? `${data.priceChange24h >= 0 ? "▲" : "▼"} ${Math.abs(data.priceChange24h).toFixed(2)}% · 24h` : undefined}
              spark={prices}
            />
            <Readout label="Circulating Supply" value={fig(circulating)} unit="AVAX" sub={usdOf(circulating, price)} />
            <Readout label="Total Supply" value={fig(totalSupply)} unit="AVAX" sub={data ? `${pctOf(totalSupply, TOKEN_CAP)} of cap` : undefined} />
            <Readout
              label="Total Staked"
              href="/explorer/mainnet/p-chain/staking"
              value={fig(n(data?.totalStaked))}
              unit="AVAX"
              sub={data ? `${pctOf(n(data.totalStaked), circulating)} of circulating` : undefined}
            />
            <Readout label="Total Locked" value={fig(n(data?.totalLocked))} unit="AVAX" sub={data ? `${pctOf(n(data.totalLocked), circulating)} of circulating` : undefined} />
            <Readout label="Staking Rewards" href="/explorer/mainnet/p-chain/staking" value={fig(n(data?.totalRewards))} unit="AVAX" sub={data ? "issued, all time" : undefined} />
            <Readout label="Genesis Unlock" value={fig(n(data?.genesisUnlock))} unit="AVAX" sub={data ? `${pctOf(n(data.genesisUnlock), TOKEN_CAP)} of cap` : undefined} />
            <Readout label="Total Burned" href="/explorer/mainnet/c-chain/gas" value={fig(burned)} unit="AVAX" sub={usdOf(burned, price)} />
            <Readout label="L1 Validator Fees" href="/explorer/mainnet/p-chain/l1s" value={fig(n(data?.l1ValidatorFees))} unit="AVAX" sub={data ? "paid, all time" : undefined} />
            <Readout
              label="ICM Fees"
              href="/explorer/mainnet/chains"
              value={data ? avax(icmTotal) : loading ? null : "—"}
              unit="AVAX"
              sub={clock === "all" ? "1 year" : RANGE_LABEL[clock]}
              spark={RANGE_DAYS[clock] >= 7 ? icmWindow.map((d) => d.value) : undefined}
            />
          </ReadoutRow>

          {data ? (
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <SupplyBoard circulating={circulating} staked={n(data.totalStaked)} locked={n(data.totalLocked)} burned={burned} />
              <BurnBoard c={n(data.totalCBurned)} p={n(data.totalPBurned)} x={n(data.totalXBurned)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="h-72 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-72 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            </div>
          )}

          {/* the burn over the clock, and the burn this second */}
          <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="flex min-w-0 flex-col gap-4">
              <SectionHeader label="Fees Burned" />
              {aggregatedFeeData.length ? (
                <FeeBlock
                  buckets={aggregatedFeeData}
                  label="C-Chain Fees Burned"
                  note={windowNote}
                  dateLabel={formatTooltipDate}
                  price={price}
                />
              ) : (
                <div className="h-[22rem] animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              )}
            </section>
            <LiveBurnsBoard />
          </div>

          <HoldersSection circulating={circulating} />

          {/* the token's record: identifiers and the numbers behind the figures */}
          <section className="flex flex-col gap-4">
            <SectionHeader label="Token Record" />
            <Board divide={false} className="px-5 md:px-6">
              <SpecSheet>
                <SpecLine label="Asset ID">
                  <HashChip value={AVAX_ASSET_ID} href={`/explorer/mainnet/x-chain/asset/${AVAX_ASSET_ID}`} len={12} />
                </SpecLine>
                <SpecLine label="WAVAX">
                  <HashChip value={WAVAX} href={`/explorer/mainnet/c-chain/address/${WAVAX}`} len={12} />
                </SpecLine>
                <SpecLine label="Supply Cap">{TOKEN_CAP.toLocaleString("en-US")} AVAX</SpecLine>
                <SpecLine label="Denomination">9 decimals on the P- and X-Chains, 18 on the C-Chain</SpecLine>
                {data?.lastUpdated && <SpecLine label="Updated">{new Date(data.lastUpdated).toLocaleString("en-US")}</SpecLine>}
              </SpecSheet>
            </Board>
          </section>
        </div>
      )}
    </NetworkShell>
  );
}
