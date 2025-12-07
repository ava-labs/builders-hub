/**
 * MCP Server utilities for Avalanche documentation
 *
 * This module provides helper functions for the MCP (Model Context Protocol) server
 * that enables AI assistants to search and fetch Avalanche documentation.
 */

import { documentation, academy, integration, blog } from "@/lib/source";
import { getLLMText } from "@/lib/llm-utils";

// Cache for documentation content
const docsCache: Map<string, { content: string; timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

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
    // Error getting content for URL - return null to handle gracefully
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
}

/**
 * Search function that searches across all documentation
 */
export function searchDocs(
  query: string,
  options: { source?: string; limit?: number } = {}
): SearchResult[] {
  const { source, limit = 10 } = options;
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  const results: SearchResult[] = [];

  const sources: Array<{
    name: string;
    pages: Array<{ url: string; data: { title: string; description?: string } }>;
  }> = [];

  if (!source || source === "docs") {
    sources.push({ name: "docs", pages: documentation.getPages() });
  }
  if (!source || source === "academy") {
    sources.push({ name: "academy", pages: academy.getPages() });
  }
  if (!source || source === "integrations") {
    sources.push({ name: "integrations", pages: integration.getPages() });
  }
  if (!source || source === "blog") {
    sources.push({ name: "blog", pages: blog.getPages() });
  }

  for (const { name, pages } of sources) {
    for (const page of pages) {
      const titleLower = page.data.title?.toLowerCase() || "";
      const descLower = page.data.description?.toLowerCase() || "";
      const urlLower = page.url.toLowerCase();

      let score = 0;

      for (const term of queryTerms) {
        if (titleLower.includes(term)) score += 20;
        if (descLower.includes(term)) score += 10;
        if (urlLower.includes(term)) score += 5;
      }

      if (titleLower.includes(queryLower)) score += 30;
      if (descLower.includes(queryLower)) score += 15;

      if (score > 0) {
        results.push({
          url: page.url,
          title: page.data.title || "Untitled",
          description: page.data.description,
          source: name,
          score,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
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
    const parts = page.url.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const section = parts[1];
      docSections[section] = (docSections[section] || 0) + 1;
    }
  }

  const academySections: Record<string, number> = {};
  for (const page of academyPages) {
    const parts = page.url.split("/").filter(Boolean);
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
}

/**
 * MCP Server configuration
 */
export const MCP_SERVER_CONFIG = {
  name: "avalanche-docs",
  version: "1.0.0",
  protocolVersion: "2024-11-05",
  description: "MCP server for Avalanche documentation",
  baseUrl: "https://build.avax.network",
};
