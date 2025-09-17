"use client";
import { SearchDialog, TagsList, type SharedProps } from "fumadocs-ui/components/dialog/search";
import { useState } from "react";
import algoliasearch from "algoliasearch/lite";
import { useDocsSearch } from "fumadocs-core/search/client";

const appId = "0T4ZBDJ3AF";
const apiKey = "9b74c8a3bba6e59a00209193be3eb63a";
const indexName = "builder-hub";

const client = algoliasearch(appId, apiKey);
const index = client.initIndex(indexName);

const tagItems = [
  { name: "Docs", value: "docs" },
  { name: "Academy", value: "academy" },
  { name: "Integrations & Guides", value: "ig" },
];

export default function CustomSearchDialog(props: SharedProps) {
  const [tag, setTag] = useState<string | undefined>("docs");
  const { search, setSearch, query } = useDocsSearch(
    {
      type: "algolia",
      index,
    }, "en", tag
  );

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      results={query.data === "empty" ? "empty" : query.data || []}
      isLoading={query.isLoading}
      footer={
        <div className="flex items-center justify-between">
          <TagsList tag={tag} onTagChange={setTag} items={tagItems} allowClear={true} />
          <a href="https://algolia.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
            Search powered by Algolia
          </a>
        </div>
      }
      {...props}
    />
  );
}
