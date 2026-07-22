"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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
  const hasResults = !!entity || chains.length > 0;

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const submit = () => {
    if (entity?.href) return go(entity.href);
    // a bare identifier with no local match shouldn't jump to a name hit
    if (!looksLikeIdentifier(trimmed) && chains[0]?.chain.hasExplorer) return go(chains[0].chain.href);
  };

  return (
    // pl-0!/pr-0!: this div is a direct child of <header>, so the global
    // `header > div` navbar padding hack (global.css) would indent it by 3rem
    <div ref={wrapRef} className="relative w-full pl-0! pr-0!">
      <div className="flex items-center gap-3 border border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-sm transition-colors focus-within:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:focus-within:border-zinc-100">
        <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search by address, tx hash, block, or chain…"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      {open && trimmed.length > 0 && hasResults && (
        <div className="absolute z-30 mt-1.5 max-h-[26rem] w-full overflow-auto border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {entity && <EntityHitRow hit={entity} onSelect={go} />}
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
