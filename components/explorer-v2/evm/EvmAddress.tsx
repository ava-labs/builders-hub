"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, DetailSkeleton, SectionHeader, SubjectHeadline, HEAD } from "@/components/explorer-v2/ui";
import { ageWords, formatTime } from "@/components/explorer-v2/format";
import { formatEther } from "./format";
import { FeedDown } from "./bits";
import { useEvmData, useMorePages, usePrice } from "./hooks";
import { EvmContract, useIsContract, useVerifiedContract } from "./EvmContract";
import { EvmToken } from "./EvmToken";
import { TokenMark, NativeMark } from "./TokenMark";
import { TxTable, TransferTable, EmptyRow } from "./AddressTables";
import { AddressChips, OverviewCards, PillTabs, type Who } from "./AddressOverview";
import { useAddressBalances } from "./useErc20";
import { formatPriceUsd, formatTokenAmount, formatUsd, usdOfToken, usdValue, useTokenList, useTokenPrices } from "@/lib/token-list";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { knownAddress, type AddressSummary, type Transfer, type TxListResponse, type TxSummary, type TransferListResponse } from "@/lib/evm-explorer";
import { readRpc } from "@/lib/explorer-rpc";

/* An address, laid out like the Etherscan account page: chips that say
   what it is, three cards (what it holds, where its history starts and
   ends, what it is worth), then its transactions, which the page opens
   on. When the address is itself a token contract the page becomes the
   token's. */

type Tab = "txs" | "transfers" | "holdings" | "contract";
const LABELS: Record<Tab, string> = { txs: "Transactions", transfers: "Token Transfers", holdings: "Holdings", contract: "Contract" };
const TABS = Object.keys(LABELS) as Tab[];

/** ?tab= names a view; anything else opens the transactions */
function tabOf(param: string | undefined): Tab {
  return TABS.includes(param as Tab) ? (param as Tab) : "txs";
}

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
  /** ?tab= opens a view other than the transactions: the verify form sends
   *  ?tab=contract, so a freshly verified contract opens on its source. */
  initialTab?: string;
  /** Set by the verify form's redirect, so the Contract tab knows to wait
   *  for a verification it has just been told about. */
  justVerified?: boolean;
}) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";
  const me = addr.toLowerCase();
  const [tab, setTab] = useState<Tab>(() => tabOf(initialTab));

  const summary = useEvmData<AddressSummary>(c.chainId, `address/${addr}`, undefined, { retry404Ms: 15_000 });
  const txs = useEvmData<TxListResponse>(c.chainId, `address/${addr}/txs`, { limit: 50 });
  const transfers = useEvmData<TransferListResponse>(c.chainId, `address/${addr}/transfers`, { limit: 50 });
  // past the first 50, on request, off the API's block cursor
  const txPages = useMorePages<TxSummary>(c.chainId, `address/${addr}/txs`, "transactions", txs.data as unknown as Record<string, unknown> | null);
  const transferPages = useMorePages<Transfer>(c.chainId, `address/${addr}/transfers`, "transfers", transfers.data as unknown as Record<string, unknown> | null);

  // who: a verified record proves a contract; otherwise ask the chain
  const { contract: verified } = useVerifiedContract(c.chainId, addr, { expectVerified: justVerified });
  const hasCode = useIsContract(readRpc(c.chainId, c.rpcUrl), addr);
  const isContract = verified !== null || hasCode === true;
  const fixture = knownAddress(addr, c.chainId);

  // is it a token? the list says so outright; the page shows the token then
  const tokens = useTokenList(c.chainId);
  const listed = tokens.get(me) ?? null;

  // what it holds: native balance from the RPC; tokens = the ones its
  // recent transfers touched plus the majors, asked with one balanceOf batch
  const liveRpc = readRpc(c.chainId, c.rpcUrl);
  const { price } = usePrice(c.chainId);
  const usd = price?.price ?? null;

  const candidates = useMemo(() => {
    const set = new Set<string>();
    for (const x of transfers.data?.transfers ?? []) if (tokens.has(x.token.toLowerCase())) set.add(x.token.toLowerCase());
    for (const [a, t] of tokens) if (MAJORS.has(t.symbol.toUpperCase())) set.add(a);
    return [...set];
  }, [transfers.data, tokens]);
  const { nativeWei, balances, ready: tokensRead } = useAddressBalances(liveRpc, addr, candidates);
  // a chain with no token list (most L1s) has no candidates: nothing to wait for once the transfers are in
  const balancesReady = tokensRead || (candidates.length === 0 && !!transfers.data && nativeWei !== null);
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
  const nativeUsd = nativeWei !== null && usd ? (Number(nativeWei) / 1e18) * usd : 0;
  const pricedAll = holdings.every((h) => h.usd > 0 || !prices.size) && usd !== null;

  const s = summary.data;
  const loading = summary.loading && !s;
  const error = s ? null : summary.error;

  const tabs: Tab[] = isContract ? TABS : TABS.filter((t) => t !== "contract");
  const activeTab: Tab = tab === "contract" && !isContract ? "txs" : tab;

  // a fixture with an ABI is a precompile: built in, so nothing to verify
  const who: Who = verified ? "Verified contract" : fixture?.abi ? "Precompile" : isContract ? "Contract" : "Account";

  // the first transaction and the first one that sent value in: known only
  // once the whole history is in hand, since the API pages newest first
  const latest = txs.data?.transactions[0];
  const whole = !!txs.data && !txPages.hasMore ? txPages.items : null;
  const first = whole?.[whole.length - 1];
  const fundedBy = whole ? [...whole].reverse().find((t) => t.to.toLowerCase() === me && t.from.toLowerCase() !== me && BigInt(t.value) > 0n) : undefined;

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
                  action={
                    s.lastSeen ? (
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400" title={formatTime(s.lastSeen)}>
                        Last active {ageWords(s.lastSeen)}
                      </span>
                    ) : undefined
                  }
                />
                <div className="flex flex-col gap-3">
                  <SubjectHeadline value={addr} copyLabel="Copy address" />
                  <AddressChips
                    who={who}
                    name={verified?.name ?? fixture?.label}
                    note={fixture?.note}
                    verifyHref={isContract && !verified && !fixture?.abi ? `${base}/verify/${addr}` : undefined}
                  />
                </div>
                <OverviewCards
                  sym={sym}
                  chainId={c.chainId}
                  base={base}
                  summary={s}
                  nativeWei={nativeWei}
                  price={usd}
                  holdings={holdings}
                  balancesReady={balancesReady}
                  pricedAll={pricedAll}
                  latest={latest}
                  first={first}
                  fundedBy={fundedBy}
                  lastTransfer={transfers.data?.transfers[0]}
                  source={verified ? { name: verified.name, compiler: verified.compilerVersion, open: () => setTab("contract") } : undefined}
                  onHoldings={() => setTab("holdings")}
                />
              </section>

              <section className="flex flex-col gap-4">
                <PillTabs tabs={tabs} active={activeTab} onChange={setTab} labels={LABELS} />
                {activeTab === "contract" ? (
                  <EvmContract network={network} addr={addr} justVerified={justVerified} />
                ) : activeTab === "txs" ? (
                  <TxTable txs={txPages.items} total={s.txCount} rpcUrl={liveRpc} self={addr} base={base} symbol={sym} usd={usd} chainId={c.chainId} tokens={tokens} loading={txs.loading} error={txs.error} retry={txs.retry} more={{ onMore: txPages.more, hasMore: txPages.hasMore, loading: txPages.loadingMore }} />
                ) : activeTab === "transfers" ? (
                  <TransferTable transfers={transferPages.items} self={addr} base={base} chainId={c.chainId} tokens={tokens} prices={prices} loading={transfers.loading} error={transfers.error} retry={transfers.retry} rpcUrl={readRpc(c.chainId, c.rpcUrl)} more={{ onMore: transferPages.more, hasMore: transferPages.hasMore, loading: transferPages.loadingMore }} />
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
