"use client";
import { type SharedProps } from "fumadocs-ui/components/dialog/search";
import React, { useState, useEffect } from "react";
import { liteClient } from "algoliasearch/lite";
import { Search, ArrowUpRight } from "lucide-react";

const appId = "0T4ZBDJ3AF";
const apiKey = "9b74c8a3bba6e59a00209193be3eb63a";
const indexName = "builder-hub";

const client = liteClient(appId, apiKey);

const tagItems = [
  { name: "All", value: "" },
  { name: "Docs", value: "docs" },
  { name: "Academy", value: "academy" },
  { name: "Integrations & Guides", value: "ig" },
];

export default function CustomSearchDialog(props: SharedProps) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = React.useRef<HTMLDivElement>(null);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const searchParams: any = {
        hitsPerPage: 10,
        attributesToSnippet: ["content:30", "description:30"],
        highlightPreTag:
          '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">',
        highlightPostTag: "</mark>",
        snippetEllipsisText: "...",
      };

      if (tag && tag !== "") {
        searchParams.filters = `tag:${tag}`;
      }

      const searchResults = await client.search([
        {
          indexName,
          params: {
            query: searchTerm,
            ...searchParams,
          },
        },
      ]);
      const firstResult = searchResults.results[0] as any;
      setResults(firstResult?.hits || []);
    } catch (error) {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(search);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, tag]);

  // Handle ESC key to close dialog
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    if (props.open) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [props.open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (props.open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [props.open]);

  if (!props.open) {
    return null;
  }

  const handleClose = () => {
    if (props.onOpenChange) {
      props.onOpenChange(false);
    }
  };

  const handleResultClick = (item: any) => {
    if (item.url) {
      window.location.href = item.url;
      handleClose();
    }
  };

  const getHighlightedSnippet = (item: any) => {
    if (item._snippetResult?.content?.value) {
      return item._snippetResult.content.value;
    }
    if (item._snippetResult?.description?.value) {
      return item._snippetResult.description.value;
    }
    if (item._highlightResult?.content?.value) {
      return item._highlightResult.content.value;
    }
    if (item._highlightResult?.description?.value) {
      return item._highlightResult.description.value;
    }
    return item.description || item.content || "";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-4 pt-[10vh]">
        <div
          ref={modalRef}
          className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-background shadow-2xl transition-all border"
        >
          {/* Header */}
          <div className="relative border-b">
            <div className="flex items-center px-4 py-3">
              <Search className="h-5 w-5 text-muted-foreground mr-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="flex-1 bg-transparent border-0 text-foreground placeholder-fd-muted-foreground focus:outline-none text-base"
                autoFocus
              />
              <button
                onClick={handleClose}
                className="ml-3 px-2 py-1 rounded-md hover:bg-muted transition-colors text-xs text-muted-foreground border border-muted-foreground/20"
              >
                ESC
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                <span className="ml-3 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            ) : results.length > 0 ? (
              <div className="p-2">
                {results.map((item: any, index: number) => {
                  const snippet = getHighlightedSnippet(item);
                  const highlightedTitle =
                    item._highlightResult?.title?.value || item.title;

                  return (
                    <button
                      key={index}
                      onClick={() => handleResultClick(item)}
                      className="relative select-none px-3 py-3 text-start text-sm rounded-lg w-full hover:bg-fd-accent hover:text-fd-accent-foreground transition-all duration-200 group border border-transparent hover:border-fd-border/50 hover:shadow-sm"
                    >
                      <p
                        className="font-medium mb-2 text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                        dangerouslySetInnerHTML={{ __html: highlightedTitle }}
                      />
                      {snippet && (
                        <div
                          className="text-xs text-fd-muted-foreground line-clamp-2 leading-relaxed group-hover:text-fd-accent-foreground/80"
                          dangerouslySetInnerHTML={{ __html: snippet }}
                        />
                      )}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <ArrowUpRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : search ? (
              <div className="py-12 text-center">
                <Search className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No results found for "{search}"
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try different keywords
                </p>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Search className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Start typing to search
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-fd-secondary/50 p-3 empty:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                {tagItems.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTag(tag === item.value ? "" : item.value)}
                    className={`rounded-md border px-2 py-0.5 text-xs font-medium text-fd-muted-foreground transition-colors ${
                      tag === item.value
                        ? "bg-fd-accent text-fd-accent-foreground"
                        : "hover:bg-fd-accent/50"
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <a
                href="https://algolia.com"
                rel="noreferrer noopener"
                className="ms-auto text-xs text-fd-muted-foreground hover:text-fd-foreground transition-colors"
              >
                Search powered by Algolia
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
