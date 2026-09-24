"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUp, ArrowUpRight, History, Search, Sparkles } from "lucide-react";
import { EXAMPLE_PROMPTS } from "@/lib/explorer-query/examples";
import { recentQuestions } from "@/lib/explorer-query/recent";
import { canAskPhrase, looksLikeQuestion } from "@/lib/explorer-query/ask";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import { cn } from "@/lib/utils";
import {
  matchChains,
  looksLikeIdentifier,
  ChainHitRow,
  EntityHitRow,
  type ChainMatch,
  type EntityHit,
} from "@/components/explorer-v2/chain-search";
import { classifyEvmLocally } from "@/lib/evm-explorer";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";

// EVM search is simpler than the P-chain one: every identifier shape is
// unambiguous (digits → block, 0x…40 → address, 0x…64 → tx) and always lives on
// the chain currently being explored, so there is no cross-chain race and no
// search API round-trip. The dropdown still reuses the shared chain-suggestion
// engine (matchChains + ChainHitRow) so a builder can jump to any other chain
// by name/ID from the same box.

/** Resolve an EVM identifier to the entity row Enter/click will follow. */
function evmEntity(query: string, base: string, chainName: string): EntityHit | null {
  const c = classifyEvmLocally(query);
  if (!c) return null;
  if (c.type === "block")
    return { icon: "block", label: "Block", id: c.id, href: buildBlockUrl(base, c.id), detail: chainName, status: "ready" };
  if (c.type === "address")
    return { icon: "address", label: "Address", id: c.id, href: buildAddressUrl(base, c.id), detail: chainName, status: "ready" };
  return { icon: "tx", label: "Transaction", id: c.id, href: buildTxUrl(base, c.id), detail: chainName, status: "ready" };
}

export function EvmSearchBox({
  base,
  chainName,
}: {
  /** /explorer/{network}/{chainSlug} — the current chain's route root */
  base: string;
  chainName: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // questions are answered from the indexed tables; chains with an RPC in the catalog
  const slug = base.split("/").pop();
  const askable = (l1ChainsData as L1Chain[]).some((c) => c.slug === slug && !!c.rpcUrl);
  // an empty, focused box offers the way back to asking: this device's
  // recent questions, a few to start from, and the Query page itself
  const [recent, setRecent] = useState<string[]>([]);

  // "/" jumps to the box from anywhere on the page (the site navbar owns ⌘K)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const trimmed = q.trim();
  const entity = trimmed ? evmEntity(trimmed, base, chainName) : null;
  const chains: ChainMatch[] = trimmed.length >= 2 ? matchChains(trimmed, null) : [];
  const identifier = !!classifyEvmLocally(trimmed) || looksLikeIdentifier(trimmed);
  const question = askable && !entity && looksLikeQuestion(trimmed, { identifier, chainHit: chains.length > 0 });
  // a phrase of two words or more can always be asked, even when a chain matches
  const canAsk = askable && !entity && canAskPhrase(trimmed, identifier);
  const askHref = `${base}/query?q=${encodeURIComponent(trimmed)}`;
  const hasResults = !!entity || chains.length > 0 || canAsk;

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const submit = () => {
    if (entity?.href) return go(entity.href);
    if (question) return go(askHref);
    // a bare identifier with no local match shouldn't jump to a name hit
    if (!looksLikeIdentifier(trimmed) && chains[0]?.chain.hasExplorer) return go(chains[0].chain.href);
    // nothing else to open: a phrase goes to the Query page as a question
    if (canAsk) return go(askHref);
  };

  return (
    // pl-0!/pr-0!: this div is a direct child of <header>, so the global
    // `header > div` navbar padding hack (global.css) would indent it by 3rem
    <div ref={wrapRef} className="relative min-w-0 flex-1 pl-0! pr-0!">
      {/* the Query page's prompt box: one input for finding and for asking */}
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-300 bg-white py-2.5 pl-4 pr-2.5 shadow-[0_8px_24px_-16px_rgba(24,24,27,0.3)] transition-colors focus-within:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
        <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (askable && slug) setRecent(recentQuestions(slug).slice(0, 4));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
          ref={inputRef}
          placeholder={askable ? "Search an address, tx, block or chain, or ask a question…" : "Search by address, tx hash, block, or chain…"}
          aria-label={askable ? "Search the chain or ask a question about it" : "Search the chain"}
          spellCheck={false}
          className="min-h-[1.75rem] min-w-0 flex-1 bg-transparent py-1 font-mono text-[13px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-600"
        />
        {!trimmed && (
          <kbd className="hidden shrink-0 rounded-md border border-zinc-200 px-1.5 font-mono text-[10px] leading-[18px] text-zinc-400 sm:inline-block dark:border-zinc-800 dark:text-zinc-500">/</kbd>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!trimmed}
          aria-label={question ? "Ask" : "Search"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      {open && !trimmed && askable && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_16px_40px_-20px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950">
          {[
            { label: "Recent", icon: History, items: recent },
            { label: "Ask", icon: Sparkles, items: EXAMPLE_PROMPTS.filter((q) => !recent.includes(q)).slice(0, recent.length ? 3 : 5) },
          ]
            .filter((g) => g.items.length)
            .map((g) => (
              <div key={g.label}>
                <div className="border-b border-zinc-100 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 dark:border-zinc-900 dark:text-zinc-500">{g.label}</div>
                {g.items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(`${base}/query?q=${encodeURIComponent(item)}`)}
                    className="group flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
                  >
                    <g.icon className={cn("h-3.5 w-3.5 shrink-0", g.label === "Ask" ? "text-[#E6212F]" : "text-zinc-400 dark:text-zinc-500")} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-800 dark:text-zinc-200">{item}</span>
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-zinc-300 group-hover:text-[#E6212F] dark:text-zinc-600" />
                  </button>
                ))}
              </div>
            ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(`${base}/query`)}
            className="group flex w-full items-center justify-between px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            All questions and the Query page
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}

      {open && trimmed.length > 0 && hasResults && (
        <div className="absolute z-30 mt-2 max-h-[26rem] w-full overflow-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_16px_40px_-20px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950">
          {entity && <EntityHitRow hit={entity} onSelect={go} />}
          {canAsk && (
            <button
              type="button"
              onClick={() => go(askHref)}
              className={cn(
                "group flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900",
                question && "bg-zinc-50 dark:bg-zinc-900",
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#E6212F]" />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-900 dark:text-zinc-100">
                <span className="text-zinc-400 dark:text-zinc-500">Ask </span>
                {trimmed}
              </span>
              <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 group-hover:text-[#E6212F] dark:text-zinc-500">
                {question ? "Enter" : "Chart it"}
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </button>
          )}
          {chains.length > 0 && (
            <>
              <div className="border-b border-zinc-100 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 dark:border-zinc-900 dark:text-zinc-500">
                Chains
              </div>
              {chains.map((m) => (
                <ChainHitRow
                  key={m.chain.href}
                  match={m}
                  selected={false}
                  onSelect={() => go(m.chain.href)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
