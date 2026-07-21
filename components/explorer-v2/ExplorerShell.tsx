"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXPLORER_CHAINS,
  NETWORK_LABEL,
  getExplorerChain,
  isPchainNetwork,
  pchainApiPath,
  type SearchResult,
} from "@/lib/pchain-explorer";

/* Network segmented control — switching goes to that network's explorer home. */
function NetworkSwitcher({ chain, network }: { chain: string; network: string }) {
  const c = getExplorerChain(chain);
  if (!c) return null;
  return (
    <div className="inline-flex border border-zinc-200 dark:border-zinc-800">
      {c.networks.map((n) => {
        const active = n === network;
        return (
          <Link
            key={n}
            href={`/explorer/${n}/${chain}`}
            className={cn(
              "px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
              active
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
            )}
          >
            {NETWORK_LABEL[n as keyof typeof NETWORK_LABEL] ?? n}
          </Link>
        );
      })}
    </div>
  );
}

/* Search — classifies via the explorer API then routes to the entity. */
function SearchBox({ chain, network }: { chain: string; network: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query || !isPchainNetwork(network)) return;
    setBusy(true);
    setNotFound(false);
    try {
      const res = await fetch(pchainApiPath(network, "search", { q: query }));
      const r: SearchResult = res.ok ? await res.json() : { type: "none", id: query };
      const base = `/explorer/${network}/${chain}`;
      const dest: Record<SearchResult["type"], string | null> = {
        block: `${base}/block/${r.id}`,
        tx: `${base}/tx/${r.id}`,
        address: `${base}/address/${r.id}`,
        node: `${base}/node/${r.id}`,
        none: null,
      };
      const to = dest[r.type];
      if (to) {
        setQ("");
        router.push(to);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setNotFound(false);
        }}
        placeholder="Search block · tx · address · node"
        spellCheck={false}
        className={cn(
          "w-full border bg-white/80 py-2 pl-9 pr-3 font-mono text-[12px] text-zinc-900 outline-none backdrop-blur-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100",
          notFound ? "border-[#E6212F]" : "border-zinc-200 dark:border-zinc-800",
          busy && "opacity-60",
        )}
      />
      {notFound && (
        <span className="absolute -bottom-5 left-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">
          Not found
        </span>
      )}
    </form>
  );
}

type Crumb = { label: string; href?: string };

/* Resource segment → display label. Detail pages (tx/block/address/node) also
   append a truncated id; list pages are their own leaf. */
const RESOURCE_LABEL: Record<string, string> = {
  tx: "Transaction",
  block: "Block",
  address: "Address",
  node: "Node",
  blocks: "Blocks",
  txs: "Transactions",
  validators: "Validators",
};

/* Builds the breadcrumb trail for the current path:
   Explorer / {Chain} / {Resource} / {id?}. The chain crumb links back to that
   specific chain's network home so there's always a clean way back. */
function buildCrumbs(pathname: string, chain: string, network: string, chainName: string): Crumb[] {
  const home = `/explorer/${network}/${chain}`;
  const crumbs: Crumb[] = [
    { label: "Explorer", href: "/explorer" },
    { label: chainName, href: home },
  ];
  const rest = pathname.startsWith(home)
    ? pathname.slice(home.length).split("/").filter(Boolean)
    : [];
  if (rest.length) {
    const resource = rest[0];
    crumbs.push({ label: RESOURCE_LABEL[resource] ?? resource });
  }
  return crumbs;
}

/* The explorer page shell: signature lattice backdrop + container + header. */
export function ExplorerShell({
  chain,
  network,
  children,
}: {
  chain: string;
  network: string;
  children: React.ReactNode;
}) {
  const c = getExplorerChain(chain) ?? EXPLORER_CHAINS["p-chain"];
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname, chain, network, c.name);
  return (
    <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-24 pt-14 md:px-6">
        <header className="flex flex-col gap-6 pb-10">
          {/* breadcrumb — updates per page; chain crumb returns to that chain's home */}
          <nav className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.22em]">
            {crumbs.map((cr, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={`${cr.label}-${i}`} className="flex items-center gap-2.5">
                  {i > 0 && <span className="text-zinc-300 dark:text-zinc-700">/</span>}
                  {cr.href && !last ? (
                    <Link
                      href={cr.href}
                      className="text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                    >
                      {cr.label}
                    </Link>
                  ) : (
                    <span className={last ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}>
                      {cr.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
          {/* title + network switcher on one baseline-aligned row.
              pl-0!/pr-0! override the global `header > div` navbar padding hack
              (global.css) that otherwise pushes this row in by 3rem. */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pl-0! pr-0!">
            <h1 className="v2-display -ml-[0.055em] text-[clamp(1.85rem,4.5vw,3.25rem)] leading-[0.95] text-zinc-900 dark:text-zinc-50">
              {c.title}<span className="text-[#E6212F]">.</span>
            </h1>
            <NetworkSwitcher chain={chain} network={network} />
          </div>
          {/* search — its own full-width row */}
          <SearchBox chain={chain} network={network} />
        </header>
        {children}
      </div>
    </main>
  );
}
