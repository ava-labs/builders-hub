"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, HashChip, SectionHeader, SpecLine, SpecSheet, StatCell, StatStrip, SubjectHeadline, HEAD, ROW, idInk } from "@/components/explorer-v2/ui";
import { formatNumber, timeAgo, truncate, ageShort } from "@/components/explorer-v2/format";
import { useEvmData } from "./hooks";
import { EvmContract } from "./EvmContract";
import { TokenLogo } from "./TokenMark";
import { FIG, UNIT, Tabs, TxTable, EmptyRow } from "./AddressTables";
import { useErc20Meta, useTokenTransfers } from "./useErc20";
import { formatPriceUsd, formatTokenAmount, formatUsd, usdOfToken, usdValue, useTokenList, useTokenPrices, type TokenInfo } from "@/lib/token-list";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { AddressSummary, TxListResponse } from "@/lib/evm-explorer";
import type { SourcifyContract } from "@/lib/sourcify-client";

/* A token, on the address route: the contract that IS the token. Mark and
   name as the subject, the readings a token is judged by in a strip
   (price, supply, market value, how much it moves), its identifiers in a
   sheet, then its transfers (read live off the chain's Transfer logs),
   the contract's transactions, and its source. */

type Tab = "transfers" | "txs" | "contract";
const LABELS: Record<Tab, string> = { transfers: "Transfers", txs: "Transactions", contract: "Contract" };

export function EvmToken({
  network,
  addr,
  listed,
  verified,
  initialTab,
  justVerified,
}: {
  network: string;
  addr: string;
  /** the token list's record, when the list has it */
  listed: TokenInfo | null;
  verified: SourcifyContract | null;
  initialTab?: string;
  justVerified?: boolean;
}) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const [tab, setTab] = useState<Tab>(initialTab === "contract" ? "contract" : "transfers");

  const meta = useErc20Meta(c.rpcUrl, addr);
  const symbol = listed?.symbol ?? meta?.symbol ?? "TOKEN";
  const name = listed?.name ?? meta?.name ?? verified?.name ?? "Token";
  const decimals = listed?.decimals ?? meta?.decimals ?? 18;
  const token: TokenInfo = listed ?? { symbol, name, decimals, logoURI: null };

  const prices = useTokenPrices(c.chainId, [addr]);
  const price = prices.get(addr.toLowerCase());
  const supply = meta?.totalSupply ?? null;
  const marketValue = supply !== null && price ? usdValue(supply, decimals, price) : null;

  const summary = useEvmData<AddressSummary>(c.chainId, `address/${addr}`, undefined, { retry404Ms: 15_000 });
  const txs = useEvmData<TxListResponse>(c.chainId, `address/${addr}/txs`, { limit: 50 });
  const transfers = useTokenTransfers(c.rpcUrl, addr, { span: 2_000, limit: 50 });
  const tokens = useTokenList(c.chainId);

  // how much it moved over the log window, in tokens and dollars
  const moved = transfers.rows.reduce((acc, r) => acc + r.amount, 0n);
  const windowMin = Math.round((transfers.span * 1) / 60); // ~1 s blocks

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <SectionHeader
          label="Token"
          action={
            verified ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Verified contract</span>
            ) : undefined
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <span className="flex items-center gap-4">
            <TokenLogo address={addr} chainId={c.chainId} token={token} size={40} />
            <span className="flex flex-col">
              <span className="flex items-baseline gap-3">
                <SubjectHeadline value={addr} display={name} copyLabel="Copy contract address" />
                <span className="font-mono text-lg text-zinc-400 dark:text-zinc-500">{symbol}</span>
              </span>
            </span>
          </span>
          {price !== undefined && (
            <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
              1 {symbol} = <span className="text-zinc-900 dark:text-zinc-50">{formatPriceUsd(price)}</span>
            </span>
          )}
        </div>

        <StatStrip cols={5}>
          <StatCell label="Price" sub={price === undefined ? "no market quote" : "DefiLlama"}>
            <span className={cn(FIG, price === undefined && "text-zinc-400 dark:text-zinc-600")}>
              {formatPriceUsd(price)}
            </span>
          </StatCell>
          <StatCell label="Total Supply">
            <span className={FIG}>
              {supply === null ? "…" : formatTokenAmount(supply, decimals)} <span className={UNIT}>{symbol}</span>
            </span>
          </StatCell>
          <StatCell label="Market Value" sub={marketValue !== null ? "supply × price" : undefined}>
            <span className={cn(FIG, marketValue === null && "text-zinc-400 dark:text-zinc-600")}>
              {marketValue === null ? "—" : formatUsd(marketValue)}
            </span>
          </StatCell>
          <StatCell
            label="Transfers"
            live
            sub={
              transfers.rows.length
                ? `${formatTokenAmount(moved, decimals)} ${symbol}${usdOfToken(moved, decimals, price) ? ` · ${usdOfToken(moved, decimals, price)}` : ""} moved · last ~${windowMin} min`
                : `last ~${windowMin} min`
            }
          >
            <span className={FIG}>{transfers.loading && !transfers.rows.length ? "…" : formatNumber(transfers.rows.length) + (transfers.rows.length >= 50 ? "+" : "")}</span>
          </StatCell>
          <StatCell label="Transactions" sub="on the contract, all time">
            <span className={FIG}>{summary.data ? formatNumber(summary.data.txCount) : "…"}</span>
          </StatCell>
        </StatStrip>

        <Board divide={false} className="px-5 md:px-6">
          <SpecSheet>
            <SpecLine label="Contract">
              <HashChip value={addr} len={66} />
            </SpecLine>
            <SpecLine label="Name">{name}</SpecLine>
            <SpecLine label="Symbol">{symbol}</SpecLine>
            <SpecLine label="Decimals">{decimals}</SpecLine>
            {verified && (
              <SpecLine label="Source">
                <button onClick={() => setTab("contract")} className="font-mono text-[13px] text-zinc-900 underline-offset-4 hover:text-[#E6212F] hover:underline dark:text-zinc-50">
                  {verified.name ?? "verified"}
                </button>
                {verified.compilerVersion && <span className="ml-3 font-mono text-[12px] text-zinc-400 dark:text-zinc-500">{verified.compilerVersion}</span>}
              </SpecLine>
            )}
            {listed && <SpecLine label="Listed">Token List · CoinGecko</SpecLine>}
            {summary.data?.firstSeen && (
              <SpecLine label="First Seen">
                {timeAgo(summary.data.firstSeen)}
              </SpecLine>
            )}
          </SpecSheet>
        </Board>
      </section>

      <section className="flex flex-col gap-4">
        <Tabs tabs={["transfers", "txs", "contract"]} active={tab} onChange={setTab} labels={LABELS} />
        {tab === "contract" ? (
          <EvmContract network={network} addr={addr} justVerified={justVerified} />
        ) : tab === "txs" ? (
          <TxTable
            txs={txs.data?.transactions ?? []}
            self={addr}
            base={base}
            symbol={c.nativeToken ?? "AVAX"}
            usd={null}
            chainId={c.chainId}
            tokens={tokens}
            loading={txs.loading}
            error={txs.error}
            retry={txs.retry}
          />
        ) : (
          <Board>
            <div className={cn(HEAD, "grid-cols-[7.5rem_9rem_1.5rem_9rem_minmax(0,1fr)_6rem_3.5rem]")}>
              <span>Tx</span>
              <span>From</span>
              <span />
              <span>To</span>
              <span className="text-right">Amount</span>
              <span className="text-right">USD</span>
              <span className="text-right">Age</span>
            </div>
            {transfers.rows.length === 0 && <EmptyRow>{transfers.loading ? "Loading…" : `no transfers in the last ~${windowMin} min`}</EmptyRow>}
            {transfers.rows.map((r) => (
              <Link
                key={`${r.txHash}-${r.logIndex}`}
                href={`${base}/tx/${r.txHash}`}
                className={cn(ROW, "md:grid-cols-[7.5rem_9rem_1.5rem_9rem_minmax(0,1fr)_6rem_3.5rem]")}
              >
                <span className={cn("min-w-0 truncate font-mono text-[12.5px]", idInk)}>{truncate(r.txHash, 6)}</span>
                <span className="min-w-0 truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{truncate(r.from, 8)}</span>
                <span className="text-center font-mono text-zinc-300 dark:text-zinc-700">→</span>
                <span className="min-w-0 truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{truncate(r.to, 8)}</span>
                <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
                  {formatTokenAmount(r.amount, decimals)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
                </span>
                <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">{usdOfToken(r.amount, decimals, price) ?? ""}</span>
                <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">
                  {r.timestamp ? ageShort(r.timestamp) : `#${formatNumber(r.blockNumber)}`}
                </span>
              </Link>
            ))}
          </Board>
        )}
      </section>
    </div>
  );
}
