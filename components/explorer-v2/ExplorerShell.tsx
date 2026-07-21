"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXPLORER_CHAINS,
  getExplorerChain,
  classifyLocally,
  isPchainNetwork,
  pchainApiPath,
  type SearchResult,
} from "@/lib/pchain-explorer";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";

type EntityType = "block" | "tx" | "address" | "node";

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
    // pl-0!/pr-0!: this div is a direct child of <header>, so the global
    // `header > div` navbar padding hack (global.css) would indent it by 3rem
    <div className="relative w-full pl-0! pr-0!">
      <form onSubmit={submit} className="relative">
        {/* z-10: the input's backdrop-blur forms a stacking context that
            otherwise paints over this icon, leaving a blurred smudge */}
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
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

      {notFound && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">Not found</p>
      )}
    </div>
  );
}

/* The explorer page shell: subnav spine + container + header. */
export function ExplorerShell({
  chain,
  network,
  aside,
  children,
}: {
  chain: string;
  network: string;
  /** Optional right-hand companion for the title row (e.g. a live figure). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = getExplorerChain(chain) ?? EXPLORER_CHAINS["p-chain"];
  return (
    <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      {/* the drafting-sheet triangle lattice, snowfall only — visible in the
          margins; the content column is an opaque sheet laid on top of it,
          bounded by the vertical rules */}
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white px-5 pb-24 pt-10 md:px-6 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
        {/* the app's spine: chain switcher, section tabs, network */}
        <ExplorerSubnav network={network} chainSlug={chain} chainName={c.name} className="mb-8" />
        <header className="flex flex-col gap-6 pb-10">
          {/* title row. pl-0!/pr-0! override the global `header > div` navbar
              padding hack (global.css) that otherwise pushes it in by 3rem. */}
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pl-0! pr-0!">
            <div className="flex flex-col gap-2.5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                Avalanche Primary Network
              </p>
              <h1 className="v2-display -ml-[0.055em] text-[clamp(1.85rem,4.5vw,3.25rem)] leading-[0.95] text-zinc-900 dark:text-zinc-50">
                {c.title}<span className="text-[#E6212F]">.</span>
              </h1>
            </div>
            {aside}
          </div>
          {/* search — its own full-width row */}
          <SearchBox chain={chain} network={network} />
        </header>
        {children}
      </div>
    </main>
  );
}
