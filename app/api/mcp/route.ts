import { NextResponse } from 'next/server';
import { z } from 'zod';
import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';

// =============================================================================
// AVALANCHE TERMINOLOGY SYNONYMS
// Maps common variations and abbreviations to their canonical forms
// =============================================================================
const AVALANCHE_SYNONYMS: Record<string, string[]> = {
  // L1/Subnet terminology (L1 is the new term, Subnet is legacy)
  'l1': ['subnet', 'subnets', 'layer1', 'layer 1', 'avalanche l1', 'blockchain'],
  'subnet': ['l1', 'subnets', 'layer1', 'avalanche l1'],

  // Cross-chain messaging
  'icm': ['interchain messaging', 'interchain', 'cross-chain', 'crosschain', 'teleporter', 'awm'],
  'teleporter': ['icm', 'interchain messaging', 'cross-chain messaging'],
  'awm': ['avalanche warp messaging', 'warp', 'warp messages', 'icm'],
  'warp': ['awm', 'avalanche warp messaging', 'warp messages'],

  // Token transfer
  'ictt': ['interchain token transfer', 'token bridge', 'bridge', 'cross-chain tokens'],
  'bridge': ['ictt', 'token bridge', 'interchain token transfer'],

  // Chains
  'c-chain': ['cchain', 'contract chain', 'evm'],
  'p-chain': ['pchain', 'platform chain'],
  'x-chain': ['xchain', 'exchange chain'],

  // Validators
  'validator': ['validators', 'staking', 'stake', 'node operator'],
  'staking': ['stake', 'validator', 'delegation', 'delegate'],

  // Tools
  'cli': ['avalanche-cli', 'avalanche cli', 'command line'],
  'avalanchego': ['avalanche go', 'node', 'avalanche node'],

  // Smart contracts
  'smart contract': ['contract', 'contracts', 'solidity', 'evm'],
  'precompile': ['precompiles', 'precompiled', 'stateful precompile'],

  // Common abbreviations
  'api': ['apis', 'endpoint', 'endpoints', 'rpc'],
  'rpc': ['rpcs', 'api', 'endpoint', 'json-rpc'],
  'sdk': ['sdks', 'library', 'libraries'],
  'vm': ['virtual machine', 'evm', 'subnet-evm'],
};

// =============================================================================
// SEARCH UTILITIES
// =============================================================================

/**
 * Expand query with synonyms for better search coverage
 */
function expandQueryWithSynonyms(query: string): string[] {
  const queryLower = query.toLowerCase();
  const terms = queryLower.split(/\s+/).filter(t => t.length > 1);
  const expandedTerms = new Set<string>(terms);

  for (const term of terms) {
    // Check if term has synonyms
    if (AVALANCHE_SYNONYMS[term]) {
      for (const synonym of AVALANCHE_SYNONYMS[term]) {
        expandedTerms.add(synonym);
      }
    }
    // Check if term is a synonym of something else
    for (const [canonical, synonyms] of Object.entries(AVALANCHE_SYNONYMS)) {
      if (synonyms.includes(term)) {
        expandedTerms.add(canonical);
        for (const syn of synonyms) {
          expandedTerms.add(syn);
        }
      }
    }
  }

  return Array.from(expandedTerms);
}

/**
 * Calculate fuzzy match score using trigram similarity
 */
function trigramSimilarity(str1: string, str2: string): number {
  const getTrigrams = (s: string): Set<string> => {
    const padded = `  ${s.toLowerCase()}  `;
    const trigrams = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.slice(i, i + 3));
    }
    return trigrams;
  };

  const trigrams1 = getTrigrams(str1);
  const trigrams2 = getTrigrams(str2);

  let matches = 0;
  for (const t of trigrams1) {
    if (trigrams2.has(t)) matches++;
  }

  const union = new Set([...trigrams1, ...trigrams2]).size;
  return union > 0 ? matches / union : 0;
}

/**
 * Calculate word-level match score
 */
function wordMatchScore(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const textLower = text.toLowerCase();

  let score = 0;
  let consecutiveMatches = 0;
  let lastMatchPos = -1;

  for (const word of queryWords) {
    const pos = textLower.indexOf(word);
    if (pos !== -1) {
      score += 1;
      // Bonus for consecutive word matches (phrase matching)
      if (lastMatchPos !== -1 && pos > lastMatchPos && pos < lastMatchPos + 50) {
        consecutiveMatches++;
        score += consecutiveMatches * 0.5;
      }
      lastMatchPos = pos;
    }
  }

  return queryWords.length > 0 ? score / queryWords.length : 0;
}

// =============================================================================
// PAGE CONTENT HELPERS
// =============================================================================

// Use a generic type that works with fumadocs page types
type AnyPage = {
  url: string;
  data: {
    title?: string;
    description?: string;
  };
};

function getAllPages(): AnyPage[] {
  return [
    ...documentation.getPages(),
    ...academy.getPages(),
    ...integration.getPages(),
    ...blog.getPages(),
  ] as AnyPage[];
}

async function getPageContent(url: string): Promise<string | null> {
  const allPages = getAllPages();
  const page = allPages.find((p) => p.url === url);
  if (!page) return null;

  try {
    return await getLLMText(page as any);
  } catch (error) {
    console.error(`Error getting content for ${url}:`, error);
    return null;
  }
}

// =============================================================================
// ENHANCED SEARCH FUNCTION
// =============================================================================

interface SearchResult {
  url: string;
  title: string;
  description?: string;
  source: string;
  score: number;
  section?: string;
  matchType: 'exact' | 'synonym' | 'fuzzy' | 'partial';
}

interface SearchOptions {
  source?: string;
  section?: string;
  limit?: number;
  includeContent?: boolean;
}

function searchDocs(query: string, options: SearchOptions = {}): SearchResult[] {
  const { source, section, limit = 10 } = options;
  const queryLower = query.toLowerCase();
  const expandedTerms = expandQueryWithSynonyms(query);
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  const results: SearchResult[] = [];

  // Get pages from selected sources
  const sources: Array<{
    name: string;
    pages: AnyPage[];
  }> = [];

  if (!source || source === 'docs') {
    sources.push({ name: 'docs', pages: documentation.getPages() as AnyPage[] });
  }
  if (!source || source === 'academy') {
    sources.push({ name: 'academy', pages: academy.getPages() as AnyPage[] });
  }
  if (!source || source === 'integrations') {
    sources.push({ name: 'integrations', pages: integration.getPages() as AnyPage[] });
  }
  if (!source || source === 'blog') {
    sources.push({ name: 'blog', pages: blog.getPages() as AnyPage[] });
  }

  for (const { name, pages } of sources) {
    for (const page of pages) {
      // Filter by section if specified
      if (section) {
        const pageSection = page.url.split('/')[2];
        if (pageSection !== section) continue;
      }

      const titleLower = page.data.title?.toLowerCase() || '';
      const descLower = page.data.description?.toLowerCase() || '';
      const urlLower = page.url.toLowerCase();
      const pageSection = page.url.split('/').filter(Boolean)[1] || '';

      let score = 0;
      let matchType: SearchResult['matchType'] = 'partial';

      // 1. Exact phrase match (highest priority)
      if (titleLower.includes(queryLower)) {
        score += 100;
        matchType = 'exact';
      }
      if (descLower.includes(queryLower)) {
        score += 50;
        if (matchType !== 'exact') matchType = 'exact';
      }

      // 2. Individual term matching with position weighting
      for (const term of queryTerms) {
        // Title matches (highest weight)
        if (titleLower.includes(term)) {
          score += 30;
          // Bonus if term is at the start of title
          if (titleLower.startsWith(term)) score += 15;
        }
        // Description matches
        if (descLower.includes(term)) score += 15;
        // URL matches (indicates relevance to topic)
        if (urlLower.includes(term)) score += 10;
      }

      // 3. Synonym expansion matching
      for (const expandedTerm of expandedTerms) {
        if (!queryTerms.includes(expandedTerm)) {
          if (titleLower.includes(expandedTerm)) {
            score += 20;
            if (matchType === 'partial') matchType = 'synonym';
          }
          if (descLower.includes(expandedTerm)) {
            score += 10;
            if (matchType === 'partial') matchType = 'synonym';
          }
          if (urlLower.includes(expandedTerm)) {
            score += 5;
            if (matchType === 'partial') matchType = 'synonym';
          }
        }
      }

      // 4. Fuzzy matching for typo tolerance
      if (score < 20 && queryTerms.length > 0) {
        const titleWords = titleLower.split(/\s+/);
        for (const queryWord of queryTerms) {
          for (const titleWord of titleWords) {
            const similarity = trigramSimilarity(queryWord, titleWord);
            if (similarity > 0.4) {
              score += similarity * 15;
              if (matchType === 'partial') matchType = 'fuzzy';
            }
          }
        }
      }

      // 5. Word-level phrase matching bonus
      const phraseScore = wordMatchScore(query, `${titleLower} ${descLower}`);
      score += phraseScore * 20;

      // 6. Source-specific boosting
      // Boost main docs over academy for technical queries
      if (name === 'docs' && score > 0) {
        score *= 1.1;
      }
      // Boost integrations for tool/service queries
      if (name === 'integrations' && expandedTerms.some(t =>
        ['wallet', 'bridge', 'exchange', 'oracle', 'indexer', 'rpc'].includes(t)
      )) {
        score *= 1.2;
      }

      if (score > 0) {
        results.push({
          url: page.url,
          title: page.data.title || 'Untitled',
          description: page.data.description,
          source: name,
          section: pageSection,
          score: Math.round(score * 10) / 10,
          matchType,
        });
      }
    }
  }

  // Sort by score (descending) and limit results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// =============================================================================
// GET RELATED PAGES
// =============================================================================

function getRelatedPages(url: string, limit: number = 5): SearchResult[] {
  const allPages = getAllPages();

  const currentPage = allPages.find(p => p.url === url);
  if (!currentPage) return [];

  const urlParts = url.split('/').filter(Boolean);
  const section = urlParts[1] || '';
  const subsection = urlParts[2] || '';

  const results: SearchResult[] = [];

  for (const page of allPages) {
    if (page.url === url) continue; // Skip current page

    const pageUrlParts = page.url.split('/').filter(Boolean);
    const pageSection = pageUrlParts[1] || '';
    const pageSubsection = pageUrlParts[2] || '';

    let score = 0;
    const source = pageUrlParts[0] || 'docs';

    // Same section bonus
    if (pageSection === section) {
      score += 30;
      // Same subsection even higher
      if (pageSubsection === subsection) {
        score += 20;
      }
    }

    // Title/description similarity
    if (currentPage.data.title && page.data.title) {
      const similarity = trigramSimilarity(currentPage.data.title, page.data.title);
      score += similarity * 40;
    }

    // Keyword overlap in descriptions
    if (currentPage.data.description && page.data.description) {
      const currentWords = new Set(currentPage.data.description.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const pageWords = page.data.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const overlap = pageWords.filter(w => currentWords.has(w)).length;
      score += overlap * 5;
    }

    if (score > 10) {
      results.push({
        url: page.url,
        title: page.data.title || 'Untitled',
        description: page.data.description,
        source,
        section: pageSection,
        score: Math.round(score * 10) / 10,
        matchType: 'partial',
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// =============================================================================
// GET SECTION PAGES
// =============================================================================

interface SectionInfo {
  section: string;
  source: string;
  pageCount: number;
  pages: Array<{ url: string; title: string; description?: string }>;
}

function getSectionPages(sectionPath: string): SectionInfo | null {
  const parts = sectionPath.split('/').filter(Boolean);
  const sourceType = parts[0]; // docs, academy, integrations, blog
  const sectionName = parts[1];

  let pages: AnyPage[] = [];

  switch (sourceType) {
    case 'docs':
      pages = documentation.getPages() as AnyPage[];
      break;
    case 'academy':
      pages = academy.getPages() as AnyPage[];
      break;
    case 'integrations':
      pages = integration.getPages() as AnyPage[];
      break;
    case 'blog':
      pages = blog.getPages() as AnyPage[];
      break;
    default:
      return null;
  }

  const sectionPages = pages.filter(p => {
    const pageParts = p.url.split('/').filter(Boolean);
    return pageParts[1] === sectionName;
  });

  if (sectionPages.length === 0) return null;

  return {
    section: sectionName,
    source: sourceType,
    pageCount: sectionPages.length,
    pages: sectionPages.map(p => ({
      url: p.url,
      title: p.data.title || 'Untitled',
      description: p.data.description,
    })),
  };
}

// =============================================================================
// MCP SERVER CONFIGURATION
// =============================================================================

const SERVER_INFO = {
  name: 'builders-hub',
  version: '2.1.0',
  protocolVersion: '2024-11-05',
};

// =============================================================================
// TOOL DEFINITIONS - Optimized for Claude Code
// =============================================================================
// Guidelines followed:
// - Concise, action-oriented descriptions
// - Examples in parameter descriptions
// - Enums for constrained values
// - Clear required vs optional distinction
// - Coding-context aware descriptions

const TOOLS = [
  {
    name: 'avalanche_docs_search',
    description: `Search Avalanche documentation for APIs, code examples, tutorials, and technical guides. Understands Avalanche terminology (subnet=L1, AWM=Warp=ICM, ICTT=bridge). Use this FIRST when you need to find how to do something on Avalanche.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query, e.g. "deploy smart contract", "cross-chain message", "validator requirements", "RPC endpoints"',
        },
        source: {
          type: 'string',
          enum: ['docs', 'academy', 'integrations', 'blog'],
          description: 'docs=API refs & technical docs, academy=tutorials & courses, integrations=3rd party tools, blog=announcements',
        },
        section: {
          type: 'string',
          enum: ['avalanche-l1s', 'cross-chain', 'nodes', 'tooling', 'primary-network', 'api-reference', 'rpcs', 'acps'],
          description: 'Filter to specific doc section',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Max results (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'avalanche_docs_fetch',
    description: `Fetch full page content as markdown. Use after search to get complete documentation including code examples. Returns the entire page with all code blocks, configuration examples, and technical details.`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Page URL path from search results, e.g. "/docs/avalanche-l1s/create", "/docs/tooling/avalanche-cli/create-avalanche-l1"',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'avalanche_docs_search_code',
    description: `Search specifically for code examples, CLI commands, and configuration snippets in Avalanche documentation. Best for finding implementation examples, contract code, SDK usage, and CLI commands.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Code-related search, e.g. "sendCrossChainMessage solidity", "avalanche subnet create", "viem contract deploy"',
        },
        language: {
          type: 'string',
          enum: ['solidity', 'typescript', 'javascript', 'go', 'rust', 'bash', 'json'],
          description: 'Filter by programming language',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: 'Max results (default: 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'avalanche_docs_list_sections',
    description: `List all documentation sections with page counts. Use to discover what topics are available before searching.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'avalanche_docs_get_related',
    description: `Find related documentation pages. Use after reading a page to find prerequisites, next steps, or related concepts.`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of current page, e.g. "/docs/cross-chain/icm-contracts/overview"',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: 'Max results (default: 5)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'avalanche_docs_get_section',
    description: `List all pages in a documentation section. Use to browse available content in a topic area.`,
    inputSchema: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description: 'Format: "source/section", e.g. "docs/cross-chain", "docs/avalanche-l1s", "academy/avalanche-l1", "docs/tooling"',
        },
      },
      required: ['section'],
    },
  },
];

// Resource definitions
const RESOURCES = [
  {
    uri: 'docs://index',
    name: 'Documentation Index',
    description: 'Complete index of all Avalanche technical documentation pages',
    mimeType: 'text/markdown',
  },
  {
    uri: 'academy://index',
    name: 'Academy Index',
    description: 'Index of all Avalanche Academy courses and tutorials',
    mimeType: 'text/markdown',
  },
  {
    uri: 'integrations://index',
    name: 'Integrations Index',
    description: 'Directory of third-party integrations (wallets, bridges, oracles, etc.)',
    mimeType: 'text/markdown',
  },
  {
    uri: 'docs://terminology',
    name: 'Avalanche Terminology',
    description: 'Glossary of Avalanche terms and their synonyms/abbreviations',
    mimeType: 'text/markdown',
  },
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================

async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'avalanche_docs_search': {
      const query = args.query as string;
      const source = args.source as string | undefined;
      const section = args.section as string | undefined;
      const limit = args.limit as number | undefined;

      const results = searchDocs(query, { source, section, limit });

      if (results.length === 0) {
        // Provide helpful suggestions when no results found
        const expandedTerms = expandQueryWithSynonyms(query);
        const suggestions = expandedTerms.slice(0, 5).join(', ');
        return {
          content: [{
            type: 'text',
            text: `No results found for "${query}".\n\nTry searching for related terms: ${suggestions}\n\nOr browse available sections with avalanche_docs_list_sections.`,
          }],
        };
      }

      const formattedResults = results
        .map((r, i) => {
          const matchInfo = r.matchType !== 'exact' ? ` [${r.matchType} match]` : '';
          return `${i + 1}. **[${r.title}](https://build.avax.network${r.url})**${matchInfo}
   Source: ${r.source}${r.section ? ` > ${r.section}` : ''} | Score: ${r.score}
   ${r.description || 'No description available'}`;
        })
        .join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${results.length} results for "${query}":\n\n${formattedResults}`,
        }],
      };
    }

    case 'avalanche_docs_fetch': {
      const url = args.url as string;
      const normalizedUrl = url.startsWith('/') ? url : `/${url}`;

      const content = await getPageContent(normalizedUrl);

      if (!content) {
        // Try to suggest similar pages
        const searchTerm = normalizedUrl.split('/').pop()?.replace(/-/g, ' ') || '';
        const suggestions = searchDocs(searchTerm, { limit: 3 });

        let response = `Page not found: ${normalizedUrl}`;
        if (suggestions.length > 0) {
          response += `\n\nDid you mean one of these?\n${suggestions.map(s => `- ${s.url}: ${s.title}`).join('\n')}`;
        }

        return {
          content: [{ type: 'text', text: response }],
        };
      }

      return {
        content: [{ type: 'text', text: content }],
      };
    }

    case 'avalanche_docs_list_sections': {
      const docPages = documentation.getPages();
      const academyPages = academy.getPages();
      const integrationPages = integration.getPages();
      const blogPages = blog.getPages();

      // Group docs by top-level section with descriptions
      const docSections: Record<string, { count: number; description: string }> = {};
      const sectionDescriptions: Record<string, string> = {
        'primary-network': 'C-Chain, P-Chain, X-Chain documentation',
        'avalanche-l1s': 'Create and manage Layer 1 blockchains',
        'nodes': 'Run and configure Avalanche nodes',
        'cross-chain': 'ICM, ICTT, and cross-chain communication',
        'tooling': 'CLI, SDKs, and developer tools',
        'api-reference': 'API documentation and references',
        'rpcs': 'RPC endpoint specifications',
        'acps': 'Avalanche Community Proposals',
      };

      for (const page of docPages) {
        const parts = page.url.split('/').filter(Boolean);
        if (parts.length >= 2) {
          const section = parts[1];
          if (!docSections[section]) {
            docSections[section] = { count: 0, description: sectionDescriptions[section] || '' };
          }
          docSections[section].count++;
        }
      }

      // Group academy by course
      const academySections: Record<string, number> = {};
      for (const page of academyPages) {
        const parts = page.url.split('/').filter(Boolean);
        if (parts.length >= 2) {
          const section = parts[1];
          academySections[section] = (academySections[section] || 0) + 1;
        }
      }

      let text = '# Avalanche Documentation Structure\n\n';
      text += `**Total Pages**: ${docPages.length + academyPages.length + integrationPages.length + blogPages.length}\n\n`;

      text += '## Technical Documentation\n';
      text += 'Reference documentation for building on Avalanche.\n\n';
      for (const [section, info] of Object.entries(docSections).sort((a, b) => b[1].count - a[1].count)) {
        text += `- **${section}** (${info.count} pages)${info.description ? `: ${info.description}` : ''}\n`;
      }

      text += '\n## Academy Courses\n';
      text += 'Step-by-step tutorials and learning paths.\n\n';
      for (const [section, count] of Object.entries(academySections).sort((a, b) => b[1] - a[1])) {
        text += `- **${section}** (${count} pages)\n`;
      }

      text += `\n## Integrations\n`;
      text += `Third-party tools, wallets, bridges, and services.\n`;
      text += `- **${integrationPages.length}** integration listings\n`;

      text += `\n## Blog\n`;
      text += `Technical articles and announcements.\n`;
      text += `- **${blogPages.length}** blog posts\n`;

      return {
        content: [{ type: 'text', text }],
      };
    }

    case 'avalanche_docs_get_related': {
      const url = args.url as string;
      const limit = (args.limit as number) || 5;
      const normalizedUrl = url.startsWith('/') ? url : `/${url}`;

      const related = getRelatedPages(normalizedUrl, limit);

      if (related.length === 0) {
        return {
          content: [{ type: 'text', text: `No related pages found for: ${normalizedUrl}` }],
        };
      }

      const formattedResults = related
        .map((r, i) => `${i + 1}. **[${r.title}](https://build.avax.network${r.url})**
   ${r.source} > ${r.section || 'root'} | Relevance: ${r.score}
   ${r.description || 'No description'}`)
        .join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `Related pages for "${normalizedUrl}":\n\n${formattedResults}`,
        }],
      };
    }

    case 'avalanche_docs_get_section': {
      const sectionPath = args.section as string;
      const sectionInfo = getSectionPages(sectionPath);

      if (!sectionInfo) {
        return {
          content: [{
            type: 'text',
            text: `Section not found: ${sectionPath}\n\nUse avalanche_docs_list_sections to see available sections.`,
          }],
        };
      }

      const formattedPages = sectionInfo.pages
        .map((p, i) => `${i + 1}. **[${p.title}](https://build.avax.network${p.url})**
   ${p.description || 'No description'}`)
        .join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `# ${sectionInfo.section} (${sectionInfo.source})\n\n**${sectionInfo.pageCount} pages**\n\n${formattedPages}`,
        }],
      };
    }

    case 'avalanche_docs_search_code': {
      const query = args.query as string;
      const language = args.language as string | undefined;
      const limit = (args.limit as number) || 5;

      // Language-specific keywords to boost relevance
      const languageKeywords: Record<string, string[]> = {
        solidity: ['contract', 'function', 'pragma', 'import', 'interface', 'event', 'modifier', '.sol'],
        typescript: ['import', 'export', 'async', 'await', 'interface', 'type', '.ts', 'viem', 'ethers'],
        javascript: ['const', 'function', 'async', 'await', 'require', '.js', 'web3'],
        go: ['func', 'package', 'import', 'struct', '.go', 'avalanchego'],
        rust: ['fn', 'impl', 'struct', 'use', '.rs', 'cargo'],
        bash: ['avalanche', 'subnet', 'cast', 'forge', 'npm', 'yarn', 'curl', 'CLI'],
        json: ['genesis', 'config', 'package.json', 'tsconfig', 'hardhat.config'],
      };

      // Expand query with language keywords
      let expandedQuery = query;
      if (language && languageKeywords[language]) {
        // Add language context to help find relevant code
        expandedQuery = `${query} ${language}`;
      }

      // Search with code-focused boosting
      const results = searchDocs(expandedQuery, { limit: limit * 2 }); // Get extra results to filter

      // Filter and re-rank for code relevance
      const codeResults = results
        .map(r => {
          let codeScore = r.score;
          const titleLower = r.title.toLowerCase();
          const descLower = (r.description || '').toLowerCase();
          const urlLower = r.url.toLowerCase();

          // Boost pages likely to have code
          if (titleLower.includes('example') || titleLower.includes('tutorial')) codeScore *= 1.3;
          if (titleLower.includes('guide') || titleLower.includes('how to')) codeScore *= 1.2;
          if (urlLower.includes('getting-started') || urlLower.includes('quickstart')) codeScore *= 1.2;
          if (r.source === 'academy') codeScore *= 1.15; // Academy has more examples
          if (r.section === 'tooling') codeScore *= 1.2; // Tooling has CLI examples

          // Boost for language-specific content
          if (language && languageKeywords[language]) {
            for (const kw of languageKeywords[language]) {
              if (titleLower.includes(kw) || descLower.includes(kw) || urlLower.includes(kw)) {
                codeScore *= 1.15;
              }
            }
          }

          // Boost for code-related keywords in title/desc
          const codeKeywords = ['deploy', 'contract', 'sdk', 'api', 'cli', 'command', 'script', 'config'];
          for (const kw of codeKeywords) {
            if (titleLower.includes(kw) || descLower.includes(kw)) {
              codeScore *= 1.1;
            }
          }

          return { ...r, score: Math.round(codeScore * 10) / 10 };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      if (codeResults.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No code examples found for "${query}"${language ? ` in ${language}` : ''}.\n\nTry:\n- Broader search terms\n- Different language filter\n- Search without language filter`,
          }],
        };
      }

      // Format for Claude Code - concise and actionable
      const formattedResults = codeResults
        .map((r, i) => `${i + 1}. [${r.title}](${r.url}) - ${r.source}${r.section ? `/${r.section}` : ''}
   ${r.description || 'Code examples available'}`)
        .join('\n');

      return {
        content: [{
          type: 'text',
          text: `Code examples for "${query}"${language ? ` (${language})` : ''}:\n\n${formattedResults}\n\nUse avalanche_docs_fetch to get full code from any page.`,
        }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// =============================================================================
// RESOURCE HANDLERS
// =============================================================================

async function handleResourceRead(uri: string) {
  switch (uri) {
    case 'docs://index': {
      const docPages = documentation.getPages();
      const grouped: Record<string, Array<{ url: string; title: string; description?: string }>> = {};

      for (const page of docPages) {
        const section = page.url.split('/')[2] || 'root';
        if (!grouped[section]) grouped[section] = [];
        grouped[section].push({
          url: page.url,
          title: page.data.title || 'Untitled',
          description: page.data.description,
        });
      }

      let content = '# Avalanche Documentation Index\n\n';
      for (const [section, pages] of Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)) {
        content += `## ${section}\n`;
        for (const p of pages) {
          content += `- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ''}\n`;
        }
        content += '\n';
      }

      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: content,
        }],
      };
    }

    case 'academy://index': {
      const academyPages = academy.getPages();
      const grouped: Record<string, Array<{ url: string; title: string; description?: string }>> = {};

      for (const page of academyPages) {
        const course = page.url.split('/')[2] || 'root';
        if (!grouped[course]) grouped[course] = [];
        grouped[course].push({
          url: page.url,
          title: page.data.title || 'Untitled',
          description: page.data.description,
        });
      }

      let content = '# Avalanche Academy Courses\n\n';
      for (const [course, pages] of Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)) {
        content += `## ${course}\n`;
        for (const p of pages) {
          content += `- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ''}\n`;
        }
        content += '\n';
      }

      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: content,
        }],
      };
    }

    case 'integrations://index': {
      const integrationPages = integration.getPages();
      const content = integrationPages
        .map((p) => `- [${p.data.title}](${p.url})${p.data.description ? `: ${p.data.description}` : ''}`)
        .join('\n');
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: `# Avalanche Integrations\n\n${content}`,
        }],
      };
    }

    case 'docs://terminology': {
      let content = '# Avalanche Terminology & Synonyms\n\n';
      content += 'This glossary maps common terms, abbreviations, and their equivalents.\n\n';

      for (const [term, synonyms] of Object.entries(AVALANCHE_SYNONYMS)) {
        content += `## ${term}\n`;
        content += `Synonyms: ${synonyms.join(', ')}\n\n`;
      }

      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: content,
        }],
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

// =============================================================================
// JSON-RPC HANDLING
// =============================================================================

const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

async function processRequest(request: z.infer<typeof jsonRpcRequestSchema>) {
  const { method, params, id } = request;

  try {
    let result: unknown;

    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: SERVER_INFO.protocolVersion,
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: SERVER_INFO.name,
            version: SERVER_INFO.version,
          },
        };
        break;

      case 'tools/list':
        result = { tools: TOOLS };
        break;

      case 'tools/call':
        if (!params || typeof params.name !== 'string') {
          throw new Error('Invalid tool call: missing name');
        }
        result = await handleToolCall(
          params.name,
          (params.arguments as Record<string, unknown>) || {}
        );
        break;

      case 'resources/list':
        result = { resources: RESOURCES };
        break;

      case 'resources/read':
        if (!params || typeof params.uri !== 'string') {
          throw new Error('Invalid resource read: missing uri');
        }
        result = await handleResourceRead(params.uri);
        break;

      case 'ping':
        result = {};
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    };
  }
}

// =============================================================================
// HTTP HANDLERS
// =============================================================================

export async function GET() {
  return NextResponse.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocolVersion: SERVER_INFO.protocolVersion,
    description: 'Avalanche documentation MCP server optimized for Claude Code. Search docs, find code examples, and explore the Avalanche ecosystem.',
    tools: TOOLS,
    resources: RESOURCES,
    endpoints: {
      rpc: '/api/mcp',
      docs: 'https://build.avax.network',
    },
    features: [
      'Synonym expansion (subnet=L1, AWM=Warp=ICM)',
      'Code-focused search with language filtering',
      'Fuzzy matching for typo tolerance',
      'Related page discovery',
      'Section browsing',
      'Multi-source: docs, academy, integrations, blog',
    ],
    claudeCodeSetup: {
      command: 'claude mcp add builders-hub --transport http --url https://build.avax.network/api/mcp',
      config: {
        mcpServers: {
          'builders-hub': {
            transport: {
              type: 'http',
              url: 'https://build.avax.network/api/mcp',
            },
          },
        },
      },
    },
  });
}

function createSSEResponse(data: unknown, eventId?: string): Response {
  const encoder = new TextEncoder();
  let sseMessage = '';

  if (eventId) {
    sseMessage += `id: ${eventId}\n`;
  }
  sseMessage += `data: ${JSON.stringify(data)}\n\n`;

  return new Response(encoder.encode(sseMessage), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

function wantsSSE(request: Request): boolean {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/event-stream');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const useSSE = wantsSSE(request);

    // Handle batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(
        body.map(async (req) => {
          const parsed = jsonRpcRequestSchema.safeParse(req);
          if (!parsed.success) {
            return {
              jsonrpc: '2.0',
              id: req.id ?? null,
              error: {
                code: -32600,
                message: 'Invalid request',
              },
            };
          }
          return processRequest(parsed.data);
        })
      );

      if (useSSE) {
        return createSSEResponse(results);
      }
      return NextResponse.json(results);
    }

    // Handle single request
    const parsed = jsonRpcRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: body.id ?? null,
        error: {
          code: -32600,
          message: 'Invalid request',
        },
      };

      if (useSSE) {
        return createSSEResponse(errorResponse);
      }
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const result = await processRequest(parsed.data);

    if (useSSE) {
      const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return createSSEResponse(result, eventId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('MCP error:', error);
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
      },
    };

    if (wantsSSE(request)) {
      return createSSEResponse(errorResponse);
    }
    return NextResponse.json(errorResponse, { status: 400 });
  }
}
