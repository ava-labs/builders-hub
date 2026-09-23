"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, DetailSkeleton, HashChip, SectionHeader, SpecLine, SpecSheet, StatCell, StatStrip, SubjectHeadline, HEAD } from "@/components/explorer-v2/ui";
import { formatNumber, formatTime, timeAgo } from "@/components/explorer-v2/format";
import { formatEther } from "./format";
import { FeedDown } from "./bits";
import { useEvmData, usePrice, usdOfWei } from "./hooks";
import { EvmContract, useIsContract, useVerifiedContract } from "./EvmContract";
import { EvmToken } from "./EvmToken";
import { TokenMark, NativeMark } from "./TokenMark";
import { FIG, UNIT, Tabs, TxTable, TransferTable, EmptyRow } from "./AddressTables";
import { useNativeBalance, useTokenBalances } from "./useErc20";
import { formatPriceUsd, formatTokenAmount, formatUsd, usdOfToken, usdValue, useTokenList, useTokenPrices } from "@/lib/token-list";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { knownAddress, type AddressSummary, type TxListResponse, type TransferListResponse } from "@/lib/evm-explorer";

/* An address, read as a portfolio: what it holds (native balance, tokens,
   the dollar total) in a strip, who it is in a sheet, what it has done in
   tabs. Same grammar as the block and transaction pages. When the address
   is itself a token contract the page becomes the token's. */

type Tab = "holdings" | "txs" | "transfers" | "contract";
const LABELS: Record<Tab, string> = { holdings: "Holdings", txs: "Transactions", transfers: "Token Transfers", contract: "Contract" };

/* Tokens every C-Chain wallet is asked about even when its recent
   transfers do not mention them: the majors, by symbol, resolved against
   the chain's token list at runtime. */
const MAJORS = new Set(["USDT", "USDC", "USDC.E", "USDT.E", "WAVAX", "BTC.B", "WETH.E", "SAVAX", "JOE", "GMX", "QI", "PNG", "COQ", "GGP", "AUSD", "EURC", "DAI.E", "LINK.E", "AAVE.E", "WBTC.E"]);

export function EvmAddress({
  network,
  addr,
  initialTab,
  justVerified,
}: {
  network: string;
  addr: string;
  /** ?tab=contract lands here from the verify form, so a freshly verified
   *  contract opens on its source rather than its transaction list. */
  initialTab?: string;
  /** Set by the verify form's redirect, so the Contract tab knows to wait
   *  for a verification it has just been told about. */
  justVerified?: boolean;
}) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";
  const me = addr.toLowerCase();
  const [tab, setTab] = useState<Tab>(initialTab === "contract" ? "contract" : "holdings");

  const summary = useEvmData<AddressSummary>(c.chainId, `address/${addr}`, undefined, { retry404Ms: 15_000 });
  const txs = useEvmData<TxListResponse>(c.chainId, `address/${addr}/txs`, { limit: 50 });
  const transfers = useEvmData<TransferListResponse>(c.chainId, `address/${addr}/transfers`, { limit: 50 });

  // who: a verified record proves a contract; otherwise ask the chain
  const { contract: verified } = useVerifiedContract(c.chainId, addr, { expectVerified: justVerified });
  const hasCode = useIsContract(c.rpcUrl, addr);
  const isContract = verified !== null || hasCode === true;
  const fixture = knownAddress(addr);

  // is it a token? the list says so outright; the page shows the token then
  const tokens = useTokenList(c.chainId);
  const listed = tokens.get(me) ?? null;

  // what it holds: native balance from the RPC; tokens = the ones its
  // recent transfers touched plus the majors, asked with one balanceOf batch
  const liveRpc = c.rpcUrl;
  const nativeWei = useNativeBalance(liveRpc, addr);
  const { price } = usePrice(c.chainId);
  const usd = price?.price ?? null;

  const candidates = useMemo(() => {
    const set = new Set<string>();
    for (const x of transfers.data?.transfers ?? []) if (tokens.has(x.token.toLowerCase())) set.add(x.token.toLowerCase());
    for (const [a, t] of tokens) if (MAJORS.has(t.symbol.toUpperCase())) set.add(a);
    return [...set];
  }, [transfers.data, tokens]);
  const { balances, ready: balancesReady } = useTokenBalances(liveRpc, addr, candidates);
  const held = useMemo(
    () => [...balances.entries()].map(([a, amount]) => ({ address: a, amount, token: tokens.get(a)! })).filter((h) => h.token),
    [balances, tokens],
  );
  const prices = useTokenPrices(c.chainId, [...held.map((h) => h.address), ...(transfers.data?.transfers ?? []).map((x) => x.token)]);
  const holdings = useMemo(
    () =>
      held
        .map((h) => ({ ...h, usd: usdValue(h.amount, h.token.decimals, prices.get(h.address)) }))
        .sort((a, b) => b.usd - a.usd || Number(b.amount - a.amount)),
    [held, prices],
  );
  const tokensUsd = holdings.reduce((acc, h) => acc + h.usd, 0);
  const nativeUsd = nativeWei !== null && usd ? (Number(nativeWei) / 1e18) * usd : 0;
  const netWorth = nativeUsd + tokensUsd;
  const pricedAll = holdings.every((h) => h.usd > 0 || !prices.size) && usd !== null;

  const s = summary.data;
  const loading = summary.loading && !s;
  const error = s ? null : summary.error;

  const tabs: Tab[] = isContract ? ["holdings", "txs", "transfers", "contract"] : ["holdings", "txs", "transfers"];
  const activeTab: Tab = tab === "contract" && !isContract ? "holdings" : tab;

  const who = listed ? "Token" : verified ? "Verified contract" : isContract ? "Contract" : "Account";

  return (
    <EvmShell network={network}>
      {listed ? (
        <EvmToken network={network} addr={addr} listed={listed} verified={verified} initialTab={initialTab} justVerified={justVerified} />
      ) : (
        <>
          {loading && <DetailSkeleton label="Address" />}
          {error === "not found" && !s && (
            <Board divide={false} className="px-6 py-16 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">Address not found</p>
              <p className="mt-3 break-all font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{addr}</p>
            </Board>
          )}
          {error && error !== "not found" && !s && <FeedDown onRetry={summary.retry} />}
          {s && (
            <div className="flex flex-col gap-10">
              <section className="flex flex-col gap-5">
                <SectionHeader
                  label="Address"
                  action={<span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{who}</span>}
                />

                {/* the subject: a name when it has one, the address beneath */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
                  <span className="flex min-w-0 flex-col gap-1.5">
                    {(verified?.name || fixture) && (
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {verified?.name ?? fixture?.label}
                      </span>
                    )}
                    <SubjectHeadline value={addr} copyLabel="Copy address" />
                  </span>
                  {s.lastSeen ? (
                    <span className="shrink-0 font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      active {timeAgo(s.lastSeen)}
                      {s.firstSeen ? <span className="text-zinc-400 dark:text-zinc-500"> · since {formatTime(s.firstSeen).slice(0, 10)}</span> : null}
                    </span>
                  ) : null}
                </div>

                {/* the portfolio */}
                <StatStrip cols={5}>
                  <StatCell label="Balance" sub={nativeWei !== null ? usdOfWei(nativeWei, usd) : undefined}>
                    <span className={FIG}>
                      {nativeWei === null ? "…" : formatEther(nativeWei.toString(), { decimals: Number(nativeWei) / 1e18 >= 1 ? 4 : 6 })}{" "}
                      <span className={UNIT}>{sym}</span>
                    </span>
                  </StatCell>
                  <StatCell
                    label="Tokens"
                    sub={balancesReady ? `${holdings.length} ${holdings.length === 1 ? "token" : "tokens"} held` : undefined}
                  >
                    <span className={cn(FIG, tokensUsd === 0 && "text-zinc-400 dark:text-zinc-600")}>
                      {!balancesReady ? "…" : tokensUsd > 0 ? formatUsd(tokensUsd) : holdings.length ? "unpriced" : "—"}
                    </span>
                  </StatCell>
                  <StatCell label="Net Worth" sub={pricedAll ? `${sym} + tokens, at market` : "priced tokens only"}>
                    <span className={cn(FIG, netWorth === 0 && "text-zinc-400 dark:text-zinc-600")}>
                      {nativeWei === null || !balancesReady ? "…" : netWorth > 0 ? formatUsd(netWorth) : "—"}
                    </span>
                  </StatCell>
                  <StatCell label="Transactions" sub="all time">
                    <span className={FIG}>{formatNumber(s.txCount)}</span>
                  </StatCell>
                  <StatCell label="Last Active">
                    <span className={FIG}>{s.lastSeen ? timeAgo(s.lastSeen).replace(" ago", "") : "—"}</span>
                  </StatCell>
                </StatStrip>

                <Board divide={false} className="px-5 md:px-6">
                  <SpecSheet>
                    <SpecLine label="Address">
                      <HashChip value={addr} len={66} />
                    </SpecLine>
                    <SpecLine label="Type">
                      {who}
                      {fixture && <span className="ml-3 font-normal text-zinc-500 dark:text-zinc-400">{fixture.note}</span>}
                    </SpecLine>
                    {verified && (
                      <SpecLine label="Source">
                        <button onClick={() => setTab("contract")} className="font-mono text-[13px] text-zinc-900 underline-offset-4 hover:text-[#E6212F] hover:underline dark:text-zinc-50">
                          {verified.name ?? "verified"}
                        </button>
                        {verified.compilerVersion && <span className="ml-3 font-mono text-[12px] text-zinc-400 dark:text-zinc-500">{verified.compilerVersion}</span>}
                      </SpecLine>
                    )}
                    {s.firstSeen ? <SpecLine label="First Seen">{formatTime(s.firstSeen)} · {timeAgo(s.firstSeen)}</SpecLine> : null}
                    {s.lastSeen ? <SpecLine label="Last Seen">{formatTime(s.lastSeen)} · {timeAgo(s.lastSeen)}</SpecLine> : null}
                  </SpecSheet>
                </Board>
              </section>

              <section className="flex flex-col gap-4">
                <Tabs tabs={tabs} active={activeTab} onChange={setTab} labels={LABELS} />
                {activeTab === "contract" ? (
                  <EvmContract network={network} addr={addr} justVerified={justVerified} />
                ) : activeTab === "txs" ? (
                  <TxTable txs={txs.data?.transactions ?? []} self={addr} base={base} symbol={sym} usd={usd} chainId={c.chainId} tokens={tokens} loading={txs.loading} error={txs.error} retry={txs.retry} />
                ) : activeTab === "transfers" ? (
                  <TransferTable transfers={transfers.data?.transfers ?? []} self={addr} base={base} chainId={c.chainId} tokens={tokens} prices={prices} loading={transfers.loading} error={transfers.error} retry={transfers.retry} />
                ) : (
                  <Board>
                    <div className={cn(HEAD, "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_8rem_10rem]")}>
                      <span>Asset</span>
                      <span className="text-right">Balance</span>
                      <span className="text-right">Price</span>
                      <span className="text-right">Value</span>
                    </div>
                    {/* the native coin leads the ledger */}
                    <HoldingRow
                      mark={<span className="flex items-center gap-2"><NativeMark symbol={sym} size={16} /><span className="text-zinc-400 dark:text-zinc-500">Avalanche</span></span>}
                      balance={nativeWei === null ? "…" : formatEther(nativeWei.toString(), { decimals: 4 })}
                      symbol={sym}
                      price={formatPriceUsd(usd ?? undefined)}
                      value={nativeWei !== null && usd ? formatUsd(nativeUsd) : "—"}
                    />
                    {holdings.map((h) => (
                      <HoldingRow
                        key={h.address}
                        href={`${base}/address/${h.address}`}
                        mark={
                          <span className="flex items-center gap-2">
                            <TokenMark address={h.address} chainId={c.chainId} token={h.token} size={16} />
                            <span className="truncate text-zinc-400 dark:text-zinc-500">{h.token.name}</span>
                          </span>
                        }
                        balance={formatTokenAmount(h.amount, h.token.decimals)}
                        symbol={h.token.symbol}
                        price={formatPriceUsd(prices.get(h.address))}
                        value={usdOfToken(h.amount, h.token.decimals, prices.get(h.address)) ?? "—"}
                      />
                    ))}
                    {balancesReady && holdings.length === 0 && <EmptyRow>no listed tokens held</EmptyRow>}
                    {!balancesReady && <EmptyRow>Loading…</EmptyRow>}
                    <div className="px-5 py-2.5 font-mono text-[10px] text-zinc-400 md:px-6 dark:text-zinc-500">
                      balances read from the chain for tokens on the Token List: the majors plus any this address moved recently
                    </div>
                  </Board>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </EvmShell>
  );
}

function HoldingRow({ mark, balance, symbol, price, value, href }: { mark: React.ReactNode; balance: string; symbol: string; price: string; value: string; href?: string }) {
  const cls = "grid grid-cols-2 items-center gap-x-4 gap-y-1 px-5 py-2.5 md:h-11 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_8rem_10rem] md:py-0 md:px-6";
  const inner = (
    <>
      <span className="min-w-0 font-mono text-[12.5px]">{mark}</span>
      <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
        {balance} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
      </span>
      <span className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">{price}</span>
      <span className={cn("font-mono text-[12.5px] tabular-nums md:text-right", value === "—" ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-900 dark:text-zinc-50")}>{value}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
