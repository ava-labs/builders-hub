"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Copy, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { useLiveValidatorCounts } from "@/components/explorer-v2/validator-stats";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The chain directory — every catalog chain with the three things a builder
   actually needs from a list like this: where the explorer is, what the RPC
   is, and one click into a wallet. The old /stats/chain-list and
   /explorer/chains both answered pieces of this; this is the merge. */

const REQUEST_INDEXING_FORM_URL = "https://forms.gle/N4QkRo9UR45xeTTp9";

type NetFilter = "mainnet" | "testnet";

function RpcChip({ rpcUrl }: { rpcUrl: string }) {
  const { copiedId, copyToClipboard } = useCopyToClipboard();
  const isCopied = copiedId === rpcUrl;
  const shown = rpcUrl.replace(/^https?:\/\//, "");
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(rpcUrl, rpcUrl)}
      title={rpcUrl}
      className="group/rpc inline-flex max-w-full items-center gap-1.5 font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      <span className="truncate">{shown.length > 34 ? `${shown.slice(0, 33)}…` : shown}</span>
      {isCopied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover/rpc:text-zinc-500 dark:text-zinc-600" />
      )}
    </button>
  );
}

const TH = "px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 md:px-6";
const TD = "px-5 py-3.5 text-[13px] md:px-6";

/* Logo with a monogram fallback: 167 catalog chains ship no logo URI, and a
   few ship dead URLs — both get the chain's initial instead of an empty ring. */
function ChainLogo({ uri, name }: { uri?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[9px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <img
      src={uri}
      alt=""
      onError={() => setBroken(true)}
      className="h-5 w-5 shrink-0 rounded-full object-contain"
    />
  );
}

export function NetworkChains() {
  const [q, setQ] = useState("");
  const [net, setNet] = useState<NetFilter>("mainnet");
  const [showInactive, setShowInactive] = useState(false);
  // the liveness gate, same rule (and same request) as the chain switcher:
  // a mainnet chain earns a default row only if its subnet has stake-backed
  // validators right now. The feed failing open beats an empty directory.
  const { live, failed } = useLiveValidatorCounts();

  const chains = useMemo(() => {
    const query = q.trim().toLowerCase();
    const validators = (c: L1Chain) => (c.subnetId && live?.get(c.subnetId)) || 0;
    return (l1ChainsData as L1Chain[])
      .filter((c) => (net === "testnet" ? c.isTestnet === true : c.isTestnet !== true))
      .filter((c) => {
        // liveness applies to the mainnet view only — Fuji sets aren't in
        // the feed, so testnet rows just need a reachable RPC
        if (showInactive || failed || !live) return true;
        if (net === "testnet") return Boolean(c.rpcUrl);
        return validators(c) > 0;
      })
      .filter(
        (c) =>
          !query ||
          c.chainName.toLowerCase().includes(query) ||
          c.slug.includes(query) ||
          String(c.chainId).includes(query) ||
          (c.category ?? "").toLowerCase().includes(query),
      )
      .sort((a, b) => validators(b) - validators(a) || a.chainName.localeCompare(b.chainName));
  }, [q, net, live, failed, showInactive]);

  return (
    <NetworkShell
      eyebrow="Avalanche Ecosystem"
      title="Chains"
      intro="Every chain running right now: explorers, public RPCs, live validator sets, and one-click wallet setup."
    >
      <section className="flex flex-col gap-4">
        <SectionHeader
          label={`Directory · ${!live && !failed && !showInactive ? "…" : chains.length}`}
          action={
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowInactive((v) => !v)}
                className={cn(
                  "shrink-0 border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                  showInactive
                    ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900",
                )}
              >
                {showInactive ? "Hiding nothing" : "Include inactive"}
              </button>
              <div className="inline-flex shrink-0 border border-zinc-200 dark:border-zinc-800">
                {(["mainnet", "testnet"] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNet(n)}
                    className={cn(
                      "px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                      n === net
                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                    )}
                  >
                    {n === "mainnet" ? "Mainnet" : "Fuji"}
                  </button>
                ))}
              </div>
              <a
                href={REQUEST_INDEXING_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 sm:block dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                Request a listing
              </a>
            </div>
          }
        />

        {/* filter — same hairline input grammar as the explorer search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name, chain ID, or category"
            spellCheck={false}
            className="w-full border border-zinc-200 bg-white/80 py-2.5 pl-11 pr-4 font-mono text-[12px] text-zinc-900 outline-none backdrop-blur-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
          />
        </div>

        <Board divide={false} className="overflow-x-auto">
          {/* fixed layout: the data columns get exactly the width their
              content needs and the Chain column absorbs the slack — auto
              layout was smearing the extra width across every column and
              letting the Connect cell push past the container */}
          <table className="w-full min-w-[66rem] table-fixed border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                {/* Chain and the data columns hug their content; the RPC
                    column (the only widthless one) absorbs the slack, so the
                    leftover space sits between the last datum and the
                    right-aligned actions instead of splitting the row */}
                <th className={cn(TH, "w-[21rem]")}>Chain</th>
                <th className={cn(TH, "w-28")}>Chain ID</th>
                <th className={cn(TH, "w-20")}>Token</th>
                <th className={cn(TH, "w-28 text-right")}>Validators</th>
                <th className={TH}>Public RPC</th>
                <th className={cn(TH, "w-[17rem] text-right")}>Connect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {/* validating against the P-Chain: skeleton rows, never a
                  flash of dead chains that then snap away */}
              {!live && !failed && !showInactive &&
                Array.from({ length: 10 }, (_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td className={TD} colSpan={6}>
                      <span className="flex items-center gap-2.5">
                        <span className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
                        <span className="h-4 w-40 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                      </span>
                    </td>
                  </tr>
                ))}
              {(live || failed || showInactive) && chains.map((c) => {
                const liveCount = (c.subnetId && live?.get(c.subnetId)) || 0;
                const explorerHref =
                  c.rpcUrl && c.isIndexed !== false
                    ? `/explorer/${c.isTestnet ? "fuji" : "mainnet"}/${c.slug}`
                    : null;
                return (
                  <tr key={`${c.slug}-${c.chainId}`} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className={TD}>
                      <span className="flex items-center gap-2.5">
                        <ChainLogo uri={c.chainLogoURI} name={c.chainName} />
                        {explorerHref ? (
                          <Link
                            href={explorerHref}
                            className="truncate font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                          >
                            {c.chainName}
                          </Link>
                        ) : (
                          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{c.chainName}</span>
                        )}
                        {c.category && (
                          <span className="hidden shrink-0 border border-zinc-200 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400 lg:inline dark:border-zinc-800 dark:text-zinc-500">
                            {c.category}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={cn(TD, "font-mono tabular-nums text-zinc-700 dark:text-zinc-300")}>
                      {/* ~145 catalog rows carry a base58 blockchain ID here
                          instead of an EVM number — shown clipped, full value
                          on hover, never smeared across the neighbors */}
                      {/^\d+$/.test(String(c.chainId)) ? (
                        c.chainId
                      ) : (
                        <span
                          title={String(c.chainId)}
                          className="text-[11px] text-zinc-400 dark:text-zinc-500"
                        >
                          {String(c.chainId).slice(0, 6)}…{String(c.chainId).slice(-4)}
                        </span>
                      )}
                    </td>
                    <td className={cn(TD, "font-mono text-zinc-700 dark:text-zinc-300")}>
                      {c.networkToken?.symbol ?? "—"}
                    </td>
                    <td className={cn(TD, "text-right font-mono tabular-nums")}>
                      {liveCount > 0 ? (
                        <span className="text-zinc-900 dark:text-zinc-100">{liveCount.toLocaleString("en-US")}</span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className={TD}>
                      {c.rpcUrl ? <RpcChip rpcUrl={c.rpcUrl} /> : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className={cn(TD, "text-right")}>
                      <span className="inline-flex items-center justify-end gap-3 whitespace-nowrap">
                        <Link
                          href={`/explorer/${c.isTestnet ? "fuji" : "mainnet"}/${c.slug}/accounts`}
                          className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 md:inline dark:text-zinc-500 dark:hover:text-zinc-100"
                        >
                          Accounts
                        </Link>
                        {c.rpcUrl && (
                          <AddToWalletButton
                            rpcUrl={c.rpcUrl}
                            chainName={c.chainName}
                            chainId={Number.isFinite(Number(c.chainId)) ? Number(c.chainId) : undefined}
                            tokenSymbol={c.networkToken?.symbol}
                            variant="ghost"
                          />
                        )}
                        {explorerHref && (
                          <Link href={explorerHref} aria-label={`${c.chainName} explorer`} className="group/go inline-flex">
                            <ArrowRight className="h-3.5 w-3.5 text-zinc-300 transition-all group-hover/go:translate-x-0.5 group-hover/go:text-[#E6212F] dark:text-zinc-600" />
                          </Link>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {chains.length === 0 && (
                <tr>
                  <td className={TD} colSpan={6}>
                    <p className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
                      No chains match
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Board>
      </section>
    </NetworkShell>
  );
}
