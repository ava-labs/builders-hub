"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Clock, Search, X } from "lucide-react";
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

/* Unambiguous shapes route instantly, no API round-trip: block heights are
   digits, NodeIDs and bech32 addresses carry their own prefixes. CB58 hashes
   stay ambiguous (block vs tx) and go to the search API. */
type EntityType = "block" | "tx" | "address" | "node";
function classifyLocally(q: string): { type: EntityType; id: string } | null {
  if (/^\d+$/.test(q)) return { type: "block", id: q };
  if (/^NodeID-[1-9A-HJ-NP-Za-km-z]{30,}$/.test(q)) return { type: "node", id: q };
  if (/^(P-)?(avax|fuji|custom)1[02-9ac-hj-np-z]{30,}$/i.test(q)) return { type: "address", id: q };
  return null;
}

/* Recent searches — per network, newest first, capped. */
type Recent = { type: EntityType; id: string };
const RECENTS_CAP = 5;
const recentsKey = (network: string) => `pchain-explorer-recents-${network}`;
function loadRecents(network: string): Recent[] {
  try {
    const raw = localStorage.getItem(recentsKey(network));
    return raw ? (JSON.parse(raw) as Recent[]).slice(0, RECENTS_CAP) : [];
  } catch {
    return [];
  }
}
function saveRecent(network: string, entry: Recent): Recent[] {
  const next = [entry, ...loadRecents(network).filter((r) => r.id !== entry.id)].slice(0, RECENTS_CAP);
  try {
    localStorage.setItem(recentsKey(network), JSON.stringify(next));
  } catch {
    /* storage unavailable — recents just don't persist */
  }
  return next;
}

function truncateId(id: string, max = 34) {
  return id.length <= max ? id : `${id.slice(0, max - 6)}…${id.slice(-5)}`;
}

/* Search — the explorer's front door: instant local classification, "/" to
   focus, recents on focus, API classification only for ambiguous hashes. */
function SearchBox({ chain, network }: { chain: string; network: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recents, setRecents] = useState<Recent[]>([]);

  const base = `/explorer/${network}/${chain}`;

  useEffect(() => {
    setRecents(loadRecents(network));
  }, [network]);

  // "/" focuses the search from anywhere on the page (unless already typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (type: EntityType, id: string) => {
    setRecents(saveRecent(network, { type, id }));
    setQ("");
    inputRef.current?.blur();
    router.push(`${base}/${type}/${id}`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query || !isPchainNetwork(network)) return;
    setNotFound(false);

    const local = classifyLocally(query);
    if (local) {
      go(local.type, local.id);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(pchainApiPath(network, "search", { q: query }));
      const r: SearchResult = res.ok ? await res.json() : { type: "none", id: query };
      if (r.type !== "none") {
        go(r.type, r.id);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  };

  const showRecents = focused && !q && recents.length > 0;

  return (
    <div className="relative w-full">
      <form onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setNotFound(false);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search by block height, tx hash, NodeID, or address"
          spellCheck={false}
          className={cn(
            "w-full border bg-white/80 py-3 pl-11 pr-12 font-mono text-[13px] text-zinc-900 outline-none backdrop-blur-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 md:py-3.5 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100",
            notFound ? "border-[#E6212F]" : "border-zinc-200 dark:border-zinc-800",
            busy && "opacity-60",
          )}
        />
        {/* the "/" affordance parks at the right edge until the field is live */}
        {!focused && !q && (
          <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 md:block dark:border-zinc-800 dark:text-zinc-500">
            /
          </kbd>
        )}
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQ("");
              setNotFound(false);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* recents — mousedown beats blur, so rows stay clickable */}
      {showRecents && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="border-b border-zinc-100 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:border-zinc-900 dark:text-zinc-500">
            Recent
          </p>
          {recents.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                go(r.type, r.id);
              }}
              className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-600" />
              <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {r.type}
              </span>
              <span className="flex-1 truncate font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
                {truncateId(r.id)}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F] dark:text-zinc-600" />
            </button>
          ))}
        </div>
      )}

      {/* quick paths under the bar, in the drafting voice */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {(
          [
            ["Latest blocks", `${base}/blocks`],
            ["Latest transactions", `${base}/txs`],
            ["Validators", `${base}/validators`],
            ["All L1 chains", "/explorer/chains"],
          ] as const
        ).map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            {label}
            <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
          </Link>
        ))}
        {notFound && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">
            Not found
          </span>
        )}
      </div>
    </div>
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
