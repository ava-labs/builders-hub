"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUp, ArrowUpRight, Clock, History, Search, Sparkles, X } from "lucide-react";
import { canAskPhrase, looksLikeQuestion } from "@/lib/explorer-query/ask";
import { EXAMPLES, PCHAIN_EXAMPLES } from "@/lib/explorer-query/examples";
import { recentQuestions } from "@/lib/explorer-query/recent";
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
import {
  ChainHitRow,
  EntityHitRow,
  matchChains,
  looksLikeIdentifier,
  lookupTxAcrossChainsCached,
  useSearchEntity,
  type ChainHit,
} from "@/components/explorer-v2/chain-search";
import { useLiveValidatorCounts } from "@/components/explorer-v2/validator-stats";
import { Rise } from "@/components/explorer-v2/ui";
import { buildAddressUrl, buildTxUrl } from "@/utils/eip3091";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";

type EntityType = "block" | "tx" | "address" | "node" | "chain";

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
   focus, recents on focus, API classification only for ambiguous hashes.
   Exported for the network-scope shell: with chain="p-chain" it already
   routes every identifier to the right chain (P-Chain entities home, EVM
   addresses to the C-Chain, tx hashes raced across every indexed chain). */
export function SearchBox({
  chain,
  network,
  ask = false,
  askAt,
}: {
  chain: string;
  network: string;
  /** questions open the P-Chain's Query page */
  ask?: boolean;
  /** questions open this Query page instead: the network's, which answers from the chain a question names */
  askAt?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [sel, setSel] = useState(-1);

  const base = `/explorer/${network}/${chain}`;
  // the P-Chain's tables cover mainnet and Fuji
  const askable = (ask || !!askAt) && (network === "mainnet" || network === "fuji");
  const queryPage = askAt ?? `${base}/query`;
  // the network box asks about any chain: both indexes' recents and starters
  const starters = (askAt ? [...EXAMPLES.slice(0, 1), ...PCHAIN_EXAMPLES.slice(0, 1)] : PCHAIN_EXAMPLES).flatMap((g) => g.items.map((i) => i.q));
  const [recentAsked, setRecentAsked] = useState<string[]>([]);

  useEffect(() => {
    setRecents(loadRecents(network));
  }, [network]);

  // chain suggestions — same engine and rows as the portal's search, so a
  // name, chain ID, subnet ID, or blockchain ID finds its chain from any
  // page. Liveness (for ranking + the validators figure) loads on demand.
  const { live: liveValidators } = useLiveValidatorCounts("mainnet", q.trim().length >= 2);
  const hits = useMemo(() => matchChains(q, liveValidators), [q, liveValidators]);

  // what the identifier in the box resolves to — tx hashes race every
  // chain live, so the dropdown names the chain before Enter is pressed
  const entity = useSearchEntity(q, {
    network,
    blockBase: base,
    blockChainName: "P-Chain",
    evmAddressBase: `/explorer/${network}/c-chain`,
    evmAddressChainName: "C-Chain",
  });

  const goToHref = (href: string) => {
    setQ("");
    setSel(-1);
    setNotFound(false);
    inputRef.current?.blur();
    router.push(href);
  };

  const goToChain = (hit: ChainHit) => {
    setQ("");
    setSel(-1);
    setNotFound(false);
    inputRef.current?.blur();
    router.push(hit.href);
  };

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

    // a sentence is a question for the P-Chain's Query page
    if (question && sel < 0) {
      goToHref(askHref);
      return;
    }

    // a highlighted chain wins the Enter key; a name-like query's top hit
    // wins too — but identifier shapes (heights, hashes, IDs) keep their
    // plain-Enter classification even while chain rows are on offer
    if (hits.length > 0 && (sel >= 0 || !looksLikeIdentifier(query))) {
      goToChain(hits[Math.max(0, sel)].chain);
      return;
    }

    const local = classifyLocally(query);
    if (local) {
      go(local.type, local.id);
      return;
    }
    // a phrase that is no identifier and no chain is asked, as on the C-Chain
    if (canAsk && !looksLikeIdentifier(query)) {
      goToHref(askHref);
      return;
    }

    setBusy(true);
    try {
      // EVM shapes route across the platform: an 0x address is a C-Chain
      // portfolio; an 0x hash could be a P-Chain tx (hex id) OR an EVM tx,
      // so ask the P-Chain first and race the EVM chains on a miss.
      if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
        router.push(buildAddressUrl(`/explorer/${network}/c-chain`, query));
        return;
      }
      const res = await fetch(pchainApiPath(network, "search", { q: query }));
      const r: SearchResult = res.ok ? await res.json() : { type: "none", id: query };
      if (r.type !== "none") {
        go(r.type, r.id);
        return;
      }
      if (network === "mainnet" && /^0x[a-fA-F0-9]{64}$/.test(query)) {
        // same cache the dropdown's entity row fills — usually instant
        const result = await lookupTxAcrossChainsCached(query);
        if (result.found && result.chain) {
          router.push(buildTxUrl(`/explorer/mainnet/${result.chain.slug}`, query));
          return;
        }
      }
      setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  };

  const identifier = looksLikeIdentifier(q.trim()) || !!classifyLocally(q.trim());
  const question = askable && !entity && looksLikeQuestion(q, { identifier, chainHit: hits.length > 0 });
  const canAsk = askable && !entity && canAskPhrase(q, identifier);
  const askHref = `${queryPage}?q=${encodeURIComponent(q.trim())}`;
  const showRecents = focused && !q && (recents.length > 0 || askable);
  const showHits = focused && !!q.trim() && (hits.length > 0 || entity !== null || canAsk);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!showHits || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (s + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => (s <= 0 ? hits.length - 1 : s - 1));
    } else if (e.key === "Escape") {
      setSel(-1);
      inputRef.current?.blur();
    }
  };

  return (
    // pl-0!/pr-0!: this div is a direct child of <header>, so the global
    // `header > div` navbar padding hack (global.css) would indent it by 3rem
    <div className="relative w-full pl-0! pr-0!">
      {/* the C-Chain's box: one input for finding and for asking, sent with the arrow */}
      <form
        onSubmit={submit}
        className={cn(
          "flex items-center gap-3 rounded-2xl border bg-white py-2.5 pl-4 pr-2.5 shadow-[0_8px_24px_-16px_rgba(24,24,27,0.3)] transition-colors focus-within:border-zinc-900 dark:bg-zinc-950 dark:focus-within:border-zinc-100",
          notFound ? "border-[#E6212F]" : "border-zinc-300 dark:border-zinc-700",
          busy && "opacity-60",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setNotFound(false);
            setSel(-1);
          }}
          onFocus={() => {
            setFocused(true);
            if (askable) setRecentAsked((askAt ? [...recentQuestions("c-chain"), ...recentQuestions("p-chain")] : recentQuestions(chain)).slice(0, 3));
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={askable ? "Search an address, tx, block, NodeID or chain, or ask a question…" : "Search chains by name or ID, block height, tx hash, NodeID, or any address"}
          aria-label={askable ? "Search or ask a question" : "Search"}
          spellCheck={false}
          className="min-h-[1.75rem] min-w-0 flex-1 bg-transparent py-1 font-mono text-[13px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-600"
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQ("");
              setNotFound(false);
              inputRef.current?.focus();
            }}
            className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-md border border-zinc-200 px-1.5 font-mono text-[10px] leading-[18px] text-zinc-400 sm:inline-block dark:border-zinc-800 dark:text-zinc-500">/</kbd>
        )}
        <button
          type="submit"
          disabled={!q.trim() || busy}
          aria-label={question ? "Ask" : "Search"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </form>

      {/* live suggestions: the entity the identifier resolves to, then the
          shared chain rows every explorer search uses */}
      {showHits && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_16px_40px_-20px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950">
          {entity && <EntityHitRow hit={entity} onSelect={goToHref} />}
          {canAsk && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                goToHref(askHref);
              }}
              className={cn(
                "group flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900",
                question && "bg-zinc-50 dark:bg-zinc-900",
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#E6212F]" />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-900 dark:text-zinc-100">
                <span className="text-zinc-400 dark:text-zinc-500">Ask </span>
                {q.trim()}
              </span>
              <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 group-hover:text-[#E6212F] dark:text-zinc-500">
                {question ? "Enter" : "Chart it"}
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </button>
          )}
          {hits.map((hit, i) => (
            <ChainHitRow
              key={hit.chain.href}
              match={hit}
              selected={i === sel}
              validators={hit.chain.subnetId ? liveValidators?.get(hit.chain.subnetId) : undefined}
              onSelect={() => goToChain(hit.chain)}
              onHover={() => setSel(i)}
            />
          ))}
        </div>
      )}

      {/* recents — mousedown beats blur, so rows stay clickable */}
      {showRecents && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_16px_40px_-20px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950">
          {askable &&
            [
              { label: "Recent questions", icon: History, items: recentAsked },
              { label: "Ask", icon: Sparkles, items: starters.filter((x) => !recentAsked.includes(x)).slice(0, recentAsked.length ? 2 : 4) },
            ]
              .filter((g) => g.items.length)
              .map((g) => (
                <div key={g.label}>
                  <p className="border-b border-zinc-100 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:border-zinc-900 dark:text-zinc-500">{g.label}</p>
                  {g.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        goToHref(`${queryPage}?q=${encodeURIComponent(item)}`);
                      }}
                      className="group flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
                    >
                      <g.icon className={cn("h-3.5 w-3.5 shrink-0", g.label === "Ask" ? "text-[#E6212F]" : "text-zinc-300 dark:text-zinc-600")} />
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-700 dark:text-zinc-300">{item}</span>
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-zinc-300 group-hover:text-[#E6212F] dark:text-zinc-600" />
                    </button>
                  ))}
                </div>
              ))}
          {askable && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                goToHref(queryPage);
              }}
              className="group flex w-full items-center justify-between border-b border-zinc-100 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              All questions and the Query page
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
          {recents.length > 0 && (
            <p className="border-b border-zinc-100 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:border-zinc-900 dark:text-zinc-500">
              {askable ? "Recent searches" : "Recent"}
            </p>
          )}
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
  hideHeader = false,
  children,
}: {
  chain: string;
  network: string;
  /** Optional right-hand companion for the title row (e.g. a live figure). */
  aside?: React.ReactNode;
  /** Metric detail sheets carry their own title and breadcrumb — they skip
   *  the chain identity header and search, keeping only the subnav spine.
   *  Same contract as ExplorerLayout's hideHeader. */
  hideHeader?: boolean;
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
        {/* load sequence, as on the homepage/solutions: header rises first,
            the page body follows. Rise wraps the <header> from OUTSIDE so its
            div never becomes a `header > div` (the global navbar padding hack). */}
        {!hideHeader && (
          <Rise delay={0.05}>
            <header className="flex flex-col gap-6 pb-10">
              {/* the subnav names the chain; the header is the search and the
                  page's live figure beside it. pl-0!/pr-0! override the global
                  `header > div` navbar padding hack (global.css). */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pl-0! pr-0!">
                <SearchBox chain={chain} network={network} ask={chain === "p-chain"} />
                {aside}
              </div>
            </header>
          </Rise>
        )}
        <Rise delay={0.14}>{children}</Rise>
      </div>
    </main>
  );
}
