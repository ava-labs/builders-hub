"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EXAMPLES, PCHAIN_EXAMPLES, examplesFor } from "@/lib/explorer-query/examples";
import { type IndexState, type QueryChain, QueryPage, useStreamed } from "./EvmQuery";
import { PICK, PickFace } from "./QueryWorking";

/* Query at the network scope (/explorer/mainnet/query): the picker of
   chains, and the routing of a question to the chain it names. */

/** one chain the network-scope Query page can ask */
export interface NetworkQueryChain extends QueryChain {
  chainSlug: string;
  /** how the picker names the chain */
  label: string;
  logo?: string;
}

/* which chain a question names, by its name or slug as a whole word; the
   longest name wins, so "Dexalot Subnet" beats "Dexalot". Names shorter
   than three letters never match. Nothing named: null, and the question
   stays on the chain in view (the C-Chain, unless the reader changed it). */
function chainNamed(q: string, chains: NetworkQueryChain[]): string | null {
  const text = ` ${q.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  let best: { slug: string; len: number } | null = null;
  for (const c of chains) {
    for (const name of new Set([norm(c.label), norm(c.chainSlug), norm(c.chainSlug.replace(/-/g, ""))])) {
      if (name.length < 3) continue;
      if (text.includes(` ${name} `) && (!best || name.length > best.len)) best = { slug: c.chainSlug, len: name.length };
    }
  }
  return best?.slug ?? null;
}

/* the network page's suggestions: the C-Chain's, then one for the P-Chain
   and one naming an L1, so a reader sees a question can name its chain. The
   L1 is Beam, a busy one, so the card reads the same before and after the
   database's coverage streams in; another L1 only if Beam has no rows */
function networkExamples(chains: NetworkQueryChain[]): typeof EXAMPLES {
  const l1 = chains.find((c) => c.chainSlug === "beam") ?? chains.find((c) => c.kind === "evm" && c.chainSlug !== "c-chain");
  return [
    ...EXAMPLES,
    {
      group: "Other chains",
      hue: "#71717a",
      items: [
        { q: PCHAIN_EXAMPLES[0].items[0].q, hint: "Asked of the P-Chain", glyph: PCHAIN_EXAMPLES[0].items[0].glyph },
        ...(l1 ? [{ q: `Daily transactions on ${l1.label} over the last 30 days`, hint: `Asked of ${l1.label}`, glyph: "bars" as const }] : []),
      ],
    },
  ];
}

/* Query at the network scope: the All Networks chrome. A question goes to
   the chain it names, to the P-Chain when it is about staking (the model
   routes those), and to the C-Chain otherwise; the chip shows which chain
   answers and can change the default. The page remounts on a new chain,
   so no answer carries across. */
export function NetworkQuery({ network, chains, index }: { network: string; chains: NetworkQueryChain[]; index: Promise<IndexState[]> }) {
  const params = useSearchParams();
  const router = useRouter();
  const [slug, setSlug] = useState(() => {
    const asked = params.get("chain");
    return chains.some((c) => c.chainSlug === asked) ? asked! : "c-chain";
  });
  // what the database holds of each chain streams in after the page. A
  // chain it holds no rows of leaves the picker and is never asked, as when
  // the server left it out: its questions and links go to the C-Chain, the default
  const states = useStreamed(index);
  const listed = states ? chains.filter((x, i) => states[i] !== "empty" || x.chainSlug === "c-chain") : chains;
  const c = listed.find((x) => x.chainSlug === slug) ?? listed[0];
  // the chain a question names; a name other than the C-Chain's or the P-Chain's waits for the states
  const resolve = async (q: string) => {
    const hit = chainNamed(q, chains);
    if (!hit || hit === "c-chain" || hit === "p-chain") return hit;
    const s = states ?? (await index);
    return chainNamed(q, chains.filter((x, i) => s[i] !== "empty" || x.chainSlug === "c-chain"));
  };

  // the pick rides in the URL, so a shared question lands on its chain
  const pick = (next: string, q?: string, from?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("chain", next);
    url.searchParams.delete("from");
    url.searchParams.delete("then");
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    if (from) url.searchParams.set("from", from);
    window.history.replaceState(null, "", url.toString());
    setSlug(next);
  };

  const picker = (
    <DropdownMenu>
      <DropdownMenuTrigger title="Name a chain in the question to ask it; this sets the chain for questions that name none" className={PICK}>
        <PickFace label={c.label} logo={c.logo} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        {listed.map((x) => (
          <DropdownMenuItem key={x.chainSlug} onSelect={() => x.chainSlug !== c.chainSlug && pick(x.chainSlug)} className="gap-3">
            {x.logo ? (
              <img src={x.logo} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
            ) : (
              <span className="h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
            )}
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{x.label}</span>
            {x.chainSlug === c.chainSlug && <span aria-label="Current chain" className="h-1.5 w-1.5 shrink-0 bg-[#E6212F]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <QueryPage
      key={c.chainSlug}
      scope="network"
      network={network}
      c={c}
      examples={c.kind === "pchain" ? PCHAIN_EXAMPLES : c.chainSlug === "c-chain" ? networkExamples(listed) : examplesFor(c.chainId)}
      index={states ? states[chains.indexOf(c)] : null}
      picker={picker}
      resolve={resolve}
      // a question about another chain's data moves the picker, not the page
      // no "asked on" note here: the chip already says which chain answers
      onRoute={(route, q) =>
        listed.some((x) => x.chainSlug === route)
          ? pick(route, q)
          : router.push(`/explorer/${network}/${route}/query?q=${encodeURIComponent(q)}&from=${c.chainSlug}`)
      }
    />
  );
}
