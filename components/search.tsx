"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { liteClient } from "algoliasearch/lite";
import {
  createContentHighlighter,
  type HighlightedText,
  type SortedResult,
} from "fumadocs-core/search";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogListItem,
  SearchDialogOverlay,
  useSearchList,
  type SearchItemType,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { cn } from "@/lib/utils";
import { dialogRows, type AlgoliaHit } from "@/lib/search/dialog-rows";
import {
  ChainHitRow,
  EntityHitRow,
  looksLikeIdentifier,
  matchChains,
  useSearchEntity,
  type ChainMatch,
  type EntityHit,
  type EntityTargets,
} from "@/components/explorer-v2/chain-search";

// Search-only credentials (safe to ship to the client); the index is synced
// post-build from fumadocs' static.json export by utils/update-index.ts.
//
// Composed from fumadocs' native dialog primitives, querying Algolia
// directly: the shipped AlgoliaSearchDialog in 16.0.15 leaks its footer
// outside the dialog, and its search client drops every heading/text hit
// after grouping, so results render as bare page titles with no context.
const appId = "0T4ZBDJ3AF";
const apiKey = "9b74c8a3bba6e59a00209193be3eb63a";
const indexName = "builder-hub";

const client = liteClient(appId, apiKey);

// Unlike fumadocs-core's algolia client, the heading/text rows are KEPT, so
// each page shows the sections that matched under it (lib/search/dialog-rows.ts).
function highlightRows(hits: AlgoliaHit[], query: string): SortedResult[] {
  const highlighter = createContentHighlighter(query);
  return dialogRows(hits).map((row) => ({
    ...row,
    contentWithHighlights: highlighter.highlight(row.content),
  }));
}

// fumadocs' highlight color (text-fd-primary, #1F66F4 here) misses 4.5:1 in
// dark mode and on the selected row in light mode
function renderHighlights(highlights: HighlightedText<ReactNode>[]): ReactNode {
  return highlights.map((node, i) =>
    node.styles?.highlight ? (
      <span key={i} className="text-[#1858D6] underline dark:text-[#6C9DFF]">
        {node.content}
      </span>
    ) : (
      <Fragment key={i}>{node.content}</Fragment>
    ),
  );
}

/* Explorer routing: the site search sends explorer identifiers (tx hashes,
   addresses, block heights, NodeIDs, P-Chain ids) and chain names to the
   explorer through the explorer's own search engine, so both search bars
   agree on where a query leads. Mainnet only. A bare number is a C-Chain
   block, the height most builders on the docs have in hand. */
const EXPLORER_TARGETS: EntityTargets = {
  network: "mainnet",
  blockBase: "/explorer/mainnet/c-chain",
  blockChainName: "C-Chain",
  evmAddressBase: "/explorer/mainnet/c-chain",
  evmAddressChainName: "C-Chain",
};

const ENTITY_ITEM_ID = "explorer:entity";
const chainItemId = (m: ChainMatch) => `explorer:chain:${m.chain.href}`;

/* A plain word only earns a chain row when it IS a chain name (top of the
   list) or a clear prefix of one (below the docs). Substrings never do:
   "staking" must not surface a chain. */
function chainRank(m: ChainMatch, q: string): "exact" | "prefix" | "weak" {
  if (m.matched.field !== "name") return "exact";
  const qLower = q.toLowerCase();
  if (m.chain.aliases.some((a) => a === qLower)) return "exact";
  if (qLower.length >= 3 && m.chain.aliases.some((a) => a.startsWith(qLower))) return "prefix";
  return "weak";
}

type ExplorerRow =
  | { kind: "entity"; hit: EntityHit }
  | { kind: "chain"; match: ChainMatch };

/* One explorer row in the dialog list; the list's arrow keys and hover
   drive the same highlight as the docs rows. */
function ExplorerListRow({ id, row, onSelect }: { id: string; row: ExplorerRow; onSelect: () => void }) {
  const { active, setActive } = useSearchList();
  const selected = active === id;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll only the list viewport: element.scrollIntoView would also
    // scroll the dialog's overflow-hidden, height-animated wrapper
    const el = ref.current;
    const box = el?.parentElement;
    if (!selected || !el || !box) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop -= b.top - r.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  }, [selected]);
  return (
    <div
      ref={ref}
      aria-selected={selected}
      onPointerMove={() => setActive(id)}
      className={cn("shrink-0 overflow-hidden rounded-lg", selected && row.kind === "entity" && "bg-fd-accent")}
    >
      {row.kind === "entity" ? (
        <EntityHitRow hit={row.hit} onSelect={onSelect} />
      ) : (
        <ChainHitRow match={row.match} selected={selected} onSelect={onSelect} />
      )}
    </div>
  );
}

export default function CustomSearchDialog(props: SharedProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SortedResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { onOpenChange } = props;

  const query = search.trim();
  const entity = useSearchEntity(query, EXPLORER_TARGETS);
  const chains = useMemo(() => matchChains(query, null), [query]);

  // Enter on a hash that is still resolving: keep the dialog open and go
  // once the explorer engine names the chain
  const [pending, setPending] = useState<string | null>(null);
  const holdOpen = useRef(false);
  // the explorer row behind each action item id, for the list's Item renderer
  const explorerRows = useRef(new Map<string, ExplorerRow>());

  const go = (href: string) => {
    setPending(null);
    router.push(href);
    onOpenChange(false);
  };

  useEffect(() => {
    if (pending === null) return;
    const first = entity[0];
    if (pending !== query || !first || first.status === "notfound") {
      setPending(null);
    } else if (first.href) {
      go(first.href);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, query, entity]);

  const handleOpenChange = (open: boolean) => {
    if (!open && holdOpen.current) {
      holdOpen.current = false;
      return;
    }
    onOpenChange(open);
  };

  const items = useMemo<SearchItemType[] | null>(() => {
    if (!query) return null;
    const rows = new Map<string, ExplorerRow>();
    const top: SearchItemType[] = [];
    const bottom: SearchItemType[] = [];
    const push = (list: SearchItemType[], id: string, row: ExplorerRow, onSelect: () => void) => {
      rows.set(id, row);
      list.push({ id, type: "action", node: null, onSelect });
    };

    // an identifier can earn more than one row — a bare bech32 address
    // both chains claim offers a row per chain
    entity.forEach((hit, i) => {
      push(top, `${ENTITY_ITEM_ID}:${i}`, { kind: "entity", hit }, () => {
        if (hit.href) {
          router.push(hit.href);
          return;
        }
        // nothing to open yet: the dialog stays, and a resolving id opens itself
        holdOpen.current = true;
        if (hit.status === "searching") setPending(hit.id);
      });
    });

    const identifier = looksLikeIdentifier(query);
    for (const m of chains) {
      const rank = identifier ? "exact" : chainRank(m, query);
      if (rank === "weak") continue;
      const list = rank === "exact" ? top : bottom;
      if (list.length >= (list === top ? 4 : 2)) continue;
      push(list, chainItemId(m), { kind: "chain", match: m }, () => router.push(m.chain.href));
    }

    if (top.length === 0 && bottom.length === 0) return results;
    explorerRows.current = rows;
    return [...top, ...(results ?? []), ...bottom];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, entity, chains, results]);

  useEffect(() => {
    if (search.trim().length === 0) {
      setResults(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await client.searchForHits({
          requests: [
            {
              type: "default",
              indexName,
              query: search,
              distinct: 5,
              // 20 pages, so most queries still list 12 once the explorer's
              // Accounts pages are left out
              hitsPerPage: 20,
              attributesToRetrieve: ["title", "url", "section", "section_id", "content", "tag"],
              attributesToSnippet: ["content:12"],
              snippetEllipsisText: "…",
            },
          ],
        });
        if (!cancelled) {
          setResults(
            highlightRows(res.results[0].hits as unknown as AlgoliaHit[], search),
          );
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={isLoading || pending !== null}
      {...props}
      onOpenChange={handleOpenChange}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList
          items={items}
          Item={({ item, onClick }) => {
            const row = item.type === "action" ? explorerRows.current.get(item.id) : undefined;
            if (row) return <ExplorerListRow id={item.id} row={row} onSelect={onClick} />;
            if (item.type !== "page" || !item.breadcrumbs?.length) {
              return <SearchDialogListItem item={item} onClick={onClick} renderHighlights={renderHighlights} />;
            }
            // where the page lives, on a line above its title
            return (
              <SearchDialogListItem item={item} onClick={onClick}>
                <p className="truncate text-xs text-fd-popover-foreground/70">{item.breadcrumbs.join(" › ")}</p>
                <p className="min-w-0 truncate font-medium">
                  {item.contentWithHighlights ? renderHighlights(item.contentWithHighlights) : item.content}
                </p>
              </SearchDialogListItem>
            );
          }}
        />
      </SearchDialogContent>
    </SearchDialog>
  );
}
