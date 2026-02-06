/**
 * Code Search Utility for DeepWiki-style Chat
 *
 * Loads pre-indexed embeddings and performs vector similarity search
 * to find relevant code chunks for user queries.
 */

import { gunzipSync } from 'zlib';

// ============================================================================
// Types
// ============================================================================

export interface CodeChunk {
  id: string;
  repo: string;
  filePath: string;
  fileName: string;
  language: string;
  content: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'type' | 'interface' | 'file' | 'block';
  name?: string;
  url: string;
}

export interface IndexedChunk extends CodeChunk {
  embedding: number[];
}

export interface RepoIndex {
  repo: string;
  indexedAt: string;
  commitSha: string;
  chunkCount: number;
  chunks: IndexedChunk[];
}

export interface SearchResult extends CodeChunk {
  score: number;
}

export interface EmbeddingsManifest {
  repos: {
    name: string;
    file: string;
    chunkCount: number;
    indexedAt: string;
  }[];
}

// ============================================================================
// Vector Math
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// ============================================================================
// Index Loading (with caching)
// ============================================================================

let cachedIndices: Map<string, RepoIndex> = new Map();
let cacheLoadedAt: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Load embeddings index from public folder
 * Works in both Node.js and Edge runtime
 */
async function loadIndex(repoName: string, baseUrl: string): Promise<RepoIndex | null> {
  const fileName = repoName.split('/')[1] + '.json.gz';
  const url = `${baseUrl}/embeddings/${fileName}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to load index from ${url}: ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const decompressed = gunzipSync(Buffer.from(buffer));
    const index: RepoIndex = JSON.parse(decompressed.toString());

    return index;
  } catch (error) {
    console.error(`Error loading index for ${repoName}:`, error);
    return null;
  }
}

/**
 * Load manifest and all indices
 */
async function loadAllIndices(baseUrl: string): Promise<Map<string, RepoIndex>> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedIndices.size > 0 && (now - cacheLoadedAt) < CACHE_TTL) {
    return cachedIndices;
  }

  try {
    // Load manifest
    const manifestUrl = `${baseUrl}/embeddings/manifest.json`;
    const manifestResponse = await fetch(manifestUrl);

    if (!manifestResponse.ok) {
      console.warn('No embeddings manifest found - code search will be unavailable');
      return new Map();
    }

    const manifest: EmbeddingsManifest = await manifestResponse.json();

    // Load all indices
    const indices = new Map<string, RepoIndex>();

    for (const repo of manifest.repos) {
      const index = await loadIndex(repo.name, baseUrl);
      if (index) {
        indices.set(repo.name, index);
        console.log(`Loaded ${repo.chunkCount} chunks from ${repo.name}`);
      }
    }

    cachedIndices = indices;
    cacheLoadedAt = now;

    return indices;
  } catch (error) {
    console.error('Error loading embeddings indices:', error);
    return cachedIndices; // Return stale cache if available
  }
}

// ============================================================================
// Search
// ============================================================================

export interface SearchOptions {
  topK?: number;
  repos?: string[];           // Filter by repo names
  languages?: string[];       // Filter by language
  types?: ('function' | 'type' | 'interface' | 'file' | 'block')[];
  minScore?: number;          // Minimum similarity threshold
}

/**
 * Search for relevant code chunks using vector similarity
 *
 * @param queryEmbedding - The embedding vector for the search query
 * @param baseUrl - Base URL for loading embeddings (e.g., http://localhost:3000)
 * @param options - Search options
 */
export async function searchCode(
  queryEmbedding: number[],
  baseUrl: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = 5,
    repos,
    languages,
    types,
    minScore = 0.3,
  } = options;

  const indices = await loadAllIndices(baseUrl);

  if (indices.size === 0) {
    console.warn('No embeddings loaded - returning empty results');
    return [];
  }

  // Collect all chunks with scores
  const results: SearchResult[] = [];
  let maxScoreSeen = 0;
  let minScoreSeen = 1;
  let totalChunksChecked = 0;

  for (const [repoName, index] of indices) {
    // Filter by repo if specified
    if (repos && !repos.includes(repoName)) continue;

    for (const chunk of index.chunks) {
      // Filter by language
      if (languages && !languages.includes(chunk.language)) continue;

      // Filter by type
      if (types && !types.includes(chunk.type)) continue;

      totalChunksChecked++;

      // Calculate similarity
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);

      // Track score range for debugging
      if (score > maxScoreSeen) maxScoreSeen = score;
      if (score < minScoreSeen) minScoreSeen = score;

      if (score >= minScore) {
        // Omit embedding from result to save memory
        const { embedding, ...chunkWithoutEmbedding } = chunk;
        results.push({
          ...chunkWithoutEmbedding,
          score,
        });
      }
    }
  }

  console.log(`[CodeSearch] Score stats: min=${minScoreSeen.toFixed(4)}, max=${maxScoreSeen.toFixed(4)}, threshold=${minScore}, checked=${totalChunksChecked} chunks`);

  // Sort by score descending and return top K
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Format search results as context for the LLM
 */
export function formatCodeContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const sections = results.map((result, i) => {
    const header = [
      `### ${i + 1}. ${result.filePath}`,
      `**Repo:** ${result.repo} | **Type:** ${result.type}${result.name ? ` | **Name:** ${result.name}` : ''} | **Lines:** ${result.startLine}-${result.endLine}`,
      `**[View on GitHub](${result.url})** | **Relevance:** ${(result.score * 100).toFixed(1)}%`,
    ].join('\n');

    return `${header}\n\n\`\`\`${result.language}\n${result.content}\n\`\`\``;
  });

  return `## Relevant Code from ava-labs Repositories\n\n${sections.join('\n\n---\n\n')}`;
}

/**
 * Get stats about loaded indices
 */
export async function getIndexStats(baseUrl: string): Promise<{
  totalChunks: number;
  repos: { name: string; chunks: number; indexedAt: string }[];
}> {
  const indices = await loadAllIndices(baseUrl);

  let totalChunks = 0;
  const repos: { name: string; chunks: number; indexedAt: string }[] = [];

  for (const [name, index] of indices) {
    totalChunks += index.chunkCount;
    repos.push({
      name,
      chunks: index.chunkCount,
      indexedAt: index.indexedAt,
    });
  }

  return { totalChunks, repos };
}
