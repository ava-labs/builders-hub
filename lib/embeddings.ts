/**
 * Embedding Generation Utility
 *
 * Generates embeddings for queries at runtime using OpenAI's API.
 * Used to match user queries against pre-indexed code embeddings.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// Simple in-memory cache for query embeddings (avoids re-embedding same queries)
const queryEmbeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate an embedding for a text query
 */
export async function embedQuery(query: string): Promise<number[]> {
  // Check cache first
  const cached = queryEmbeddingCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.embedding;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: query,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Embedding API error:', error);
    throw new Error(`Failed to generate embedding: ${response.status}`);
  }

  const data = await response.json();
  const embedding = data.data[0].embedding as number[];

  // Cache the result
  queryEmbeddingCache.set(query, { embedding, timestamp: Date.now() });

  // Cleanup old cache entries periodically
  if (queryEmbeddingCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of queryEmbeddingCache) {
      if (now - value.timestamp > CACHE_TTL) {
        queryEmbeddingCache.delete(key);
      }
    }
  }

  return embedding;
}

/**
 * Analyze query intent to determine if it's a code question
 */
export function analyzeQueryIntent(query: string): {
  isCodeQuestion: boolean;
  keywords: string[];
  suggestedRepos?: string[];
} {
  const lowercaseQuery = query.toLowerCase();

  // Code-related keywords
  const codeKeywords = [
    'function', 'method', 'class', 'struct', 'interface', 'type',
    'implement', 'code', 'source', 'file', 'package', 'module',
    'how does', 'how is', 'where is', 'find', 'show me',
    'consensus', 'validator', 'staking', 'transaction', 'block',
    'vm', 'chain', 'subnet', 'avalanche', 'snowman', 'avalanchego',
    'platformvm', 'avm', 'evm', 'coreth', 'icm', 'teleporter',
    'p-chain', 'x-chain', 'c-chain',
  ];

  // Check for code-related intent
  const matchedKeywords = codeKeywords.filter(kw => lowercaseQuery.includes(kw));
  const isCodeQuestion = matchedKeywords.length > 0;

  // Suggest repos based on query content
  const suggestedRepos: string[] = [];
  if (lowercaseQuery.includes('icm') || lowercaseQuery.includes('teleporter') ||
      lowercaseQuery.includes('interchain') || lowercaseQuery.includes('relayer')) {
    suggestedRepos.push('ava-labs/icm-services');
  }
  if (lowercaseQuery.includes('avalanchego') || lowercaseQuery.includes('consensus') ||
      lowercaseQuery.includes('validator') || lowercaseQuery.includes('staking') ||
      lowercaseQuery.includes('platformvm') || lowercaseQuery.includes('p-chain') ||
      lowercaseQuery.includes('snowman') || lowercaseQuery.includes('avm')) {
    suggestedRepos.push('ava-labs/avalanchego');
  }

  // Default to both if no specific repo detected
  if (suggestedRepos.length === 0 && isCodeQuestion) {
    suggestedRepos.push('ava-labs/avalanchego', 'ava-labs/icm-services');
  }

  return {
    isCodeQuestion,
    keywords: matchedKeywords,
    suggestedRepos: suggestedRepos.length > 0 ? suggestedRepos : undefined,
  };
}
