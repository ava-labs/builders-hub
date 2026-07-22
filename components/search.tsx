"use client";

import { useEffect, useState } from "react";
import { liteClient } from "algoliasearch/lite";
import {
  createContentHighlighter,
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
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";

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

interface AlgoliaHit {
  objectID: string;
  title: string;
  section?: string;
  section_id?: string;
  content: string;
  url: string;
}

// Same grouping as fumadocs-core's algolia client, but the heading/text
// rows are KEPT so every page shows the matching section context under it.
function groupHits(hits: AlgoliaHit[], query: string): SortedResult[] {
  const highlighter = createContentHighlighter(query);
  const grouped: SortedResult[] = [];
  const scannedUrls = new Set<string>();

  for (const hit of hits) {
    if (!scannedUrls.has(hit.url)) {
      scannedUrls.add(hit.url);
      grouped.push({
        id: hit.url,
        type: "page",
        url: hit.url,
        content: hit.title,
        contentWithHighlights: highlighter.highlight(hit.title),
      });
    }
    // a row that just repeats the page title adds no context
    if (hit.content === hit.title) continue;
    grouped.push({
      id: hit.objectID,
      type: hit.content === hit.section ? "heading" : "text",
      url: hit.section_id ? `${hit.url}#${hit.section_id}` : hit.url,
      content: hit.content,
      contentWithHighlights: highlighter.highlight(hit.content),
    });
  }

  return grouped;
}

export default function CustomSearchDialog(props: SharedProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SortedResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
              hitsPerPage: 12,
            },
          ],
        });
        if (!cancelled) {
          setResults(
            groupHits(res.results[0].hits as unknown as AlgoliaHit[], search),
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
      isLoading={isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={results} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
