import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { captureAIGeneration, captureServerEvent } from '@/lib/posthog-server';
import { searchCode, formatCodeContext, type SearchResult } from '@/lib/code-search';
import { embedQuery, analyzeQueryIntent } from '@/lib/embeddings';
import { getAuthSession } from '@/lib/auth/authSession';
import {
  checkChatRateLimit,
  getClientIP,
  createRateLimitHeaders,
  formatResetTime,
} from '@/lib/chat/rateLimit';
import { searchTools, getToolsContextForPrompt, formatToolsForContext } from '@/lib/chat/tools-search';

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

// Use MCP server for better search quality
async function searchDocsViaMcp(query: string): Promise<Array<{ url: string; title: string; description?: string; source: string }>> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                   'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'avalanche_docs_search',
          arguments: { query, limit: 10 }
        }
      })
    });

    if (!response.ok) {
      console.error('MCP search failed:', response.status);
      return [];
    }

    const result = await response.json();
    if (result.error) {
      console.error('MCP search error:', result.error);
      return [];
    }

    // Parse the text response from MCP
    const text = result.result?.content?.[0]?.text || '';

    // Extract results from the formatted text
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

// Fetch specific pages from search results
async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                   'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'avalanche_docs_fetch',
          arguments: { url }
        }
      })
    });

    if (!response.ok) return null;

    const result = await response.json();
    if (result.error) return null;

    return result.result?.content?.[0]?.text || null;
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

// Helper to parse P-Chain transaction types and extract meaningful info
function parsePChainTransaction(rawTx: any): {
  type: string;
  description: string;
  details: Record<string, any>;
} {
  // The transaction structure varies - check multiple possible locations
  const tx = rawTx.tx || rawTx.unsignedTx || rawTx;

  // Type ID mapping for P-Chain transactions
  const typeIdMap: Record<number, { type: string; description: string }> = {
    0: { type: 'CreateChainTx', description: 'Creates a new blockchain' },
    12: { type: 'AddValidatorTx', description: 'Adds a validator to the Primary Network' },
    13: { type: 'AddSubnetValidatorTx', description: 'Adds a validator to a Subnet' },
    14: { type: 'AddDelegatorTx', description: 'Delegates stake to a validator' },
    15: { type: 'CreateSubnetTx', description: 'Creates a new Subnet' },
    16: { type: 'ImportTx', description: 'Imports AVAX from another chain' },
    17: { type: 'ExportTx', description: 'Exports AVAX to another chain' },
    18: { type: 'AdvanceTimeTx', description: 'Advances the chain timestamp' },
    19: { type: 'RewardValidatorTx', description: 'Rewards a validator' },
    20: { type: 'RemoveSubnetValidatorTx', description: 'Removes a validator from a Subnet' },
    21: { type: 'TransformSubnetTx', description: 'Transforms a Subnet to a permissionless L1' },
    22: { type: 'AddPermissionlessValidatorTx', description: 'Adds a permissionless validator' },
    23: { type: 'AddPermissionlessDelegatorTx', description: 'Adds a permissionless delegator' },
    24: { type: 'TransferSubnetOwnershipTx', description: 'Transfers Subnet ownership' },
    25: { type: 'BaseTx', description: 'Base transaction (AVAX transfer on P-Chain)' },
    33: { type: 'ConvertSubnetTx', description: 'Converts a Subnet to a Sovereign L1' },
  };

  // Try to find the type ID
  let typeId: number | undefined;
  let details: Record<string, any> = {};

  // Check for typeID in various locations
  if (typeof tx.typeID === 'number') {
    typeId = tx.typeID;
  } else if (tx.unsignedTx && typeof tx.unsignedTx.typeID === 'number') {
    typeId = tx.unsignedTx.typeID;
  }

  // Extract common fields - check multiple nested paths
  const unsignedTx = tx.unsignedTx || {};

  // Node ID (for validator operations)
  const nodeID = tx.nodeID || unsignedTx.nodeID;
  if (nodeID) {
    details.nodeID = nodeID;
    details._lookupHints = details._lookupHints || [];
    details._lookupHints.push({ type: 'validator', id: nodeID });
  }

  // Subnet ID
  const subnetID = tx.subnetID || unsignedTx.subnetID;
  if (subnetID) {
    details.subnetID = subnetID;
    details._lookupHints = details._lookupHints || [];
    details._lookupHints.push({ type: 'subnet', id: subnetID });
  }

  // Blockchain/Chain ID (for CreateChainTx and other chain operations)
  const chainID = tx.chainID || unsignedTx.chainID || tx.blockchainID || unsignedTx.blockchainID;
  if (chainID) {
    details.chainID = chainID;
    details._lookupHints = details._lookupHints || [];
    details._lookupHints.push({ type: 'chain', id: chainID });
  }

  // Genesis data (for CreateChainTx)
  if (tx.genesisData || unsignedTx.genesisData) {
    details.hasGenesisData = true;
  }

  // Validator BLS key info (for permissionless validators)
  if (tx.signer || unsignedTx.signer) {
    const signer = tx.signer || unsignedTx.signer;
    if (signer.publicKey) {
      details.blsPublicKey = signer.publicKey;
    }
  }

  // Delegation fee (for validators)
  const delegationFee = tx.delegationFee || unsignedTx.delegationFee || tx.shares || unsignedTx.shares;
  if (delegationFee) {
    // Delegation fee is in basis points (10000 = 100%)
    const feePercent = (parseInt(delegationFee) / 10000 * 100).toFixed(2);
    details.delegationFee = `${feePercent}%`;
  }

  // Start/End times
  const startTime = tx.startTime || unsignedTx.startTime;
  if (startTime) {
    details.startTime = new Date(parseInt(startTime) * 1000).toISOString();
  }
  const endTime = tx.endTime || unsignedTx.endTime;
  if (endTime) {
    details.endTime = new Date(parseInt(endTime) * 1000).toISOString();
  }

  // Weight (for validators)
  const weight = tx.weight || unsignedTx.weight;
  if (weight) {
    details.weight = (parseInt(weight) / 1e9).toFixed(4) + ' AVAX';
  }

  // Stake amounts
  const stakeOutputs = tx.stake || unsignedTx.stake || [];
  if (stakeOutputs.length > 0) {
    let totalStake = 0;
    for (const output of stakeOutputs) {
      if (output.output?.amount) {
        totalStake += parseInt(output.output.amount);
      }
    }
    if (totalStake > 0) {
      details.stakeAmount = (totalStake / 1e9).toFixed(4) + ' AVAX';
    }
  }

  // Chain name (for CreateChainTx)
  const chainName = tx.chainName || unsignedTx.chainName;
  if (chainName) {
    details.chainName = chainName;
  }

  // VM ID (for CreateChainTx)
  const vmID = tx.vmID || unsignedTx.vmID;
  if (vmID) {
    details.vmID = vmID;
    // Map common VM IDs to names
    const vmNames: Record<string, string> = {
      'jvYyfQTxGMJLuGWa55kdP2p2zSUYsQ5Raupu4TW34ZAUBAbtq': 'AvalancheVM (EVM)',
      'mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6': 'Timestamp VM',
      'tGas3T58KzdjLHhBDMnH2TvrddhqTji5iZAMZ3RXs2NLpSnhH': 'Subnet EVM',
      'srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy': 'Coreth (C-Chain)',
    };
    if (vmNames[vmID]) {
      details.vmName = vmNames[vmID];
    }
  }

  // Fee asset ID
  const feeAssetID = tx.fxIDs || unsignedTx.fxIDs;
  if (feeAssetID && Array.isArray(feeAssetID) && feeAssetID.length > 0) {
    details.fxIDs = feeAssetID;
  }

  // Rewards owner (who receives staking rewards)
  const rewardsOwner = tx.rewardsOwner || unsignedTx.rewardsOwner;
  if (rewardsOwner?.addresses && rewardsOwner.addresses.length > 0) {
    details.rewardsAddresses = rewardsOwner.addresses;
  }

  if (typeId !== undefined && typeIdMap[typeId]) {
    return {
      type: typeIdMap[typeId].type,
      description: typeIdMap[typeId].description,
      details,
    };
  }

  // Fallback: infer type from structure when typeID isn't available
  // CreateChainTx - has chainName, vmID, genesisData
  if (chainName && vmID) {
    return {
      type: 'CreateChainTx',
      description: 'Creates a new blockchain on a Subnet',
      details,
    };
  }

  // CreateSubnetTx - has just subnetID without other identifying fields
  if (subnetID && !nodeID && !chainName) {
    return {
      type: 'CreateSubnetTx',
      description: 'Creates a new Subnet',
      details,
    };
  }

  // Validator transactions - have nodeID
  if (nodeID) {
    const stakeOutputs = tx.stake || unsignedTx.stake || [];
    if (stakeOutputs.length > 0) {
      return {
        type: 'AddValidatorTx',
        description: 'Adds a validator to the network',
        details,
      };
    }
    if (subnetID && subnetID !== '11111111111111111111111111111111LpoYY') {
      return {
        type: 'AddSubnetValidatorTx',
        description: 'Adds a validator to a Subnet',
        details,
      };
    }
    return {
      type: 'ValidatorTx',
      description: 'Validator-related transaction',
      details,
    };
  }

  // Import/Export - have sourceChain or destinationChain
  if (tx.sourceChain || unsignedTx.sourceChain) {
    details.sourceChain = tx.sourceChain || unsignedTx.sourceChain;
    return {
      type: 'ImportTx',
      description: 'Imports AVAX from another chain',
      details,
    };
  }
  if (tx.destinationChain || unsignedTx.destinationChain) {
    details.destinationChain = tx.destinationChain || unsignedTx.destinationChain;
    return {
      type: 'ExportTx',
      description: 'Exports AVAX to another chain',
      details,
    };
  }

  return {
    type: 'PlatformTx',
    description: 'Platform transaction',
    details,
  };
}

// Helper to parse X-Chain transaction types
function parseXChainTransaction(rawTx: any): {
  type: string;
  description: string;
  details: Record<string, any>;
} {
  const tx = rawTx.tx || rawTx.unsignedTx || rawTx;
  const details: Record<string, any> = {};

  // X-Chain transaction type IDs
  const typeIdMap: Record<number, { type: string; description: string }> = {
    0: { type: 'BaseTx', description: 'Basic AVAX/asset transfer' },
    1: { type: 'CreateAssetTx', description: 'Creates a new asset' },
    2: { type: 'OperationTx', description: 'NFT/asset operation' },
    3: { type: 'ImportTx', description: 'Imports assets from another chain' },
    4: { type: 'ExportTx', description: 'Exports assets to another chain' },
  };

  let typeId: number | undefined;
  if (typeof tx.typeID === 'number') {
    typeId = tx.typeID;
  } else if (tx.unsignedTx && typeof tx.unsignedTx.typeID === 'number') {
    typeId = tx.unsignedTx.typeID;
  }

  // Extract asset info
  if (tx.assetID || tx.unsignedTx?.assetID) {
    details.assetID = tx.assetID || tx.unsignedTx?.assetID;
  }
  if (tx.name || tx.unsignedTx?.name) {
    details.assetName = tx.name || tx.unsignedTx?.name;
  }
  if (tx.symbol || tx.unsignedTx?.symbol) {
    details.assetSymbol = tx.symbol || tx.unsignedTx?.symbol;
  }

  // Extract transfer amounts
  if (tx.outputs || tx.unsignedTx?.outputs) {
    const outputs = tx.outputs || tx.unsignedTx?.outputs || [];
    let totalAmount = 0;
    for (const output of outputs) {
      if (output.output?.amount) {
        totalAmount += parseInt(output.output.amount);
      } else if (output.amount) {
        totalAmount += parseInt(output.amount);
      }
    }
    if (totalAmount > 0) {
      details.totalAmount = (totalAmount / 1e9).toFixed(4) + ' AVAX';
    }
  }

  if (typeId !== undefined && typeIdMap[typeId]) {
    return {
      type: typeIdMap[typeId].type,
      description: typeIdMap[typeId].description,
      details,
    };
  }

  return {
    type: 'AssetTx',
    description: 'X-Chain asset transaction',
    details,
  };
}

export async function POST(req: Request) {
  // Read thinking mode header (defaults to false = quick mode)
  const thinkingMode = req.headers.get('X-Thinking-Mode') === 'true';

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
          youtubeContext += 'Here are relevant videos from the Avalanche YouTube channel that you should recommend:\n\n';
          for (const video of youtubeData.videos) {
            youtubeContext += `- [${video.title}](https://www.youtube.com/watch?v=${video.videoId})\n`;
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
      toolsContext += 'Here are the most relevant interactive tools for this query - PRIORITIZE recommending these:\n\n';
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
        console.log(`Using MCP search results: ${contents.length} pages`);
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
    model: anthropic('claude-sonnet-4-20250514'),
    messages: modelMessages,
    onFinish: async ({ text, usage }) => {
      // Capture LLM generation event to PostHog
      const latencyMs = Date.now() - startTime;
      await captureAIGeneration({
        distinctId: visitorId,
        model: 'claude-sonnet-4-20250514',
        input: userInput,
        output: text,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        latencyMs,
        traceId,
        thinkingMode, // Track response mode
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
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
                           process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                           'http://localhost:3000';

            const response = await fetch(`${baseUrl}/api/mcp/github`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tool: 'search_code',
                params: { query, repo, language, perPage: 10 }
              })
            });

            if (!response.ok) {
              return { error: 'GitHub search failed', status: response.status };
            }

            const result = await response.json();
            return result.data || result;
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
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
                           process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                           'http://localhost:3000';

            const response = await fetch(`${baseUrl}/api/mcp/github`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tool: 'get_file_contents',
                params: { owner: 'ava-labs', repo, path }
              })
            });

            if (!response.ok) {
              return { error: 'Failed to fetch file', status: response.status };
            }

            const result = await response.json();
            if (result.data?.content && result.data.content.length > 15000) {
              // Truncate very large files but keep first and last parts
              const content = result.data.content;
              return {
                ...result.data,
                content: content.slice(0, 10000) + '\n\n... [truncated] ...\n\n' + content.slice(-5000),
                truncated: true,
              };
            }
            return result.data || result;
          } catch (error) {
            return { error: 'Failed to fetch file', details: String(error) };
          }
        },
      }),

      blockchain_lookup_transaction: tool({
        description: 'Look up a transaction by its hash on Avalanche (C-Chain, P-Chain, or X-Chain). Use this when users paste a transaction hash and ask what it is. Supports both 0x format (C-Chain) and base58 format (P-Chain/X-Chain).',
        inputSchema: z.object({
          txHash: z.string().describe('The transaction hash (0x format for C-Chain, or base58 for P/X-Chain)'),
          network: z.enum(['mainnet', 'fuji']).default('mainnet').describe('Network to search'),
        }),
        execute: async (input) => {
          const { txHash, network } = input;
          const isTestnet = network === 'fuji';
          const baseRpcUrl = isTestnet ? 'https://api.avax-test.network' : 'https://api.avax.network';

          try {
            // Detect chain type from hash format
            const isEVMHash = txHash.startsWith('0x') && txHash.length === 66;

            // Try C-Chain first if it looks like an EVM hash
            if (isEVMHash) {
              const cChainRpc = `${baseRpcUrl}/ext/bc/C/rpc`;
              const rpcResponse = await fetch(cChainRpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'eth_getTransactionByHash',
                  params: [txHash]
                })
              });

              if (rpcResponse.ok) {
                const rpcResult = await rpcResponse.json();
                if (rpcResult.result) {
                  const tx = rpcResult.result;
                  const receiptResponse = await fetch(cChainRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jsonrpc: '2.0',
                      id: 1,
                      method: 'eth_getTransactionReceipt',
                      params: [txHash]
                    })
                  });
                  const receiptResult = await receiptResponse.json();
                  const receipt = receiptResult.result;

                  return {
                    found: true,
                    chain: 'C-Chain',
                    transaction: {
                      hash: tx.hash,
                      from: tx.from,
                      to: tx.to,
                      value: tx.value ? (parseInt(tx.value, 16) / 1e18).toFixed(6) + ' AVAX' : '0 AVAX',
                      blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : 'pending',
                      status: receipt?.status === '0x1' ? 'success' : receipt?.status === '0x0' ? 'failed' : 'pending',
                      gasUsed: receipt?.gasUsed ? parseInt(receipt.gasUsed, 16).toString() : 'unknown',
                    },
                    network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
                    explorerUrl: isTestnet
                      ? `https://testnet.snowtrace.io/tx/${txHash}`
                      : `https://snowtrace.io/tx/${txHash}`,
                  };
                }
              }

              // Try the other network for C-Chain
              const altBaseUrl = isTestnet ? 'https://api.avax.network' : 'https://api.avax-test.network';
              const altCChainRpc = `${altBaseUrl}/ext/bc/C/rpc`;
              const altResponse = await fetch(altCChainRpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'eth_getTransactionByHash',
                  params: [txHash]
                })
              });

              if (altResponse.ok) {
                const altResult = await altResponse.json();
                if (altResult.result) {
                  const tx = altResult.result;
                  const receiptResponse = await fetch(altCChainRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jsonrpc: '2.0',
                      id: 1,
                      method: 'eth_getTransactionReceipt',
                      params: [txHash]
                    })
                  });
                  const receiptResult = await receiptResponse.json();
                  const receipt = receiptResult.result;
                  const foundOnTestnet = !isTestnet;

                  return {
                    found: true,
                    chain: 'C-Chain',
                    transaction: {
                      hash: tx.hash,
                      from: tx.from,
                      to: tx.to,
                      value: tx.value ? (parseInt(tx.value, 16) / 1e18).toFixed(6) + ' AVAX' : '0 AVAX',
                      blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : 'pending',
                      status: receipt?.status === '0x1' ? 'success' : receipt?.status === '0x0' ? 'failed' : 'pending',
                      gasUsed: receipt?.gasUsed ? parseInt(receipt.gasUsed, 16).toString() : 'unknown',
                    },
                    network: foundOnTestnet ? 'Fuji Testnet' : 'Mainnet',
                    note: `Found on ${foundOnTestnet ? 'Fuji Testnet' : 'Mainnet'} (different from requested)`,
                    explorerUrl: foundOnTestnet
                      ? `https://testnet.snowtrace.io/tx/${txHash}`
                      : `https://snowtrace.io/tx/${txHash}`,
                  };
                }
              }
            }

            // Try P-Chain
            const pChainRpc = `${baseRpcUrl}/ext/bc/P`;
            const pChainResponse = await fetch(pChainRpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'platform.getTx',
                params: { txID: txHash, encoding: 'json' }
              })
            });

            if (pChainResponse.ok) {
              const pResult = await pChainResponse.json();
              if (pResult.result && !pResult.error) {
                const rawTx = pResult.result.tx || pResult.result;
                const parsed = parsePChainTransaction(rawTx);

                // Also get transaction status
                let txStatus = 'Unknown';
                try {
                  const statusResponse = await fetch(pChainRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jsonrpc: '2.0',
                      id: 1,
                      method: 'platform.getTxStatus',
                      params: { txID: txHash }
                    })
                  });
                  if (statusResponse.ok) {
                    const statusResult = await statusResponse.json();
                    if (statusResult.result?.status) {
                      txStatus = statusResult.result.status;
                    } else if (typeof statusResult.result === 'string') {
                      txStatus = statusResult.result;
                    }
                  }
                } catch {
                  // Status fetch failed, continue with Unknown
                }

                return {
                  found: true,
                  chain: 'P-Chain',
                  transaction: {
                    txID: txHash,
                    type: parsed.type,
                    typeDescription: parsed.description,
                    status: txStatus,
                    ...parsed.details,
                  },
                  network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
                  explorerUrl: `https://subnets${isTestnet ? '-test' : ''}.avax.network/p-chain/tx/${txHash}`,
                  note: 'P-Chain transactions include validator operations, delegations, subnet creation, and L1 management',
                };
              }
            }

            // Try X-Chain
            const xChainRpc = `${baseRpcUrl}/ext/bc/X`;
            const xChainResponse = await fetch(xChainRpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'avm.getTx',
                params: { txID: txHash, encoding: 'json' }
              })
            });

            if (xChainResponse.ok) {
              const xResult = await xChainResponse.json();
              if (xResult.result && !xResult.error) {
                const rawTx = xResult.result;
                const parsed = parseXChainTransaction(rawTx);

                // Get X-Chain transaction status
                let txStatus = 'Unknown';
                try {
                  const statusResponse = await fetch(xChainRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jsonrpc: '2.0',
                      id: 1,
                      method: 'avm.getTxStatus',
                      params: { txID: txHash }
                    })
                  });
                  if (statusResponse.ok) {
                    const statusResult = await statusResponse.json();
                    if (statusResult.result?.status) {
                      txStatus = statusResult.result.status;
                    } else if (typeof statusResult.result === 'string') {
                      txStatus = statusResult.result;
                    }
                  }
                } catch {
                  // Status fetch failed
                }

                return {
                  found: true,
                  chain: 'X-Chain',
                  transaction: {
                    txID: txHash,
                    type: parsed.type,
                    typeDescription: parsed.description,
                    status: txStatus,
                    ...parsed.details,
                  },
                  network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
                  explorerUrl: `https://subnets${isTestnet ? '-test' : ''}.avax.network/x-chain/tx/${txHash}`,
                  note: 'X-Chain transactions are for asset creation and transfers',
                };
              }
            }

            // Try the other network for P/X-Chain if not found
            const altBaseUrl2 = isTestnet ? 'https://api.avax.network' : 'https://api.avax-test.network';
            const foundOnOtherNet = !isTestnet;

            // Alt P-Chain
            const altPChainRpc = `${altBaseUrl2}/ext/bc/P`;
            const altPResponse = await fetch(altPChainRpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'platform.getTx',
                params: { txID: txHash, encoding: 'json' }
              })
            });

            if (altPResponse.ok) {
              const altPResult = await altPResponse.json();
              if (altPResult.result && !altPResult.error) {
                const rawTx = altPResult.result.tx || altPResult.result;
                const parsed = parsePChainTransaction(rawTx);

                // Also get transaction status
                let txStatus = 'Unknown';
                try {
                  const statusResponse = await fetch(altPChainRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jsonrpc: '2.0',
                      id: 1,
                      method: 'platform.getTxStatus',
                      params: { txID: txHash }
                    })
                  });
                  if (statusResponse.ok) {
                    const statusResult = await statusResponse.json();
                    if (statusResult.result?.status) {
                      txStatus = statusResult.result.status;
                    } else if (typeof statusResult.result === 'string') {
                      txStatus = statusResult.result;
                    }
                  }
                } catch {
                  // Status fetch failed
                }

                return {
                  found: true,
                  chain: 'P-Chain',
                  transaction: {
                    txID: txHash,
                    type: parsed.type,
                    typeDescription: parsed.description,
                    status: txStatus,
                    ...parsed.details,
                  },
                  network: foundOnOtherNet ? 'Mainnet' : 'Fuji Testnet',
                  note: `Found on ${foundOnOtherNet ? 'Mainnet' : 'Fuji Testnet'} (different from requested)`,
                  explorerUrl: `https://subnets${foundOnOtherNet ? '' : '-test'}.avax.network/p-chain/tx/${txHash}`,
                };
              }
            }

            // Alt X-Chain
            const altXChainRpc = `${altBaseUrl2}/ext/bc/X`;
            const altXResponse = await fetch(altXChainRpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'avm.getTx',
                params: { txID: txHash, encoding: 'json' }
              })
            });

            if (altXResponse.ok) {
              const altXResult = await altXResponse.json();
              if (altXResult.result && !altXResult.error) {
                const rawTx = altXResult.result;
                const parsed = parseXChainTransaction(rawTx);

                // Get X-Chain transaction status
                let txStatus = 'Unknown';
                try {
                  const statusResponse = await fetch(altXChainRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jsonrpc: '2.0',
                      id: 1,
                      method: 'avm.getTxStatus',
                      params: { txID: txHash }
                    })
                  });
                  if (statusResponse.ok) {
                    const statusResult = await statusResponse.json();
                    if (statusResult.result?.status) {
                      txStatus = statusResult.result.status;
                    } else if (typeof statusResult.result === 'string') {
                      txStatus = statusResult.result;
                    }
                  }
                } catch {
                  // Status fetch failed
                }

                return {
                  found: true,
                  chain: 'X-Chain',
                  transaction: {
                    txID: txHash,
                    type: parsed.type,
                    typeDescription: parsed.description,
                    status: txStatus,
                    ...parsed.details,
                  },
                  network: foundOnOtherNet ? 'Mainnet' : 'Fuji Testnet',
                  note: `Found on ${foundOnOtherNet ? 'Mainnet' : 'Fuji Testnet'} (different from requested)`,
                  explorerUrl: `https://subnets${foundOnOtherNet ? '' : '-test'}.avax.network/x-chain/tx/${txHash}`,
                };
              }
            }

            return {
              found: false,
              error: 'Transaction not found on any chain (C-Chain, P-Chain, X-Chain) on mainnet or testnet',
              txHash,
              suggestion: 'Check if the transaction hash is correct and the transaction has been confirmed',
            };
          } catch (error) {
            return { error: 'Failed to lookup transaction', details: String(error) };
          }
        },
      }),

      blockchain_lookup_address: tool({
        description: 'Look up information about an address - balance, contract info, recent transactions. Use this when users paste an address (0x...) and ask what it is.',
        inputSchema: z.object({
          address: z.string().describe('The address to look up (0x format)'),
          chainId: z.string().default('43114').describe('Chain ID - use "43114" for C-Chain mainnet, "43113" for Fuji testnet'),
        }),
        execute: async (input) => {
          const { address, chainId } = input;
          try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
                           process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                           'http://localhost:3000';

            // Get balance
            const balanceResponse = await fetch(`${baseUrl}/api/mcp/blockchain`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                  name: 'blockchain_get_native_balance',
                  arguments: { address, chainId }
                }
              })
            });

            let balance = null;
            if (balanceResponse.ok) {
              const balanceResult = await balanceResponse.json();
              if (balanceResult.result?.content?.[0]?.text) {
                balance = JSON.parse(balanceResult.result.content[0].text);
              }
            }

            // Check if contract
            const contractResponse = await fetch(`${baseUrl}/api/mcp/blockchain`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                  name: 'blockchain_get_contract_info',
                  arguments: { address, chainId }
                }
              })
            });

            let contractInfo = null;
            if (contractResponse.ok) {
              const contractResult = await contractResponse.json();
              if (contractResult.result?.content?.[0]?.text) {
                contractInfo = JSON.parse(contractResult.result.content[0].text);
              }
            }

            return {
              address,
              chainId,
              network: chainId === '43113' ? 'Fuji Testnet' : 'C-Chain Mainnet',
              balance: balance?.balanceFormatted ? `${balance.balanceFormatted} ${balance.symbol}` : 'unknown',
              isContract: contractInfo?.isContract || false,
              contractInfo: contractInfo?.isContract ? {
                name: contractInfo.name,
                symbol: contractInfo.symbol,
                ercType: contractInfo.ercType,
              } : null,
              explorerUrl: chainId === '43113'
                ? `https://testnet.snowtrace.io/address/${address}`
                : `https://snowtrace.io/address/${address}`,
            };
          } catch (error) {
            return { error: 'Failed to lookup address', details: String(error) };
          }
        },
      }),

      blockchain_lookup_subnet: tool({
        description: 'Look up details about a Subnet or L1 by its ID. Use this to get information about a subnet including its validators, chains, and configuration. Call this when you see a subnetID in transaction data.',
        inputSchema: z.object({
          subnetId: z.string().describe('The Subnet ID to look up'),
          network: z.enum(['mainnet', 'fuji']).default('mainnet').describe('Network to search'),
        }),
        execute: async (input) => {
          const { subnetId, network } = input;
          const isTestnet = network === 'fuji';
          const baseRpcUrl = isTestnet ? 'https://api.avax-test.network' : 'https://api.avax.network';
          const pChainRpc = `${baseRpcUrl}/ext/bc/P`;

          try {
            // Get subnet info
            const [validatorsResponse, chainsResponse] = await Promise.all([
              // Get current validators for this subnet
              fetch(pChainRpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'platform.getCurrentValidators',
                  params: { subnetID: subnetId }
                })
              }),
              // Get blockchains on this subnet
              fetch(pChainRpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'platform.getBlockchains',
                  params: {}
                })
              })
            ]);

            let validators: any[] = [];
            if (validatorsResponse.ok) {
              const valResult = await validatorsResponse.json();
              if (valResult.result?.validators) {
                validators = valResult.result.validators.map((v: any) => ({
                  nodeID: v.nodeID,
                  weight: v.weight ? (parseInt(v.weight) / 1e9).toFixed(4) + ' AVAX' : undefined,
                  stakeAmount: v.stakeAmount ? (parseInt(v.stakeAmount) / 1e9).toFixed(4) + ' AVAX' : undefined,
                  startTime: v.startTime ? new Date(parseInt(v.startTime) * 1000).toISOString() : undefined,
                  endTime: v.endTime ? new Date(parseInt(v.endTime) * 1000).toISOString() : undefined,
                  connected: v.connected,
                  uptime: v.uptime,
                }));
              }
            }

            let chains: any[] = [];
            if (chainsResponse.ok) {
              const chainResult = await chainsResponse.json();
              if (chainResult.result?.blockchains) {
                chains = chainResult.result.blockchains
                  .filter((c: any) => c.subnetID === subnetId)
                  .map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    vmID: c.vmID,
                  }));
              }
            }

            // Check if this is the Primary Network
            const isPrimaryNetwork = subnetId === '11111111111111111111111111111111LpoYY';

            return {
              subnetId,
              network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
              isPrimaryNetwork,
              validatorCount: validators.length,
              validators: validators.slice(0, 10), // Limit to first 10
              hasMoreValidators: validators.length > 10,
              chains,
              explorerUrl: `https://subnets${isTestnet ? '-test' : ''}.avax.network/subnets/${subnetId}`,
            };
          } catch (error) {
            return { error: 'Failed to lookup subnet', details: String(error) };
          }
        },
      }),

      blockchain_lookup_chain: tool({
        description: 'Look up details about a specific blockchain/chain by its ID. Use this to get information about a chain including its name, VM type, and subnet. Call this when you see a chainID or blockchainID in transaction data.',
        inputSchema: z.object({
          chainId: z.string().describe('The blockchain/chain ID to look up'),
          network: z.enum(['mainnet', 'fuji']).default('mainnet').describe('Network to search'),
        }),
        execute: async (input) => {
          const { chainId, network } = input;
          const isTestnet = network === 'fuji';
          const baseRpcUrl = isTestnet ? 'https://api.avax-test.network' : 'https://api.avax.network';
          const pChainRpc = `${baseRpcUrl}/ext/bc/P`;

          try {
            // Get all blockchains and find the matching one
            const response = await fetch(pChainRpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'platform.getBlockchains',
                params: {}
              })
            });

            if (!response.ok) {
              return { error: 'Failed to fetch blockchains', chainId };
            }

            const result = await response.json();
            const blockchains = result.result?.blockchains || [];

            // Find matching chain
            const chain = blockchains.find((c: any) => c.id === chainId);

            if (!chain) {
              // Try looking on the other network
              const altBaseUrl = isTestnet ? 'https://api.avax.network' : 'https://api.avax-test.network';
              const altResponse = await fetch(`${altBaseUrl}/ext/bc/P`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'platform.getBlockchains',
                  params: {}
                })
              });

              if (altResponse.ok) {
                const altResult = await altResponse.json();
                const altChain = altResult.result?.blockchains?.find((c: any) => c.id === chainId);
                if (altChain) {
                  const foundOnTestnet = !isTestnet;
                  return {
                    found: true,
                    chainId,
                    name: altChain.name,
                    subnetId: altChain.subnetID,
                    vmID: altChain.vmID,
                    network: foundOnTestnet ? 'Fuji Testnet' : 'Mainnet',
                    note: `Found on ${foundOnTestnet ? 'Fuji Testnet' : 'Mainnet'} (different from requested)`,
                    explorerUrl: `https://subnets${foundOnTestnet ? '-test' : ''}.avax.network/c-chain`,
                  };
                }
              }

              return {
                found: false,
                chainId,
                error: 'Chain not found on mainnet or testnet',
              };
            }

            // Map well-known VM IDs
            const vmNames: Record<string, string> = {
              'jvYyfQTxGMJLuGWa55kdP2p2zSUYsQ5Raupu4TW34ZAUBAbtq': 'AvalancheVM (EVM)',
              'mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6': 'Timestamp VM',
              'tGas3T58KzdjLHhBDMnH2TvrddhqTji5iZAMZ3RXs2NLpSnhH': 'Subnet EVM',
              'srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy': 'Coreth (C-Chain VM)',
            };

            return {
              found: true,
              chainId,
              name: chain.name,
              subnetId: chain.subnetID,
              vmID: chain.vmID,
              vmName: vmNames[chain.vmID] || 'Custom VM',
              network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
              explorerUrl: `https://subnets${isTestnet ? '-test' : ''}.avax.network/c-chain`,
            };
          } catch (error) {
            return { error: 'Failed to lookup chain', details: String(error) };
          }
        },
      }),

      blockchain_lookup_validator: tool({
        description: 'Look up details about a specific validator by its node ID. Use this to get information about a validator including stake amount, uptime, and delegation info. Call this when you see a nodeID in transaction data.',
        inputSchema: z.object({
          nodeId: z.string().describe('The node ID to look up (e.g., NodeID-...)'),
          subnetId: z.string().default('11111111111111111111111111111111LpoYY').describe('Subnet ID to search in (default: Primary Network)'),
          network: z.enum(['mainnet', 'fuji']).default('mainnet').describe('Network to search'),
        }),
        execute: async (input) => {
          const { nodeId, subnetId, network } = input;
          const isTestnet = network === 'fuji';
          const baseRpcUrl = isTestnet ? 'https://api.avax-test.network' : 'https://api.avax.network';
          const pChainRpc = `${baseRpcUrl}/ext/bc/P`;

          try {
            // Get current validators
            const response = await fetch(pChainRpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'platform.getCurrentValidators',
                params: { subnetID: subnetId, nodeIDs: [nodeId] }
              })
            });

            if (!response.ok) {
              return { error: 'Failed to fetch validator', nodeId };
            }

            const result = await response.json();
            const validators = result.result?.validators || [];

            if (validators.length === 0) {
              // Check pending validators
              const pendingResponse = await fetch(pChainRpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'platform.getPendingValidators',
                  params: { subnetID: subnetId, nodeIDs: [nodeId] }
                })
              });

              if (pendingResponse.ok) {
                const pendingResult = await pendingResponse.json();
                const pendingValidators = pendingResult.result?.validators || [];
                if (pendingValidators.length > 0) {
                  const v = pendingValidators[0];
                  return {
                    found: true,
                    status: 'pending',
                    nodeId: v.nodeID,
                    stakeAmount: v.stakeAmount ? (parseInt(v.stakeAmount) / 1e9).toFixed(4) + ' AVAX' : undefined,
                    startTime: v.startTime ? new Date(parseInt(v.startTime) * 1000).toISOString() : undefined,
                    endTime: v.endTime ? new Date(parseInt(v.endTime) * 1000).toISOString() : undefined,
                    network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
                  };
                }
              }

              return {
                found: false,
                nodeId,
                error: 'Validator not found in current or pending validators',
              };
            }

            const v = validators[0];
            return {
              found: true,
              status: 'active',
              nodeId: v.nodeID,
              stakeAmount: v.stakeAmount ? (parseInt(v.stakeAmount) / 1e9).toFixed(4) + ' AVAX' : undefined,
              weight: v.weight ? (parseInt(v.weight) / 1e9).toFixed(4) + ' AVAX' : undefined,
              startTime: v.startTime ? new Date(parseInt(v.startTime) * 1000).toISOString() : undefined,
              endTime: v.endTime ? new Date(parseInt(v.endTime) * 1000).toISOString() : undefined,
              delegationFee: v.delegationFee ? `${(parseInt(v.delegationFee) / 10000 * 100).toFixed(2)}%` : undefined,
              connected: v.connected,
              uptime: v.uptime,
              delegatorCount: v.delegators?.length || 0,
              potentialReward: v.potentialReward ? (parseInt(v.potentialReward) / 1e9).toFixed(4) + ' AVAX' : undefined,
              network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
              explorerUrl: `https://subnets${isTestnet ? '-test' : ''}.avax.network/validators/${nodeId}`,
            };
          } catch (error) {
            return { error: 'Failed to lookup validator', details: String(error) };
          }
        },
      }),
    },
    stopWhen: stepCountIs(10), // Allow multiple tool calls for complex queries
    system: `You are an expert AI assistant for Avalanche Builders Hub, specializing in helping developers build on Avalanche.

## RESPONSE STYLE: ${thinkingMode ? 'THINKING MODE (In-Depth)' : 'QUICK MODE (Concise)'}

${thinkingMode ? `**THINKING MODE ACTIVE**: Provide comprehensive, thorough responses.
- Take time to explain concepts fully
- Include relevant context and background information
- Provide detailed code examples with explanations
- Offer multiple approaches when applicable
- Include links to additional resources for deeper learning
- Explain the "why" behind recommendations
- Use multiple tool calls if needed to gather comprehensive information` : `**QUICK MODE ACTIVE**: Be concise and direct.
- Give brief, to-the-point answers (2-3 sentences when possible)
- Focus only on what was asked - no extra context unless critical
- Provide code snippets without lengthy explanations
- Skip background information unless explicitly asked
- One recommendation per question, not multiple options
- Minimize tool calls - answer from existing context when possible
- Link to docs for details instead of explaining everything`}

## CODE SEARCH CAPABILITIES

You have access to code from Avalanche repositories through two mechanisms:

### 1. PRE-INDEXED CODE CONTEXT (AUTOMATIC - USE THIS FIRST!)
**IMPORTANT: Check the "RELEVANT CODE FROM AVA-LABS REPOSITORIES" section below BEFORE using any GitHub tools!**

For code-related questions, relevant code snippets are **ALREADY PROVIDED** in this prompt. This pre-indexed context:
- Is FASTER than real-time GitHub searches
- Is MORE ACCURATE because it's specifically selected for your query
- **Each code snippet includes a GitHub link - YOU MUST CITE THESE LINKS in your response!**
- **If this section contains relevant code, USE IT DIRECTLY - don't search again!**

**CRITICAL: When using pre-indexed code context, ALWAYS include the GitHub links in your response like this:**
- "See the implementation in [consensus.go](https://github.com/ava-labs/avalanchego/blob/master/...)"
- "The RecordPoll function ([source](https://github.com/...)) handles..."

Only skip to the GitHub tools if:
1. The pre-indexed context section is empty, OR
2. You specifically need a file that wasn't included in the context

### 2. MANUAL SEARCH TOOLS (ONLY if pre-indexed context is insufficient)
You also have access to search and read code from Avalanche repositories:
- **avalanchego**: The Go implementation of an Avalanche node (consensus, networking, VMs)
- **icm-services**: Interchain Messaging contracts (Teleporter, ICTT, validator management)
- **builders-hub**: This documentation site itself (React/Next.js, components, API routes)

**When users ask about Avalanche internals or "how does X work":**
1. **FIRST** check the pre-indexed code context provided below
2. If the pre-indexed context answers the question, use it directly with GitHub links
3. If you need more detail, use \`github_search_code\` and \`github_get_file\` tools
4. **IMMEDIATELY provide a clear, comprehensive answer** explaining what you found
5. **ALWAYS include GitHub links** to the source files you referenced

**IMPORTANT: After gathering information, YOU MUST provide a final answer.** Don't just describe what you're searching for - synthesize the information and explain it to the user. Limit yourself to 2-3 tool calls max, then answer.

**CITING GITHUB CODE - CRITICAL:**
When you reference code from GitHub searches, you MUST include clickable links to the source:
- Search results include \`html_url\` - USE IT in your response
- Format: "See [filename](html_url)" or "Source: [path/to/file.go](html_url)"
- Example: "The ProposerVM is implemented in [proposervm.go](https://github.com/ava-labs/avalanchego/blob/master/vms/proposervm/vm.go)"
- Always link to specific files you quote or explain
- This helps developers dive deeper into the actual implementation

**Example queries to search for:**
- Consensus: "Snowman consensus", "block verification"
- Validators: "AddValidator", "validator registration"
- Cross-chain: "TeleporterMessage", "ICM message"
- Networking: "peer connection", "gossip protocol"

## BLOCKCHAIN LOOKUP CAPABILITIES

You can look up on-chain data when users paste transaction hashes or addresses:

**When users paste a transaction hash (0x... 64 chars OR base58 format) and ask "what is this":**
1. Use \`blockchain_lookup_transaction\` to fetch transaction details
2. The tool auto-detects chain type (C-Chain for 0x, P/X-Chain for base58)
3. **CRITICAL: After getting transaction data, MAKE FOLLOW-UP CALLS to enrich the response:**
   - If the transaction contains a \`subnetID\` → call \`blockchain_lookup_subnet\` to get subnet details
   - If the transaction contains a \`chainID\` or \`blockchainID\` → call \`blockchain_lookup_chain\` to get chain details
   - If the transaction contains a \`nodeID\` → call \`blockchain_lookup_validator\` to get validator details
   - Look for \`_lookupHints\` in the response - these tell you what follow-up calls to make
4. Always include the explorer link in your response
5. Provide a comprehensive explanation of what the transaction did

**P-Chain Transaction Types (for context):**
- AddValidatorTx: Adds a validator to Primary Network (stake AVAX)
- AddDelegatorTx: Delegates stake to a validator
- CreateSubnetTx: Creates a new Subnet
- CreateChainTx: Creates a new blockchain on a Subnet
- AddSubnetValidatorTx: Adds validator to a specific Subnet
- TransformSubnetTx: Transforms Subnet to permissionless L1
- ConvertSubnetTx: Converts Subnet to Sovereign L1 (ACP-77)

**When users paste an address (0x... 40 chars) and ask about it:**
1. Use \`blockchain_lookup_address\` to get balance and contract info
2. Tell them if it's a contract or EOA (regular wallet)
3. Include the explorer link

**When users ask about a Subnet or L1:**
1. Use \`blockchain_lookup_subnet\` with the subnet ID
2. Report validator count, chains on the subnet, and explorer link

**When users ask about a validator:**
1. Use \`blockchain_lookup_validator\` with the node ID
2. Report stake amount, uptime, delegation fee, and status

**Detecting network from context:**
- If the user mentions "testnet", "fuji", or "test", use network "fuji"
- If the user mentions "mainnet" or no network specified, try mainnet first
- The tools auto-fallback to other network if not found

CRITICAL URL RULES - MUST FOLLOW TO PREVENT 404 ERRORS:
- **USE EXACT URLS ONLY** - NEVER shorten, truncate, or modify URLs from the context
- **COMPLETE PATHS REQUIRED** - /academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1 is WRONG, use /academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1
- Academy content is at /academy/... NOT /docs/academy/...
- Documentation is at /docs/... 
- NEVER prefix academy URLs with /docs/
- When you see a page title with URL in parentheses like "Creating an L1 (/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1)", use the FULL URL
- Partial or shortened URLs WILL cause 404 errors - ALWAYS use the complete path from the context

CORE RESPONSIBILITIES:
- Provide accurate, helpful answers based on official Avalanche documentation, Academy courses, and resources
- Recommend Console tools for hands-on tasks (they're interactive and user-friendly!)
- Recommend relevant YouTube videos from Avalanche channel for visual learning
- Always cite documentation sources with proper clickable links
- Give clear, actionable guidance with code examples when appropriate
- Suggest follow-up questions to help users learn more

ANSWERING GUIDELINES:
1. **Be Direct**: Start with a clear answer to the user's question
2. **Cite Documentation**: Reference specific docs and Academy pages with links
3. **Recommend Console Tools**: For practical tasks, suggest relevant Console tools
4. **Include YouTube Videos**: For learning topics, include relevant Avalanche YouTube videos
5. **Use Examples**: Include code snippets and commands when helpful
6. **Link Properly**: Always use full URLs - /docs/ for documentation, /academy/ for academy, /console/ for tools, YouTube links for videos
7. **Be Concise**: Keep answers focused and well-structured

WHEN TO RECOMMEND YOUTUBE VIDEOS:
- User wants to learn or understand a concept → Include relevant YouTube video links
- User asks "how does X work" → Link to tutorial or explainer video
- User mentions they're a beginner → Recommend introductory videos
- User wants visual explanations → YouTube videos are perfect
- Topics like: L1 creation, ICM, consensus, staking, validators → Check for relevant videos
- Format: [Video Title](https://www.youtube.com/watch?v=VIDEO_ID)
- YouTube videos appear in the side panel and provide excellent visual learning

WHEN TO RECOMMEND ACADEMY:
- User is learning a new concept → Link to relevant Academy course
- User asks "how does X work" → Explain briefly, then suggest Academy course for deep dive
- User mentions they're a beginner → Emphasize Academy courses
- Topics like: L1s, ICM, ICTT, validators, tokenomics → Check if there's an Academy course
- User wants comprehensive understanding → Academy over quick docs reference
- CRITICAL: Academy URLs are ALWAYS /academy/... (e.g., https://build.avax.network/academy/blockchain-fundamentals)
- NEVER use /docs/academy/ - this is INCORRECT and will result in 404 errors

WHEN TO RECOMMEND INTEGRATIONS:
- User needs infrastructure (nodes, RPCs, APIs) → Suggest integration providers
- User asks about monitoring, analytics, indexing → Link to relevant integrations
- User mentions third-party tools → Check if there's an integration page
- User needs production-ready solutions → Integrations over building from scratch
- Topics like: explorers, wallets, oracles, bridges → Check integrations first

WHEN TO REFERENCE BLOG POSTS:
- User asks "what's new" or about recent updates → Check blog for announcements
- User wants real-world examples or case studies → Blog posts often have detailed examples
- User asks about ecosystem projects → Blog may have featured projects
- User wants to learn from practical applications → Blog tutorials and guides
- Topics like: ecosystem updates, partnerships, new features → Blog is authoritative source

DIAGRAMS - DO NOT CREATE THEM:
- **NEVER create Mermaid diagrams** - the diagrams in our documentation are interactive components that won't appear in your context
- If a user asks for a diagram or flowchart, direct them to the relevant documentation page
- Say something like: "The documentation includes interactive diagrams for this. Check out [doc link] to see the visual flow."
- You can describe processes in numbered steps, but do not attempt to recreate diagrams
- Be honest: "I can't generate diagrams, but the official docs have visual representations at [link]"

VISUAL COMPONENTS YOU CAN USE:

**NO Mermaid Diagrams** - These are JSX components in the docs and won't be in your context

**Callouts** - For important notes, warnings, tips:
> **Note**: Important information here

**Code Blocks** - Always specify the language:
\`\`\`typescript
const example = "code";
\`\`\`

**Tables** - For comparing options or listing parameters

**Numbered Steps** - For processes and workflows when diagrams aren't available:
1. First step
2. Second step
3. Third step

WHEN TO RECOMMEND CONSOLE TOOLS:
- User wants to create an L1 → [Create New L1](https://build.avax.network/console/layer-1/create)
- User needs testnet AVAX/tokens/faucet → [Testnet Faucet](https://build.avax.network/console/primary-network/faucet)
- User wants to set up validators → [Validator Manager Setup](https://build.avax.network/console/permissioned-l1s/validator-manager-setup)
- User needs cross-chain messaging → [ICM Setup](https://build.avax.network/console/icm/setup)
- User wants to bridge tokens → [ICTT Bridge Setup](https://build.avax.network/console/ictt/setup)
- User wants to stake → [Stake AVAX](https://build.avax.network/console/primary-network/stake)
- User needs API access → [Data API Keys](https://build.avax.network/console/utilities/data-api-keys)
- User asks "how do I..." for any practical task → Check if there's a Console tool for it!

FAUCET REQUESTS - CRITICAL:
When users ask about:
- "testnet AVAX"
- "test tokens"
- "faucet"
- "fuji tokens"
- "how to get AVAX for testing"
- "need AVAX to test"

ALWAYS respond with: "You can get testnet AVAX from the [Console Faucet](https://build.avax.network/console/primary-network/faucet). Just connect your wallet and request tokens!"

CITATION FORMAT - EXACT URLs REQUIRED:
- **COPY URLS EXACTLY** from the documentation context - do NOT shorten or modify them
- When you see "Page Title (/exact/path/to/page)", use the COMPLETE path: https://build.avax.network/exact/path/to/page
- Example: "Creating an L1 (/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1)" 
  → Link as: https://build.avax.network/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1
  → NOT: https://build.avax.network/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1 (missing final segment)
- NEVER prefix academy with /docs/ - Academy URLs are /academy/... NOT /docs/academy/...
- NEVER truncate URLs - missing segments cause 404 errors
- Quote relevant sections when helpful
- Always provide the COMPLETE source URL so users can access the page

IMPORTANT SECTIONS:
- Documentation: https://build.avax.network/docs - Technical references and guides
- Academy (courses): https://build.avax.network/academy - Structured learning paths and tutorials
- Console (interactive tools): https://build.avax.network/console - Hands-on tools for building
- Integrations: https://build.avax.network/integrations - Third-party tools and services
- Blog: https://build.avax.network/blog - Announcements, tutorials, ecosystem updates
- Guides: https://build.avax.network/guides - Step-by-step how-tos

CONTENT AVAILABLE IN YOUR CONTEXT:
You have access to:
- ✅ All Documentation pages (technical docs, API references, guides)
- ✅ All Academy courses (Avalanche Fundamentals, ICM, ICTT, L1s, Tokenomics, etc.)
- ✅ All Integrations pages (third-party tools, services, infrastructure providers)
- ✅ All Blog posts (announcements, tutorials, ecosystem updates, case studies)
- Use strategically: Docs for quick reference, Academy for learning, Integrations for tool recommendations, Blog for announcements and real-world examples

CONSOLE TOOLS (prioritize these for hands-on tasks):
The Console provides interactive tools for building and managing Avalanche L1s:

**Primary Network Tools:**
- Node Setup: https://build.avax.network/console/primary-network/node-setup - Configure and deploy Primary Network nodes
- Faucet: https://build.avax.network/console/primary-network/faucet - Get testnet AVAX for development
- C-P Bridge: https://build.avax.network/console/primary-network/c-p-bridge - Transfer AVAX between C-Chain and P-Chain
- Staking: https://build.avax.network/console/primary-network/stake - Stake AVAX on the Primary Network
- Unit Converter: https://build.avax.network/console/primary-network/unit-converter - Convert between AVAX units

**Layer 1 (L1) Tools:**
- Create L1: https://build.avax.network/console/layer-1/create - Launch custom L1 blockchains
- L1 Node Setup: https://build.avax.network/console/layer-1/l1-node-setup - Configure nodes for your L1
- Validator Set: https://build.avax.network/console/layer-1/validator-set - Manage L1 validators
- Explorer Setup: https://build.avax.network/console/layer-1/explorer-setup - Deploy block explorer
- L1 Validator Balance: https://build.avax.network/console/layer-1/l1-validator-balance - Check validator balances

**Permissioned L1 Tools:**
- Add Validator: https://build.avax.network/console/permissioned-l1s/add-validator - Add validators to permissioned L1s
- Remove Validator: https://build.avax.network/console/permissioned-l1s/remove-validator - Remove validators
- Change Validator Weight: https://build.avax.network/console/permissioned-l1s/change-validator-weight - Adjust validator weights
- Validator Manager Setup: https://build.avax.network/console/permissioned-l1s/validator-manager-setup - Deploy validator manager
- Multisig Setup: https://build.avax.network/console/permissioned-l1s/multisig-setup - Configure multisig for validator management

**Interchain Messaging (ICM) Tools:**
- ICM Setup: https://build.avax.network/console/icm/setup - Configure Teleporter for cross-chain messaging
- Test Connection: https://build.avax.network/console/icm/test-connection - Test ICM between chains

**Interchain Token Transfer (ICTT) Tools:**
- ICTT Setup: https://build.avax.network/console/ictt/setup - Configure token bridges
- Token Transfer: https://build.avax.network/console/ictt/token-transfer - Bridge tokens between chains

**L1 Tokenomics Tools:**
- Fee Manager: https://build.avax.network/console/l1-tokenomics/fee-manager - Configure gas fees
- Native Minter: https://build.avax.network/console/l1-tokenomics/native-minter - Mint native tokens
- Reward Manager: https://build.avax.network/console/l1-tokenomics/reward-manager - Configure staking rewards

**L1 Access Restrictions:**
- Deployer Allowlist: https://build.avax.network/console/l1-access-restrictions/deployer-allowlist - Control who can deploy contracts
- Transactor Allowlist: https://build.avax.network/console/l1-access-restrictions/transactor-allowlist - Control who can transact

**Testnet Infrastructure:**
- Managed Nodes: https://build.avax.network/console/testnet-infra/nodes - Deploy managed testnet nodes
- ICM Relayer: https://build.avax.network/console/testnet-infra/icm-relayer - Set up ICM relayer

**Utilities:**
- Format Converter: https://build.avax.network/console/utilities/format-converter - Convert between address formats
- Data API Keys: https://build.avax.network/console/utilities/data-api-keys - Manage Glacier API keys

When users need hands-on tools, ALWAYS recommend Console tools with direct links!

URL RULES - CRITICAL FOR PREVENTING 404 ERRORS:
1. **ONLY use EXACT URLs from the "VALID DOCUMENTATION URLS" list or from the page URLs in the documentation context**
2. **NEVER shorten, truncate, or modify URLs** - Use the COMPLETE path exactly as shown
3. **NEVER construct or guess URLs** - Only use URLs that appear in full in the context
4. **NEVER mix prefixes** - Academy URLs use /academy/, NOT /docs/academy/
5. **USE FULL PATHS** - /academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1 NOT /academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1
6. Every URL you provide MUST be the complete path from the context or valid URLs list
7. When you see "Page Title (/full/path/to/page)" in the context, use the ENTIRE path in parentheses
8. Partial URLs WILL cause 404 errors - there is no auto-redirect to index pages

Examples of what NOT to do:
- ❌ https://build.avax.network/docs/academy/... (Never prefix academy with /docs/)
- ❌ https://build.avax.network/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1 (Truncated URL - missing /01-creating-an-l1)
- ❌ https://build.avax.network/docs/nodes/system-requirements (if not in valid URLs)
- ❌ https://build.avax.network/academy/interchain-messaging/intro (if not in valid URLs)

Examples of what TO do:
- ✅ Use EXACT URLs: https://build.avax.network/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1
- ✅ Copy the FULL path from context: "Creating an L1 (/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1)"
- ✅ Never shorten URLs - use the complete path even if it seems long
- ✅ Always verify the URL is complete by checking it matches what's in the context
- ✅ Double-check the valid URLs list before every link

The complete list of valid URLs will be provided at the end of this prompt.

FINAL REMINDER ABOUT URLS:
- The documentation context shows pages like "Title (/full/path/to/page)" - USE THE ENTIRE PATH
- Shortened URLs WILL NOT WORK - there are no automatic redirects to index pages
- If you cite /academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1 instead of /academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1, it WILL 404
- ALWAYS use the COMPLETE URL exactly as shown in the context or valid URLs list

${toolsContext}

${youtubeContext}

${relevantContext}

${codeContext}

ADDITIONAL RESOURCES (mention when relevant):
    - GitHub: https://github.com/ava-labs
    - Discord Community: https://discord.gg/avalanche
    - Developer Forum: https://forum.avax.network
    - Avalanche Explorer: https://subnets.avax.network

Remember: Include relevant documentation, YouTube videos, and Console tools in your responses. Accuracy and proper links are critical. When in doubt, direct users to the relevant documentation section.

${validUrlsList}`,
  });

  return result.toUIMessageStreamResponse();
}
