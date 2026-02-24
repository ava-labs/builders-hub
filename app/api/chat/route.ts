import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { captureAIGeneration, captureServerEvent } from '@/lib/posthog-server';
import { searchCode, formatCodeContext } from '@/lib/code-search';
import { embedQuery, analyzeQueryIntent } from '@/lib/embeddings';
import { getAuthSession } from '@/lib/auth/authSession';
import {
  checkChatRateLimit,
  getClientIP,
  createRateLimitHeaders,
  formatResetTime,
} from '@/lib/chat/rateLimit';
import { searchTools, formatToolsForContext } from '@/lib/chat/tools-search';
import { docsTools, githubTools } from '@/lib/mcp/tools';
import { componentNames, getCatalogDescription } from '@/lib/chat/catalog';
import {
  blockchainLookupTransaction,
  blockchainLookupAddress,
  blockchainLookupSubnet,
  blockchainLookupChain,
  blockchainLookupValidator,
} from '@/lib/chat/blockchain-tools';

// Helper to extract text from v6 UIMessage
function getTextFromMessage(message: any): string {
  // Handle v6 parts format
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text || '')
      .join('');
  }
  // Handle legacy content format
  if (typeof message.content === 'string') {
    return message.content;
  }
  return '';
}

// Changed from 'edge' to 'nodejs' to support code search (zlib operations)
export const runtime = 'nodejs';
// Extend timeout for AI streaming + tool calls (default 10s is too short)
export const maxDuration = 60;

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cache for documentation content
let docsCache: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Cache for valid URLs
let validUrlsCache: string[] | null = null;
let urlsCacheTimestamp: number = 0;

async function getDocumentation(): Promise<string> {
  const now = Date.now();
  
  // Return cached docs if still valid
  if (docsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return docsCache;
  }
  
  try {
    // Build the URL more reliably for both local and production
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                   'http://localhost:3000';
    
    const url = new URL('/llms-full.txt', baseUrl);
    console.log(`Fetching documentation from: ${url.toString()}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch documentation: ${response.status} ${response.statusText}`);
    }
    
    docsCache = await response.text();
    cacheTimestamp = now;
    
    console.log(`Cached documentation: ${docsCache.length} characters`);
    return docsCache;
  } catch (error) {
    console.error('Error fetching documentation:', error);
    // Return empty string to avoid breaking the chat
    return '';
  }
}

async function getValidUrls(): Promise<string[]> {
  const now = Date.now();
  
  // Return cached URLs if still valid
  if (validUrlsCache && (now - urlsCacheTimestamp) < CACHE_DURATION) {
    return validUrlsCache;
  }
  
  try {
    // Build the URL more reliably for both local and production
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                   'http://localhost:3000';
    
    const url = new URL('/static.json', baseUrl);
    console.log(`Fetching valid URLs from: ${url.toString()}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URLs: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const urls = data.map((item: any) => item.url);
    validUrlsCache = urls;
    urlsCacheTimestamp = now;
    
    console.log(`Cached ${urls.length} valid URLs`);
    return urls;
  } catch (error) {
    console.error('Error fetching valid URLs:', error);
    return [];
  }
}

// Use MCP server for better search quality — calls the handler directly (no HTTP round-trip)
async function searchDocsViaMcp(query: string): Promise<Array<{ url: string; title: string; description?: string; source: string }>> {
  try {
    const toolResult = await docsTools.handlers.docs_search({ query, limit: 10 });
    const text = toolResult.content?.[0]?.text || '';

    const results: Array<{ url: string; title: string; description?: string; source: string }> = [];
    const lines = text.split('\n').filter((l: string) => l.startsWith('- ['));

    for (const line of lines) {
      const match = line.match(/- \[(.+?)\]\(https:\/\/build\.avax\.network(.+?)\) \((.+?)\)(?:\n\s+(.+))?/);
      if (match) {
        results.push({
          title: match[1],
          url: match[2],
          source: match[3],
          description: match[4]
        });
      }
    }

    console.log(`MCP search found ${results.length} results for "${query}"`);
    return results;
  } catch (error) {
    console.error('MCP search error:', error);
    return [];
  }
}

// Fetch specific pages from search results — calls the handler directly (no HTTP round-trip)
async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const toolResult = await docsTools.handlers.docs_fetch({ url });
    return toolResult.content?.[0]?.text || null;
  } catch (error) {
    console.error('Page fetch error:', error);
    return null;
  }
}

function findRelevantSections(query: string, docs: string): string[] {
  if (!docs || !query) return [];

  // Split documentation into individual page sections
  const sections = docs.split(/\n# /).filter(s => s.trim());

  // Normalize query for better matching
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

  // Score each section based on relevance
  const scoredSections = sections.map(section => {
    const sectionLower = section.toLowerCase();
    let score = 0;

    // Extract title (first line)
    const titleMatch = section.match(/^([^\n]+)/);
    const title = titleMatch ? titleMatch[1] : '';
    const titleLower = title.toLowerCase();

    // Score based on query terms appearing in title and content
    queryTerms.forEach(term => {
      if (titleLower.includes(term)) score += 20;
      if (sectionLower.includes(term)) score += 5;
    });

    // Bonus for exact phrase match
    if (sectionLower.includes(queryLower)) score += 30;

    return { section: `# ${section}`, score, title };
  });

  // Filter and sort by relevance
  const relevant = scoredSections
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // Top 8 most relevant sections

  console.log(`Found ${relevant.length} relevant sections for query: "${query}"`);
  if (relevant.length > 0) {
    console.log('Top 3 sections:', relevant.slice(0, 3).map(r => ({ title: r.title, score: r.score })));
  }

  return relevant.map(r => r.section);
}

export async function POST(req: Request) {
  const { messages, id: visitorId } = await req.json();
  const startTime = Date.now();
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Check rate limit based on authentication status
  const session = await getAuthSession();
  const isAuthenticated = !!session?.user?.id;
  const identifier = isAuthenticated ? session.user.id : getClientIP(req);

  const rateLimitResult = checkChatRateLimit(identifier, isAuthenticated);

  if (!rateLimitResult.allowed) {
    const resetTimeFormatted = formatResetTime(rateLimitResult.resetTime);
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: isAuthenticated
          ? `You've sent too many messages. Please try again ${resetTimeFormatted}.`
          : `Message limit reached. Please sign in for higher limits or try again ${resetTimeFormatted}.`,
        resetTime: rateLimitResult.resetTime.toISOString(),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...createRateLimitHeaders(rateLimitResult),
        },
      }
    );
  }

  // Get the last user message to search for relevant docs
  const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
  const lastUserMessageText = lastUserMessage ? getTextFromMessage(lastUserMessage) : '';

  // Get valid URLs for link validation
  const validUrls = await getValidUrls();

  // Code search for DeepWiki-style functionality
  let codeContext = '';
  if (lastUserMessageText) {
    const intent = analyzeQueryIntent(lastUserMessageText);
    console.log(`[CodeSearch] Intent analysis: isCodeQuestion=${intent.isCodeQuestion}, keywords=${intent.keywords.join(',')}`);

    if (intent.isCodeQuestion) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
                       process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                       'http://localhost:3000';
        console.log(`[CodeSearch] Using base URL: ${baseUrl}`);

        console.log(`[CodeSearch] Generating query embedding...`);
        const queryEmbedding = await embedQuery(lastUserMessageText);
        console.log(`[CodeSearch] Embedding generated, length: ${queryEmbedding.length}`);

        console.log(`[CodeSearch] Searching code...`);
        const codeResults = await searchCode(queryEmbedding, baseUrl, {
          topK: 5,
          repos: intent.suggestedRepos,
          minScore: 0.25, // Lowered from 0.35 - semantic search typically scores 0.2-0.6
        });
        console.log(`[CodeSearch] Search returned ${codeResults.length} results`);

        // Track code search results for analytics
        const avgScore = codeResults.length > 0
          ? codeResults.reduce((sum, r) => sum + r.score, 0) / codeResults.length
          : 0;
        captureServerEvent('ai_chat_code_search', {
          query: lastUserMessageText.slice(0, 200),
          results_count: codeResults.length,
          repos_searched: intent.suggestedRepos || ['all'],
          top_score: codeResults[0]?.score || 0,
          avg_score: avgScore,
          is_code_question: true,
          latency_ms: Date.now() - startTime,
        }, visitorId);

        if (codeResults.length > 0) {
          codeContext = '\n\n=== RELEVANT CODE FROM AVA-LABS REPOSITORIES ===\n\n';
          codeContext += '**IMPORTANT: When referencing this code, ALWAYS include the GitHub links provided below!**\n\n';
          codeContext += formatCodeContext(codeResults);
          codeContext += '\n\n=== END CODE CONTEXT ===\n';
          console.log(`[CodeSearch] ✅ Added ${codeResults.length} code chunks to context`);
          // Log the GitHub URLs being included
          codeResults.forEach((r, i) => console.log(`[CodeSearch]   ${i+1}. ${r.url}`));
        }
      } catch (error) {
        console.error('[CodeSearch] ❌ Failed:', error);
      }
    }
  }

  // Search for relevant YouTube videos from Avalanche channel
  let youtubeContext = '';
  if (lastUserMessageText) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
                     process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                     'http://localhost:3000';

      const youtubeResponse = await fetch(`${baseUrl}/api/youtube/search?q=${encodeURIComponent(lastUserMessageText)}&limit=3`);

      if (youtubeResponse.ok) {
        const youtubeData = await youtubeResponse.json();
        if (youtubeData.videos && youtubeData.videos.length > 0) {
          youtubeContext = '\n\n=== RELEVANT YOUTUBE VIDEOS ===\n\n';
          youtubeContext += 'IMPORTANT: To show these videos, call render_component("YouTubeEmbed", { videoId: "...", title: "..." }) to embed them inline. Do NOT just paste a YouTube link.\n\n';
          for (const video of youtubeData.videos) {
            youtubeContext += `- **${video.title}** → render_component("YouTubeEmbed", { videoId: "${video.videoId}", title: "${video.title.replace(/"/g, '\\"')}" })\n`;
            youtubeContext += `  Description: ${video.description.slice(0, 200)}...\n\n`;
          }
          youtubeContext += '=== END YOUTUBE VIDEOS ===\n';
          console.log(`Found ${youtubeData.videos.length} relevant YouTube videos`);

          // Track YouTube search results
          captureServerEvent('ai_chat_youtube_search', {
            query: lastUserMessageText.slice(0, 200),
            results_count: youtubeData.videos.length,
          }, visitorId);
        }
      }
    } catch (error) {
      console.error('YouTube search error:', error);
    }
  }

  // Search for relevant console tools
  let toolsContext = '';
  if (lastUserMessageText) {
    const relevantTools = searchTools(lastUserMessageText, 5);
    if (relevantTools.length > 0) {
      toolsContext = '\n\n=== RELEVANT CONSOLE TOOLS ===\n\n';
      toolsContext += 'IMPORTANT: For tools marked "RENDER INLINE", you MUST call the render_component tool to show the interactive UI directly in the chat. Do NOT just provide a link — render the component so the user can interact with it immediately.\n\n';
      toolsContext += formatToolsForContext(relevantTools);
      toolsContext += '\n\n=== END CONSOLE TOOLS ===\n';
      console.log(`Found ${relevantTools.length} relevant console tools`);

      // Track console tools search results
      captureServerEvent('ai_chat_tools_search', {
        query: lastUserMessageText.slice(0, 200),
        results_count: relevantTools.length,
        tool_names: relevantTools.map(t => t.title),
      }, visitorId);
    }
  }

  let relevantContext = '';
  let docSearchMethod: 'mcp' | 'fulltext' | 'none' = 'none';
  if (lastUserMessage && lastUserMessageText) {
    // Try MCP search first (better quality), fall back to full-text search
    const mcpSearchStart = Date.now();
    const mcpResults = await searchDocsViaMcp(lastUserMessageText);

    if (mcpResults.length > 0) {
      docSearchMethod = 'mcp';
      // Fetch content for top 3 results
      const contentPromises = mcpResults.slice(0, 3).map(async (result) => {
        const content = await fetchPageContent(result.url);
        return content ? `# ${result.title}\nURL: https://build.avax.network${result.url}\nSource: ${result.source}\n\n${content}` : null;
      });

      const contents = (await Promise.all(contentPromises)).filter(Boolean);

      if (contents.length > 0) {
        relevantContext = '\n\n=== RELEVANT DOCUMENTATION ===\n\n';
        relevantContext += 'Here are the most relevant pages from the Avalanche documentation:\n\n';
        relevantContext += contents.join('\n\n---\n\n');
        relevantContext += '\n\n=== END DOCUMENTATION ===\n';
        const imgCount = (relevantContext.match(/!\[/g) || []).length;
        console.log(`Using MCP search results: ${contents.length} pages, ${imgCount} images found`);
      }
    }

    // Fall back to full-text search if MCP didn't return results
    if (!relevantContext) {
      docSearchMethod = 'fulltext';
      const docs = await getDocumentation();
      const relevantSections = findRelevantSections(lastUserMessageText, docs);

      if (relevantSections.length > 0) {
        relevantContext = '\n\n=== RELEVANT DOCUMENTATION ===\n\n';
        relevantContext += 'Here are the most relevant sections from the Avalanche documentation:\n\n';
        relevantContext += relevantSections.join('\n\n---\n\n');
        relevantContext += '\n\n=== END DOCUMENTATION ===\n';
        console.log(`Using fallback full-text search: ${relevantSections.length} sections`);
      } else {
        docSearchMethod = 'none';
        relevantContext = '\n\n=== DOCUMENTATION ===\n';
        relevantContext += 'No specific documentation sections matched this query.\n';
        relevantContext += 'Provide general guidance and suggest relevant documentation sections if applicable.\n';
        relevantContext += '=== END DOCUMENTATION ===\n';
      }
    }

    // Track documentation search for analytics
    captureServerEvent('ai_chat_docs_search', {
      query: lastUserMessageText.slice(0, 200),
      search_method: docSearchMethod,
      results_count: docSearchMethod === 'mcp' ? mcpResults.length :
                     docSearchMethod === 'fulltext' ? relevantContext.split('---').length : 0,
      latency_ms: Date.now() - mcpSearchStart,
    }, visitorId);
  }
  
  // Add valid URLs list
  const validUrlsList = validUrls.length > 0 
    ? `\n\n=== VALID DOCUMENTATION URLS ===\nThese are ALL the valid URLs on the site. ONLY use URLs from this list:\n${validUrls.map(url => `https://build.avax.network${url}`).join('\n')}\n=== END VALID URLS ===\n`
    : '';

  // Extract images from documentation context so the AI can embed them
  const imageMatches = relevantContext.match(/!\[[^\]]*\]\([^)]+\)/g) || [];
  // Format extracted images as render_component hints
  const uniqueImages = [...new Set(imageMatches)].slice(0, 6);
  const imagesContext = uniqueImages.length > 0
    ? `\n\n=== EMBEDDABLE IMAGES ===\nThese images are from the docs above. Show them with render_component("DocImage", { src, alt }):\n${uniqueImages.map(img => {
        const match = img.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        return match ? `- render_component("DocImage", { src: "${match[2]}", alt: "${match[1]}" })` : '';
      }).filter(Boolean).join('\n')}\n=== END IMAGES ===\n`
    : '';

  // Build the full input for analytics
  const userInput = lastUserMessageText;

  // Convert UI messages to model messages format
  // Handle both v6 (parts) and legacy (content) formats
  const modelMessages = messages.map((m: any) => {
    const text = getTextFromMessage(m);
    return {
      role: m.role,
      content: text,
    };
  });

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    messages: modelMessages,
    onFinish: async ({ text, usage }) => {
      // Capture LLM generation event to PostHog
      const latencyMs = Date.now() - startTime;
      await captureAIGeneration({
        distinctId: visitorId,
        model: 'claude-sonnet-4-6',
        input: userInput,
        output: text,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        latencyMs,
        traceId,
      });
    },
    onStepFinish: async (step) => {
      // Track tool usage for analytics
      // In AI SDK v6, step contains toolCalls and toolResults arrays
      const toolCalls = (step as any).toolCalls;
      const toolResults = (step as any).toolResults;

      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          const toolResult = toolResults?.find((r: any) => r.toolCallId === toolCall.toolCallId);
          const resultStr = toolResult?.result ? String(toolResult.result) : '';
          const success = !resultStr.toLowerCase().includes('error');

          captureServerEvent('ai_chat_tool_used', {
            tool_name: toolCall.toolName,
            tool_args: JSON.stringify(toolCall.args || {}).slice(0, 500),
            success,
            has_result: !!toolResult,
          }, visitorId);
        }
      }
    },
    tools: {
      github_search_code: tool({
        description: 'Search for code in Avalanche repositories (avalanchego, icm-services, builders-hub). Use this to find functions, types, implementations, or understand how Avalanche works internally. Returns file paths and code snippets.',
        inputSchema: z.object({
          query: z.string().describe('Search query - keywords, function names, type names, or concepts'),
          repo: z.enum(['avalanchego', 'icm-services', 'builders-hub', 'all']).default('all').describe('Which repository to search'),
          language: z.enum(['go', 'solidity', 'typescript', 'any']).default('any').describe('Filter by programming language'),
        }),
        execute: async (input) => {
          const { query, repo, language } = input;
          try {
            const toolResult = await githubTools.handlers.github_search_code({ query, repo, language, perPage: 10 });
            const text = toolResult.content?.[0]?.text;
            return text ? JSON.parse(text) : { error: 'No result' };
          } catch (error) {
            return { error: 'Failed to search GitHub', details: String(error) };
          }
        },
      }),

      github_get_file: tool({
        description: 'Read the contents of a specific file from avalanchego, icm-services, or builders-hub. Use this after searching to read the full code of a relevant file.',
        inputSchema: z.object({
          repo: z.enum(['avalanchego', 'icm-services', 'builders-hub']).describe('Repository name'),
          path: z.string().describe('File path within the repository (e.g., "vms/platformvm/block/builder.go")'),
        }),
        execute: async (input) => {
          const { repo, path } = input;
          try {
            const toolResult = await githubTools.handlers.github_get_file({ repo, path, owner: 'ava-labs' });
            const text = toolResult.content?.[0]?.text;
            if (!text) return { error: 'No result' };
            const data = JSON.parse(text);
            if (data?.content && data.content.length > 15000) {
              const content = data.content;
              return {
                ...data,
                content: content.slice(0, 10000) + '\n\n... [truncated] ...\n\n' + content.slice(-5000),
                truncated: true,
              };
            }
            return data;
          } catch (error) {
            return { error: 'Failed to fetch file', details: String(error) };
          }
        },
      }),

      blockchain_lookup_transaction: blockchainLookupTransaction,
      blockchain_lookup_address: blockchainLookupAddress,
      blockchain_lookup_subnet: blockchainLookupSubnet,
      blockchain_lookup_chain: blockchainLookupChain,
      blockchain_lookup_validator: blockchainLookupValidator,

      render_component: tool({
        description: `Render an interactive UI component inline in the chat. Use this for console tools, metrics, and YouTube videos instead of linking. Components:\n${getCatalogDescription()}`,
        inputSchema: z.object({
          component: z.enum(componentNames).describe('The component to render'),
          props: z.record(z.string(), z.any()).optional().default({}).describe('Props to pass to the component'),
        }),
        execute: async ({ component, props }) => {
          return { component, props, rendered: true };
        },
      }),

      suggest_followups: tool({
        description: 'Suggest 2-3 natural follow-up questions the user might ask next. Call this AFTER answering every question. Questions should be specific to what was just discussed.',
        inputSchema: z.object({
          questions: z.array(z.string().describe('A short follow-up question (under 60 chars)')).min(2).max(3),
        }),
        execute: async ({ questions }) => ({ questions }),
      }),

      metrics_lookup: tool({
        description: 'Look up real-time Avalanche network metrics: active addresses, transactions, TPS, validators, ICM messages, market cap. Call this before answering any metrics/stats question, then also render_component("OverviewStats") to show visually.',
        inputSchema: z.object({
          timeRange: z.enum(['day', 'week', 'month']).default('day'),
        }),
        execute: async ({ timeRange }) => {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
                           (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
            const res = await fetch(`${baseUrl}/api/overview-stats?timeRange=${timeRange}`, {
              headers: { 'Cache-Control': 'no-cache' },
            });
            if (!res.ok) return { error: `Failed to fetch metrics: ${res.status}` };
            const data = await res.json();
            const { aggregated, chains } = data;
            const topChains = chains
              .filter((c: any) => c.activeAddresses > 0)
              .sort((a: any, b: any) => b.activeAddresses - a.activeAddresses)
              .slice(0, 10);
            return {
              summary: {
                totalActiveAddresses: aggregated.totalActiveAddresses,
                totalTransactions: aggregated.totalTxCount,
                averageTPS: aggregated.totalTps,
                totalValidators: aggregated.totalValidators,
                totalICMMessages: aggregated.totalICMMessages,
                totalMarketCap: aggregated.totalMarketCap,
                activeChains: aggregated.activeChains,
                timeRange,
              },
              topChainsByActiveAddresses: topChains.map((c: any) => ({
                name: c.chainName,
                chainId: c.chainId,
                activeAddresses: c.activeAddresses,
                transactions: c.txCount,
                tps: c.tps,
                validators: c.validatorCount,
              })),
            };
          } catch (err) {
            return { error: `Metrics lookup failed: ${(err as Error).message}` };
          }
        },
      }),
    },
    stopWhen: stepCountIs(8),
    system: `You are the AI assistant for Avalanche Builders Hub (build.avax.network). You help developers build on Avalanche — answer questions, look up on-chain data, render interactive tools, and cite documentation. Be concise and helpful — code over prose, cite docs.

## Tools & Rendering
- **render_component**: For ANY hands-on task (create L1, faucet, staking, bridging, fees, minting, ICM, ICTT, etc.), call \`render_component\` to embed the interactive UI inline. Never just link to console tools — render them.
- **metrics_lookup**: For stats questions (active accounts, TPS, validators, etc.), call \`metrics_lookup\` first to get numbers, then \`render_component("OverviewStats")\` to show visually. For burns → \`render_component("LiveBlockBurns")\`, ICM traffic → \`render_component("ICMFlowDiagram")\`, ICTT → \`render_component("ICTTDashboard")\`.
- **YouTube**: Embed with \`render_component("YouTubeEmbed", { videoId, title })\`. Never paste bare YouTube links.
- **blockchain_lookup_***: For tx hashes, addresses, validators, subnets, chains. Follow up on \`_lookupHints\` in results.
- **github_search_code / github_get_file**: Search avalanchego, icm-services, builders-hub. Check pre-indexed code context below first.
- **suggest_followups**: ALWAYS call this after answering. Suggest 2-3 relevant follow-up questions specific to the conversation.
- **DocImage**: When documentation context contains images like \`![alt](/images/...)\`, call \`render_component("DocImage", { src: "/images/...", alt: "..." })\` to show them inline. Diagrams and screenshots help developers understand faster.

## URL Rules
- Documentation: \`/docs/...\` | Academy: \`/academy/...\` (NEVER \`/docs/academy/\`) | Console: \`/console/...\`
- Use EXACT complete URLs from context. Truncated paths cause 404s.
- Always use full path including final segment (e.g., \`.../04-creating-an-l1/01-creating-an-l1\` not just \`.../04-creating-an-l1\`)

## Pre-indexed Context
When code context is provided below, use it directly with GitHub links. Only search GitHub if context is insufficient.

${toolsContext}

${youtubeContext}

${relevantContext}

${imagesContext}

${codeContext}

${validUrlsList}`,
  });

  return result.toUIMessageStreamResponse();
}
