"use client";

import { useMemo } from "react";
import { preload } from "react-dom";
import { usePolledJson } from "@/components/explorer-v2/page-data";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { Board, HashChip, SectionHeader, SpecLine, SpecSheet } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { RANGE_DAYS, RANGE_LABEL, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { formatNumber } from "@/components/explorer-v2/format";
import { parseDateString } from "@/components/stats/chart-axis-utils";
import { BurnHistory, TOKEN_CAP, avax, usdOf, usePriceHistory } from "./token-parts";
import { SupplyModel } from "./token-model";
import { LiveBurnPanel, useLiveBurns } from "./token-live";
import { levelWindow, useBurnHistory, useStakeHistory } from "./overview-series";
import { HoldersSection } from "./token-holders";
import { FEES_URL, ICM_FEES_URL, SUPPLY_URL } from "./network-reads";

/* The network scope's AVAX tab: the token across the P-, C-, and X-Chains
   (formerly /stats/avax-token). Four figures lead; then the 720M cap as
   one solid beside what was issued, with each new block's burn rising
   into it; the fees burned on the page clock beside the burn this
   second; the institutions holding AVAX; and the token's record at the
   foot, which carries every other figure. Mainnet-only. */

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
  // each feed fills its part as it lands, and opens from memory (a visit before, a hovered link's read) while it
  // is read again: the figures and the supply model never wait on the fee history
  const supply = usePolledJson<AvaxSupplyData>(SUPPLY_URL);
  const fees = usePolledJson<CChainFeesResponse>(FEES_URL);
  // ICM data is non-critical: a failed read leaves its series out, and the page stands
  const icm = usePolledJson<ICMFeesResponse>(ICM_FEES_URL);
  const { data, loading } = supply;
  // the page clock in the subnav windows the fee history; bucket width
  // follows it (daily bars up to a month, weekly for a quarter, monthly
  // for a year) so the chart stays readable at every window
  const clock = useExplorerTimeRange();
  const period: Period = clock === "year" || clock === "all" ? "M" : clock === "quarter" ? "W" : "D";
  const prices = usePriceHistory(RANGE_DAYS[clock]);
  const stakeWin = levelWindow(useStakeHistory(), RANGE_DAYS[clock]);
  const burnWin = levelWindow(useBurnHistory(), Math.min(365, RANGE_DAYS[clock]));
  // one live feed for the page: the embers on the solid and the burn panel
  const live = useLiveBurns();

  // the figures' feeds start with the page's HTML (the server render puts these hints in its head), not once its
  // script has run; the reads above get the preloaded responses
  preload(SUPPLY_URL, { as: "fetch", crossOrigin: "anonymous" });
  preload(FEES_URL, { as: "fetch", crossOrigin: "anonymous" });

  const feeRows = fees.data?.feesPaid?.data;
  const cChainFees = useMemo<FeeDataPoint[]>(
    () =>
      (Array.isArray(feeRows) ? feeRows : [])
        .map((item) => ({ date: item.date, timestamp: item.timestamp, value: typeof item.value === "string" ? parseFloat(item.value) : item.value }))
        .reverse(),
    [feeRows],
  );
  const icmRows = icm.data?.data;
  const icmFees = useMemo<FeeDataPoint[]>(
    () => (Array.isArray(icmRows) ? icmRows : []).map((item) => ({ date: item.date, timestamp: item.timestamp, value: item.feesPaid / 1e18 })).reverse(),
    [icmRows],
  );
  const feesError = fees.error ?? (fees.data && !Array.isArray(feeRows) ? "the response is missing its series" : null);
  const error = supply.error
    ? `Failed to fetch the AVAX supply: ${supply.error}`
    : feesError
      ? `Failed to fetch the C-Chain fees: ${feesError}`
      : null;
  const retry = () => [supply, fees, icm].forEach((f) => f.retry());

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

  // the axis form of a bucket: a month for monthly buckets, else a day
  const formatTick = (value: string) => {
    const date = parseDateString(value);
    return period === "M"
      ? date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  // the Data API's figure: genesis plus its staking rewards figure, minus burns
  const totalSupply = n(data?.totalSupply);
  // the cap minus burns: rewards mint from 720M minus the P-Chain's supply counter, and no burn lowers that counter,
  // so the supply stays below this figure
  const maxSupply = TOKEN_CAP - burned;
  const circulating = n(data?.circulatingSupply);
  const pctOf = (v: number, of: number) => (of > 0 ? `${((v / of) * 100).toFixed(1)}%` : undefined);
  const fig = (v: number) => (data ? avax(v) : loading ? null : "—");
  // the record's supply rows in whole AVAX, so they add up as printed
  const whole = (v: number) => formatNumber(Math.round(v));
  const windowNote = clock === "day" ? "7 days" : clock === "all" ? `${RANGE_LABEL.year}, longest window` : RANGE_LABEL[clock];

  return (
    <NetworkShell>
      {error ? (
        // the chrome stands; only the data column reports the failure
        <div className="flex flex-col items-center gap-4 border border-zinc-200 bg-white/80 py-16 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
          <p className="max-w-md px-6 text-center font-mono text-[12px] text-[#E6212F]">{error}</p>
          <button
            onClick={retry}
            className="border border-zinc-300 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          <ReadoutRow>
            <Readout
              label="AVAX Price"
              live
              value={data ? (price > 0 ? `$${price.toFixed(2)}` : "—") : null}
              sub={data && data.priceChange24h ? `${data.priceChange24h >= 0 ? "▲" : "▼"} ${Math.abs(data.priceChange24h).toFixed(2)}% · 24h` : undefined}
              spark={prices}
            />
            <Readout label="Circulating" value={fig(circulating)} unit="AVAX" sub={data ? `net of burns · ${pctOf(circulating, TOKEN_CAP)} of cap · ${usdOf(circulating, price) ?? ""}` : undefined} />
            <Readout
              label="Staked"
              href="/explorer/mainnet/p-chain/staking"
              value={fig(n(data?.totalStaked))}
              unit="AVAX"
              sub={data ? `${pctOf(n(data.totalStaked), circulating)} of circulating` : undefined}
              delta={stakeWin.delta}
              spark={stakeWin.spark}
            />
            <Readout
              label="Burned"
              href="/explorer/mainnet/c-chain/gas"
              value={fig(burned)}
              unit="AVAX"
              sub={usdOf(burned, price)}
              delta={burnWin.delta}
              spark={burnWin.spark}
            />
          </ReadoutRow>

          {data ? (
            <SupplyModel
              circulating={circulating}
              staked={n(data.totalStaked)}
              locked={n(data.totalLocked)}
              burned={burned}
              burnedBy={{ c: n(data.totalCBurned), p: n(data.totalPBurned), x: n(data.totalXBurned) }}
              genesis={n(data.genesisUnlock)}
              rewards={n(data.totalRewards)}
              price={price}
              live={live}
            />
          ) : (
            <div className="h-72 animate-pulse bg-zinc-100 lg:h-[34rem] dark:bg-zinc-900" />
          )}

          {/* the burn over the clock, and the burn this second */}
          <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="flex min-w-0 flex-col gap-4">
              <SectionHeader label="Fees Burned" />
              {aggregatedFeeData.length ? (
                <BurnHistory
                  buckets={aggregatedFeeData}
                  label="C-Chain Fees Burned"
                  note={windowNote}
                  dateLabel={formatTooltipDate}
                  tickLabel={formatTick}
                  price={price}
                />
              ) : (
                <div className="h-[22rem] animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              )}
            </section>
            <LiveBurnPanel live={live} price={price} />
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
                <SpecLine label="Supply Cap">
                  {TOKEN_CAP.toLocaleString("en-US")} AVAX <span className="text-zinc-400 dark:text-zinc-500">· fixed; minting never passes it</span>
                </SpecLine>
                {data && (
                  <>
                    {/* the supply as a sum, top to bottom: minted, less burned, is the total; the cap less burned bounds it */}
                    <SpecLine label="Genesis Unlock">
                      {whole(n(data.genesisUnlock))} AVAX <span className="text-zinc-400 dark:text-zinc-500">· minted at launch, {pctOf(n(data.genesisUnlock), TOKEN_CAP)} of cap</span>
                    </SpecLine>
                    <SpecLine label="Staking Rewards">
                      {whole(n(data.totalRewards))} AVAX <span className="text-zinc-400 dark:text-zinc-500">· minted since launch</span>
                    </SpecLine>
                    <SpecLine label="Burned">
                      {whole(burned)} AVAX <span className="text-zinc-400 dark:text-zinc-500">· fees on the P-, C- and X-Chains; burned AVAX still counts against the cap, so it is never minted again</span>
                    </SpecLine>
                    <SpecLine label="Total Supply">
                      {whole(totalSupply)} AVAX <span className="text-zinc-400 dark:text-zinc-500">· minted minus burned: the AVAX that exists now, {pctOf(totalSupply, TOKEN_CAP)} of cap</span>
                    </SpecLine>
                    <SpecLine label="Max Supply">
                      {whole(maxSupply)} AVAX <span className="text-zinc-400 dark:text-zinc-500">· the cap minus burned; the total supply stays below it</span>
                    </SpecLine>
                    <SpecLine label="Locked">
                      {avax(n(data.totalLocked))} AVAX <span className="text-zinc-400 dark:text-zinc-500">· {pctOf(n(data.totalLocked), circulating)} of circulating</span>
                    </SpecLine>
                    <SpecLine label="L1 Validator Fees">
                      {avax(n(data.l1ValidatorFees))} AVAX <span className="text-zinc-400 dark:text-zinc-500">· paid, all time</span>
                    </SpecLine>
                    {/* the ICM fee feed can come back empty; no data is not zero fees */}
                    {icmFees.length > 0 && (
                      <SpecLine label="ICM Fees">
                        {avax(icmTotal)} AVAX <span className="text-zinc-400 dark:text-zinc-500">· {clock === "all" ? "1 year" : RANGE_LABEL[clock]}</span>
                      </SpecLine>
                    )}
                  </>
                )}
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
