/**
 * MCP Server utilities for Avalanche documentation
 *
 * This module provides helper functions for the MCP (Model Context Protocol) server
 * that enables AI assistants to search and fetch Avalanche documentation.
 */

import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';
import {
  countOccurrences,
  makeExcerpt,
  matchesPathPrefix,
  normalizeForSearch,
  scoreChunk,
  splitIntoChunks,
  tokenizeQuery,
} from '@/lib/mcp/search-utils';

// Cache for documentation content
const docsCache: Map<string, { content: string; timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const MAX_RESULTS = 50;
// Concurrency cap for the cold-start index build. Prevents Promise.all from issuing
// a thousand simultaneous getLLMText calls and overwhelming the event loop / memory.
const INDEX_BUILD_CONCURRENCY = 8;

type SourceName = 'docs' | 'academy' | 'integrations' | 'blog';

type SourcePage = {
  url: string;
  data: {
    title?: string;
    description?: string;
  };
};

interface SourceGroup {
  name: SourceName;
  pages: SourcePage[];
}

interface SearchChunk {
  url: string;
  title: string;
  description?: string;
  source: SourceName;
  chunkIndex: number;
  text: string;
  normalizedText: string;
}

let docsSearchIndexPromise: Promise<SearchChunk[]> | null = null;

function getSourceGroups(source?: string): SourceGroup[] {
  const groups: SourceGroup[] = [];

  if (!source || source === 'docs') {
    groups.push({ name: 'docs', pages: documentation.getPages() as unknown as SourcePage[] });
  }
  if (!source || source === 'academy') {
    groups.push({ name: 'academy', pages: academy.getPages() as unknown as SourcePage[] });
  }
  if (!source || source === 'integrations') {
    groups.push({ name: 'integrations', pages: integration.getPages() as unknown as SourcePage[] });
  }
  if (!source || source === 'blog') {
    groups.push({ name: 'blog', pages: blog.getPages() as unknown as SourcePage[] });
  }

  return groups;
}

async function processWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

async function buildDocsSearchIndex(): Promise<SearchChunk[]> {
  const groups = getSourceGroups();
  const tasks = groups.flatMap(({ name, pages }) =>
    pages.map((page) => ({ name, page }))
  );

  let failedCount = 0;

  const chunksByPage = await processWithConcurrency(tasks, INDEX_BUILD_CONCURRENCY, async ({ name, page }) => {
    let content = '';

    try {
      content = await getLLMText(page as Parameters<typeof getLLMText>[0]);
    } catch (error) {
      failedCount += 1;
      console.error(`Error indexing content for ${page.url}:`, error);
    }

    if (content) {
      docsCache.set(page.url, { content, timestamp: Date.now() });
    }

    return splitIntoChunks(content).map((chunk, chunkIndex) => ({
      url: page.url,
      title: page.data.title || 'Untitled',
      description: page.data.description,
      source: name,
      chunkIndex,
      text: chunk,
      normalizedText: normalizeForSearch(chunk),
    }));
  });

  // Surface high failure rates so silent index degradation is visible in logs —
  // bounded concurrency prevents resource exhaustion, but per-page errors still
  // drop pages from the index.
  if (failedCount > 0 && tasks.length > 0) {
    const failureRate = failedCount / tasks.length;
    if (failureRate > 0.05 || failedCount >= 10) {
      console.warn(
        `[mcp/docs-index] ${failedCount}/${tasks.length} pages failed to index (${(failureRate * 100).toFixed(1)}%) — searches may return incomplete results`,
      );
    }
  }

  return chunksByPage.flat();
}

async function getDocsSearchIndex(): Promise<SearchChunk[]> {
  if (!docsSearchIndexPromise) {
    // Capture rejection so a transient build failure doesn't cache forever; a subsequent
    // call will rebuild instead of permanently returning the same rejection.
    docsSearchIndexPromise = buildDocsSearchIndex().catch((error) => {
      docsSearchIndexPromise = null;
      throw error;
    });
  }

  return docsSearchIndexPromise;
}

/**
 * Get page content with caching
 */
export async function getPageContent(url: string): Promise<string | null> {
  const cached = docsCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.content;
  }

  const allPages = [
    ...documentation.getPages(),
    ...academy.getPages(),
    ...integration.getPages(),
    ...blog.getPages(),
  ];

  const page = allPages.find((p) => p.url === url);
  if (!page) return null;

  try {
    const content = await getLLMText(page);
    docsCache.set(url, { content, timestamp: Date.now() });
    return content;
  } catch (error) {
    console.error(`Error getting content for ${url}:`, error);
    return null;
  }
}

/**
 * Search result type
 */
export interface SearchResult {
  url: string;
  title: string;
  description?: string;
  source: string;
  score: number;
  excerpt?: string;
  chunk?: string;
  chunkIndex?: number;
}

/**
 * Search function that searches across all documentation content.
 */
export async function searchDocs(
  query: string,
  options: { source?: string; limit?: number; pathPrefixes?: string[] } = {}
): Promise<SearchResult[]> {
  const { source, pathPrefixes } = options;
  const limit = Math.min(Math.max(Math.floor(options.limit || 10), 1), MAX_RESULTS);
  const normalizedQuery = normalizeForSearch(query);
  const queryTerms = tokenizeQuery(query);

  if (!normalizedQuery) return [];

  const index = await getDocsSearchIndex();
  const scoredResults = index
    .filter((chunk) => (!source || chunk.source === source) && matchesPathPrefix(chunk.url, pathPrefixes))
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, normalizedQuery, queryTerms),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const results: SearchResult[] = [];
  const perPageCounts = new Map<string, number>();

  for (const { chunk, score } of scoredResults) {
    const pageCount = perPageCounts.get(chunk.url) || 0;
    if (pageCount >= 2) continue;

    results.push({
      url: chunk.url,
      title: chunk.title,
      description: chunk.description,
      source: chunk.source,
      score,
      excerpt: makeExcerpt(chunk.text, normalizedQuery, queryTerms),
      chunk: chunk.text,
      chunkIndex: chunk.chunkIndex,
    });

    perPageCounts.set(chunk.url, pageCount + 1);
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Get documentation statistics
 */
export function getDocStats() {
  const docPages = documentation.getPages();
  const academyPages = academy.getPages();
  const integrationPages = integration.getPages();
  const blogPages = blog.getPages();

  const docSections: Record<string, number> = {};
  for (const page of docPages) {
    const parts = page.url.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const section = parts[1];
      docSections[section] = (docSections[section] || 0) + 1;
    }
  }

  const academySections: Record<string, number> = {};
  for (const page of academyPages) {
    const parts = page.url.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const section = parts[1];
      academySections[section] = (academySections[section] || 0) + 1;
    }
  }

  return {
    totalPages: docPages.length + academyPages.length + integrationPages.length + blogPages.length,
    docs: {
      total: docPages.length,
      sections: docSections,
    },
    academy: {
      total: academyPages.length,
      sections: academySections,
    },
    integrations: {
      total: integrationPages.length,
    },
    blog: {
      total: blogPages.length,
    },
  };
}

/**
 * Clear the documentation cache
 */
export function clearCache() {
  docsCache.clear();
  docsSearchIndexPromise = null;
}
