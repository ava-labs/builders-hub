/**
 * MCP Server utilities for Avalanche documentation
 *
 * This module provides helper functions for the MCP (Model Context Protocol) server
 * that enables AI assistants to search and fetch Avalanche documentation.
 */

import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';

// Cache for documentation content
const docsCache: Map<string, { content: string; timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const CHUNK_WORDS = 180;
const CHUNK_OVERLAP_WORDS = 35;
const MAX_RESULTS = 50;

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

function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenizeQuery(query: string): string[] {
  return normalizeForSearch(query)
    .split(/[^a-z0-9_/-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function splitIntoChunks(content: string): string[] {
  const words = content
    .replace(/\r\n/g, '\n')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return [];
  if (words.length <= CHUNK_WORDS) return [words.join(' ')];

  const chunks: string[] = [];
  const step = CHUNK_WORDS - CHUNK_OVERLAP_WORDS;

  for (let start = 0; start < words.length; start += step) {
    const chunk = words.slice(start, start + CHUNK_WORDS).join(' ');
    if (chunk) chunks.push(chunk);
    if (start + CHUNK_WORDS >= words.length) break;
  }

  return chunks;
}

async function buildDocsSearchIndex(): Promise<SearchChunk[]> {
  const groups = getSourceGroups();
  const chunksByPage = await Promise.all(
    groups.flatMap(({ name, pages }) =>
      pages.map(async (page) => {
        let content = '';

        try {
          content = await getLLMText(page as Parameters<typeof getLLMText>[0]);
        } catch (error) {
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
      })
    )
  );

  return chunksByPage.flat();
}

async function getDocsSearchIndex(): Promise<SearchChunk[]> {
  if (!docsSearchIndexPromise) {
    docsSearchIndexPromise = buildDocsSearchIndex();
  }

  return docsSearchIndexPromise;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;

  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
}

function scoreChunk(chunk: SearchChunk, normalizedQuery: string, queryTerms: string[]): number {
  const title = normalizeForSearch(chunk.title);
  const description = normalizeForSearch(chunk.description || '');
  const url = normalizeForSearch(chunk.url);
  let score = 0;

  if (title.includes(normalizedQuery)) score += 80;
  if (description.includes(normalizedQuery)) score += 45;
  if (url.includes(normalizedQuery)) score += 30;
  if (chunk.normalizedText.includes(normalizedQuery)) score += 60;

  for (const term of queryTerms) {
    if (title.includes(term)) score += 18;
    if (description.includes(term)) score += 10;
    if (url.includes(term)) score += 6;

    const bodyMatches = countOccurrences(chunk.normalizedText, term);
    if (bodyMatches > 0) {
      score += Math.min(bodyMatches, 6) * 5;
    }
  }

  if (queryTerms.length > 1 && queryTerms.every((term) => chunk.normalizedText.includes(term))) {
    score += 25;
  }

  return score;
}

function makeExcerpt(text: string, normalizedQuery: string, queryTerms: string[]): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  const lower = collapsed.toLowerCase();
  const matchCandidates = [normalizedQuery, ...queryTerms].filter(Boolean);
  const firstMatch = matchCandidates
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0;

  const start = Math.max(0, firstMatch - 140);
  const end = Math.min(collapsed.length, firstMatch + 360);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < collapsed.length ? '...' : '';

  return `${prefix}${collapsed.slice(start, end)}${suffix}`;
}

function matchesPathPrefix(url: string, pathPrefixes?: string[]): boolean {
  if (!pathPrefixes || pathPrefixes.length === 0) return true;
  return pathPrefixes.some((prefix) => url.startsWith(prefix));
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

/**
 * MCP Server configuration
 */
export const MCP_SERVER_CONFIG = {
  name: 'avalanche-mcp',
  version: '2.1.0',
  protocolVersion: '2024-11-05',
  description: 'Unified read-only MCP server for Avalanche docs, CLI/RPC/ACP lookup, GitHub code search, blockchain lookups, P-Chain, and Info API',
  baseUrl: 'https://build.avax.network',
};
