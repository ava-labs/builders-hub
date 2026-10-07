"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EXAMPLES, NETWORK_EXAMPLES, PCHAIN_EXAMPLES, examplesFor } from "@/lib/explorer-query/examples";
import { NETWORK_SLUG } from "@/lib/explorer-query/target";
import { networkAsked } from "@/components/explorer-v2/network/ask-route";
import { type IndexState, type QueryChain, QueryPage, useStreamed } from "./EvmQuery";
import { ChainMark, PICK, PickFace } from "./QueryWorking";

/* Query at the network scope (/explorer/mainnet/query): the picker of
   chains, All chains first, and the routing of a question to the chain it
   names, or to All chains when it is about every chain. */

/** one chain the network-scope Query page can ask */
export interface NetworkQueryChain extends QueryChain {
  chainSlug: string;
  /** how the picker names the chain */
  label: string;
  logo?: string;
}

/* the chains a question names, by name or slug as a whole word, the
   longest name first, so "Dexalot Subnet" beats "Dexalot" and a name
   inside a longer one names nothing. Names shorter than three letters
   never match, and All chains is no chain's name. Nothing named: none,
   and the question stays on the chain in view (the C-Chain, unless the
   reader changed it). */
function chainsNamed(q: string, chains: NetworkQueryChain[]): string[] {
  let text = ` ${q.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  const found: string[] = [];
  for (;;) {
    let best: { slug: string; name: string } | null = null;
    for (const c of chains) {
      if (c.chainSlug === NETWORK_SLUG || found.includes(c.chainSlug)) continue;
      for (const name of new Set([norm(c.label), norm(c.chainSlug), norm(c.chainSlug.replace(/-/g, ""))])) {
        if (name.length < 3) continue;
        if (text.includes(` ${name} `) && (!best || name.length > best.name.length)) best = { slug: c.chainSlug, name };
      }
    }
    if (!best) return found;
    found.push(best.slug);
    text = text.split(` ${best.name} `).join(" ");
  }
}

/* the chain a question goes to: All chains for one about every chain or
   one that names two EVM chains or more (Beam against Dexalot), else the
   chain it names */
function routeOf(q: string, chains: NetworkQueryChain[]): string | null {
  if (networkAsked(q)) return NETWORK_SLUG;
  const named = chainsNamed(q, chains);
  return named.length > 1 && !named.includes("p-chain") ? NETWORK_SLUG : (named[0] ?? null);
}

/* the C-Chain's suggestions on the network page, then one for the
   P-Chain and one for every chain at once, so a reader sees a question
   can go past the C-Chain. The network's runs fixed SQL (fixed.ts) */
const NETWORK_PAGE_EXAMPLES: typeof EXAMPLES = [
  ...EXAMPLES,
  {
    group: "Other chains",
    hue: "#71717a",
    items: [
      { ...PCHAIN_EXAMPLES[0].items[0], hint: "Asked of the P-Chain" },
      { ...NETWORK_EXAMPLES[0].items[0], hint: "Asked of every chain" },
    ],
  },
];

/* Query at the network scope: the All Networks chrome. A question goes to
   the chain it names, to the P-Chain when it is about staking (the model
   routes those), and to the C-Chain otherwise; the chip shows which chain
   answers and can change the default. The page remounts on a new chain,
   so no answer carries across. */
export function NetworkQuery({ network, chains, index }: { network: string; chains: NetworkQueryChain[]; index: Promise<IndexState[]> }) {
  const params = useSearchParams();
  const router = useRouter();
  // a link's chain, else All chains for a question about every chain, as the search box's frame drew it
  const [slug, setSlug] = useState(() => {
    const asked = params.get("chain");
    if (chains.some((c) => c.chainSlug === asked)) return asked!;
    return networkAsked(params.get("q") ?? "") ? NETWORK_SLUG : "c-chain";
  });
  // what the database holds of each chain streams in after the page. A
  // chain it holds no rows of leaves the picker and is never asked, as when
  // the server left it out: its questions and links go to the C-Chain, the default
  const states = useStreamed(index);
  const listed = states ? chains.filter((x, i) => states[i] !== "empty" || x.chainSlug === "c-chain") : chains;
  const c = listed.find((x) => x.chainSlug === slug) ?? listed.find((x) => x.chainSlug === "c-chain")!;
  // where a question goes; a name other than the C-Chain's or the P-Chain's waits for the states
  const resolve = async (q: string) => {
    if (chainsNamed(q, chains).every((x) => x === "c-chain" || x === "p-chain")) return routeOf(q, chains);
    const s = states ?? (await index);
    return routeOf(q, chains.filter((x, i) => s[i] !== "empty" || x.chainSlug === "c-chain"));
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
        <PickFace label={c.label} logo={c.logo} all={c.chainSlug === NETWORK_SLUG} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        {listed.map((x) => (
          <DropdownMenuItem key={x.chainSlug} onSelect={() => x.chainSlug !== c.chainSlug && pick(x.chainSlug)} className="gap-3">
            <ChainMark logo={x.logo} all={x.chainSlug === NETWORK_SLUG} className="h-5 w-5 shrink-0" />
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
      examples={c.kind === "pchain" ? PCHAIN_EXAMPLES : c.chainSlug === "c-chain" ? NETWORK_PAGE_EXAMPLES : examplesFor(c.chainId)}
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
