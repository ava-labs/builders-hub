/**
 * Repository Indexer for DeepWiki-style Code Search
 *
 * Fetches code from ava-labs repos, chunks it, generates embeddings,
 * and saves as JSON for runtime search.
 *
 * Run: yarn index-repos
 */

import 'dotenv/config';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { gzipSync } from 'zlib';

// ============================================================================
// Configuration
// ============================================================================

const REPOS = [
  { owner: 'ava-labs', name: 'avalanchego', branch: 'master' },
  { owner: 'ava-labs', name: 'icm-services', branch: 'main' },
];

// File patterns to include (focus on core code, skip tests/vendors)
const INCLUDE_PATTERNS = [
  /\.go$/,
  /\.sol$/,
  /\.ts$/,
  /\.tsx$/,
];

const EXCLUDE_PATTERNS = [
  /_test\.go$/,
  /test_.*\.go$/,
  /\/tests?\//,
  /\/vendor\//,
  /\/node_modules\//,
  /\/mocks?\//,
  /\.pb\.go$/,        // Generated protobuf
  /\.gen\.go$/,       // Generated files
  /\/examples?\//,
];

// Important directories to prioritize for avalanchego and icm-services
// Higher in list = higher priority for indexing when MAX_FILES_PER_REPO is reached
const PRIORITY_PATHS = [
  // === avalanchego core consensus ===
  'snow/consensus',
  'snow/engine',
  'snow/validators',
  'snow/networking',
  // === avalanchego VMs (includes coreth/C-Chain and subnet-evm) ===
  'vms/platformvm',
  'vms/avm',
  'vms/proposervm',
  'vms/components',
  // === avalanchego chains & networking ===
  'chains',
  'network',
  'message',
  // === avalanchego staking & genesis ===
  'staking',
  'genesis',
  'x/sync',
  // === avalanchego APIs ===
  'api',
  'indexer',
  'wallet',
  // === icm-services: teleporter contracts ===
  'contracts/teleporter',
  'contracts/ictt',
  'contracts/validator-manager',
  // === icm-services: services ===
  'relayer',
  'signature-aggregator',
  'abi-bindings',
];

// Rate limit configuration:
// - Unauthenticated: 60 requests/hour → keep MAX_FILES_PER_REPO low (100)
// - With GITHUB_TOKEN (fine-grained PAT starting with github_pat_): 5000 req/hour
// Using 200 files per repo for better coverage while staying within reasonable bounds
const MAX_FILES_PER_REPO = 200;  // Increased from 100 for better coverage
const MAX_CHUNK_TOKENS = 500;    // ~2000 chars
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// ============================================================================
// Types
// ============================================================================

interface CodeChunk {
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

interface IndexedChunk extends CodeChunk {
  embedding: number[];
}

interface RepoIndex {
  repo: string;
  indexedAt: string;
  commitSha: string;
  chunkCount: number;
  chunks: IndexedChunk[];
}

// ============================================================================
// GitHub Fetching
// ============================================================================

// Note: ava-labs org requires fine-grained PATs, so we use unauthenticated access
// for public repos. Rate limit is 60 req/hour vs 5000 with auth.
const octokit = new Octokit({
  // Only use token if it's a fine-grained PAT (starts with github_pat_)
  auth: process.env.GITHUB_TOKEN?.startsWith('github_pat_') ? process.env.GITHUB_TOKEN : undefined,
});

async function getRepoTree(owner: string, repo: string, branch: string): Promise<string[]> {
  console.log(`📂 Fetching file tree for ${owner}/${repo}...`);

  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: 'true',
  });

  const files = data.tree
    .filter(item => item.type === 'blob' && item.path)
    .map(item => item.path!)
    .filter(path => {
      // Check include patterns
      const included = INCLUDE_PATTERNS.some(p => p.test(path));
      if (!included) return false;

      // Check exclude patterns
      const excluded = EXCLUDE_PATTERNS.some(p => p.test(path));
      return !excluded;
    });

  // Sort by priority (important paths first)
  files.sort((a, b) => {
    const aPriority = PRIORITY_PATHS.findIndex(p => a.includes(p));
    const bPriority = PRIORITY_PATHS.findIndex(p => b.includes(p));

    if (aPriority >= 0 && bPriority >= 0) return aPriority - bPriority;
    if (aPriority >= 0) return -1;
    if (bPriority >= 0) return 1;
    return 0;
  });

  console.log(`   Found ${files.length} files matching patterns`);
  return files.slice(0, MAX_FILES_PER_REPO);
}

async function getFileContent(owner: string, repo: string, path: string, branch: string): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if ('content' in data && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch (error) {
    console.warn(`   ⚠️  Failed to fetch ${path}`);
    return null;
  }
}

async function getLatestCommitSha(owner: string, repo: string, branch: string): Promise<string> {
  const { data } = await octokit.repos.getBranch({
    owner,
    repo,
    branch,
  });
  return data.commit.sha;
}

// ============================================================================
// Code Chunking
// ============================================================================

function detectLanguage(filePath: string): string {
  if (filePath.endsWith('.go')) return 'go';
  if (filePath.endsWith('.sol')) return 'solidity';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.tsx')) return 'tsx';
  return 'text';
}

function chunkGoFile(content: string, filePath: string, repo: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split('\n');
  const fileName = path.basename(filePath);

  // Regex patterns for Go constructs
  const funcPattern = /^func\s+(\([^)]+\)\s+)?(\w+)/;
  const typePattern = /^type\s+(\w+)\s+(struct|interface)/;

  let currentChunk: string[] = [];
  let chunkStartLine = 1;
  let currentType: 'function' | 'type' | 'interface' | 'file' | 'block' = 'block';
  let currentName: string | undefined;
  let braceDepth = 0;
  let inBlock = false;

  // Always include package and imports as first chunk
  const headerLines: string[] = [];
  let headerEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('package ') || line.startsWith('import ') || line.trim() === '' ||
        line.startsWith('import (') || (headerEnd > 0 && line.startsWith('\t') && lines[headerEnd-1]?.includes('import ('))) {
      headerLines.push(line);
      headerEnd = i + 1;
      if (line === ')') break;
    } else if (headerEnd > 0) {
      break;
    }
  }

  if (headerLines.length > 0) {
    chunks.push({
      id: `${repo}:${filePath}:header`,
      repo,
      filePath,
      fileName,
      language: 'go',
      content: headerLines.join('\n'),
      startLine: 1,
      endLine: headerEnd,
      type: 'file',
      name: 'header',
      url: `https://github.com/${repo}/blob/master/${filePath}#L1-L${headerEnd}`,
    });
  }

  // Process rest of file
  for (let i = headerEnd; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for new function or type definition
    const funcMatch = line.match(funcPattern);
    const typeMatch = line.match(typePattern);

    if ((funcMatch || typeMatch) && braceDepth === 0) {
      // Save previous chunk if exists
      if (currentChunk.length > 0 && inBlock) {
        chunks.push({
          id: `${repo}:${filePath}:${chunkStartLine}`,
          repo,
          filePath,
          fileName,
          language: 'go',
          content: currentChunk.join('\n'),
          startLine: chunkStartLine,
          endLine: lineNum - 1,
          type: currentType,
          name: currentName,
          url: `https://github.com/${repo}/blob/master/${filePath}#L${chunkStartLine}-L${lineNum - 1}`,
        });
      }

      // Start new chunk
      currentChunk = [line];
      chunkStartLine = lineNum;
      inBlock = true;

      if (funcMatch) {
        currentType = 'function';
        currentName = funcMatch[2];
      } else if (typeMatch) {
        currentType = typeMatch[2] === 'interface' ? 'interface' : 'type';
        currentName = typeMatch[1];
      }
    } else if (inBlock) {
      currentChunk.push(line);
    }

    // Track brace depth
    braceDepth += (line.match(/{/g) || []).length;
    braceDepth -= (line.match(/}/g) || []).length;

    // End of block
    if (inBlock && braceDepth === 0 && currentChunk.length > 0) {
      chunks.push({
        id: `${repo}:${filePath}:${chunkStartLine}`,
        repo,
        filePath,
        fileName,
        language: 'go',
        content: currentChunk.join('\n'),
        startLine: chunkStartLine,
        endLine: lineNum,
        type: currentType,
        name: currentName,
        url: `https://github.com/${repo}/blob/master/${filePath}#L${chunkStartLine}-L${lineNum}`,
      });
      currentChunk = [];
      inBlock = false;
    }

    // Prevent chunks from getting too large
    if (currentChunk.length > 100) {
      chunks.push({
        id: `${repo}:${filePath}:${chunkStartLine}`,
        repo,
        filePath,
        fileName,
        language: 'go',
        content: currentChunk.join('\n'),
        startLine: chunkStartLine,
        endLine: lineNum,
        type: currentType,
        name: currentName,
        url: `https://github.com/${repo}/blob/master/${filePath}#L${chunkStartLine}-L${lineNum}`,
      });
      currentChunk = [];
      chunkStartLine = lineNum + 1;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      id: `${repo}:${filePath}:${chunkStartLine}`,
      repo,
      filePath,
      fileName,
      language: 'go',
      content: currentChunk.join('\n'),
      startLine: chunkStartLine,
      endLine: lines.length,
      type: currentType,
      name: currentName,
      url: `https://github.com/${repo}/blob/master/${filePath}#L${chunkStartLine}-L${lines.length}`,
    });
  }

  return chunks;
}

function chunkGenericFile(content: string, filePath: string, repo: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split('\n');
  const fileName = path.basename(filePath);
  const language = detectLanguage(filePath);

  // Simple sliding window chunking for non-Go files
  const CHUNK_SIZE = 50;  // lines
  const OVERLAP = 10;     // lines

  for (let i = 0; i < lines.length; i += CHUNK_SIZE - OVERLAP) {
    const chunkLines = lines.slice(i, i + CHUNK_SIZE);
    if (chunkLines.length < 5) continue;  // Skip tiny chunks

    const startLine = i + 1;
    const endLine = Math.min(i + CHUNK_SIZE, lines.length);

    chunks.push({
      id: `${repo}:${filePath}:${startLine}`,
      repo,
      filePath,
      fileName,
      language,
      content: chunkLines.join('\n'),
      startLine,
      endLine,
      type: 'block',
      url: `https://github.com/${repo}/blob/master/${filePath}#L${startLine}-L${endLine}`,
    });
  }

  return chunks;
}

function chunkFile(content: string, filePath: string, repo: string): CodeChunk[] {
  const language = detectLanguage(filePath);

  if (language === 'go') {
    return chunkGoFile(content, filePath, repo);
  }

  return chunkGenericFile(content, filePath, repo);
}

// ============================================================================
// Embedding Generation
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbeddings(chunks: CodeChunk[]): Promise<number[][]> {
  console.log(`🧠 Generating embeddings for ${chunks.length} chunks...`);

  const BATCH_SIZE = 100;
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(chunk => {
      // Create a rich text representation for better embeddings
      const header = `File: ${chunk.filePath}\n`;
      const typeInfo = chunk.name ? `${chunk.type}: ${chunk.name}\n` : '';
      return header + typeInfo + chunk.content;
    });

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    embeddings.push(...response.data.map(d => d.embedding));

    const progress = Math.min(i + BATCH_SIZE, chunks.length);
    console.log(`   Progress: ${progress}/${chunks.length} (${Math.round(progress/chunks.length*100)}%)`);

    // Rate limiting
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return embeddings;
}

// ============================================================================
// Main Indexing Flow
// ============================================================================

async function indexRepo(repoConfig: typeof REPOS[0]): Promise<RepoIndex> {
  const { owner, name, branch } = repoConfig;
  const repoFullName = `${owner}/${name}`;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Indexing ${repoFullName}`);
  console.log(`${'='.repeat(60)}`);

  // Get commit SHA for versioning
  const commitSha = await getLatestCommitSha(owner, name, branch);
  console.log(`📌 Commit: ${commitSha.slice(0, 7)}`);

  // Fetch file tree
  const files = await getRepoTree(owner, name, branch);

  // Fetch and chunk files
  const allChunks: CodeChunk[] = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const content = await getFileContent(owner, name, filePath, branch);

    if (content) {
      const chunks = chunkFile(content, filePath, repoFullName);
      allChunks.push(...chunks);
    }

    // Progress
    if ((i + 1) % 50 === 0 || i === files.length - 1) {
      console.log(`   Processed ${i + 1}/${files.length} files, ${allChunks.length} chunks`);
    }

    // Rate limiting for GitHub API (longer delay for unauthenticated access)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 Total chunks: ${allChunks.length}`);

  // Generate embeddings
  const embeddings = await generateEmbeddings(allChunks);

  // Combine chunks with embeddings
  const indexedChunks: IndexedChunk[] = allChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i],
  }));

  return {
    repo: repoFullName,
    indexedAt: new Date().toISOString(),
    commitSha,
    chunkCount: indexedChunks.length,
    chunks: indexedChunks,
  };
}

async function main() {
  console.log('🔍 DeepWiki-style Repository Indexer');
  console.log('====================================\n');

  // Check for required env vars
  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable required');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable required');
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), 'public', 'embeddings');

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const manifest: { repos: { name: string; file: string; chunkCount: number; indexedAt: string }[] } = {
    repos: [],
  };

  for (const repoConfig of REPOS) {
    try {
      const index = await indexRepo(repoConfig);

      // Save as gzipped JSON
      const fileName = `${repoConfig.name}.json.gz`;
      const filePath = path.join(outputDir, fileName);

      const jsonData = JSON.stringify(index);
      const compressed = gzipSync(jsonData);

      fs.writeFileSync(filePath, compressed);

      const sizeMB = (compressed.length / 1024 / 1024).toFixed(2);
      console.log(`\n✅ Saved ${fileName} (${sizeMB} MB, ${index.chunkCount} chunks)`);

      manifest.repos.push({
        name: `${repoConfig.owner}/${repoConfig.name}`,
        file: fileName,
        chunkCount: index.chunkCount,
        indexedAt: index.indexedAt,
      });
    } catch (error) {
      console.error(`\n❌ Failed to index ${repoConfig.owner}/${repoConfig.name}:`, error);
    }
  }

  // Save manifest
  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📋 Saved manifest.json`);

  console.log('\n🎉 Indexing complete!');
}

main().catch(console.error);
