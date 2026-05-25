import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { SourceAnchor } from './types';

const CONTENT_ROOT = path.join(process.cwd(), 'content');

export interface LoadedSource {
  anchor: SourceAnchor;
  frontmatter: Record<string, unknown>;
  markdown: string;
  wordCount: number;
}

/**
 * Resolve a fumadocs URL path back to an MDX file on disk.
 *
 * Chapter URLs map to `<path>.mdx`. Course-root URLs (e.g.
 * `/academy/avalanche-l1/avalanche-fundamentals`) map to `<path>/index.mdx`.
 *
 * Examples:
 *   `/academy/blockchain/blockchain-fundamentals/02-what-is-a-blockchain/03-decentralized-applications`
 *     -> content/academy/blockchain/blockchain-fundamentals/02-what-is-a-blockchain/03-decentralized-applications.mdx
 *   `/docs/cross-chain/icm/overview`
 *     -> content/docs/cross-chain/icm/overview.mdx
 *   `/academy/avalanche-l1/avalanche-fundamentals`
 *     -> content/academy/avalanche-l1/avalanche-fundamentals/index.mdx
 */
export function resolveMdxPath(anchor: SourceAnchor): string {
  const trimmed = anchor.path.replace(/^\/+/, '').replace(/\/+$/, '');
  const direct = path.join(CONTENT_ROOT, `${trimmed}.mdx`);
  if (existsSync(direct)) return direct;
  const indexed = path.join(CONTENT_ROOT, trimmed, 'index.mdx');
  if (existsSync(indexed)) return indexed;
  throw new Error(`No MDX file found for source "${anchor.path}" (tried ${path.relative(process.cwd(), direct)} and ${path.relative(process.cwd(), indexed)})`);
}

const IMPORT_RE = /^\s*import\s+[^;]+?;?\s*$/gm;
const SELF_CLOSING_JSX_RE = /<([A-Z][A-Za-z0-9]*)\b[^>]*\/>/g;
const PAIRED_JSX_RE = /<([A-Z][A-Za-z0-9]*)\b[^>]*>[\s\S]*?<\/\1>/g;
const JSX_EXPR_RE = /\{\s*\/\*[\s\S]*?\*\/\s*\}/g;
const MULTI_BLANK_RE = /\n{3,}/g;

/**
 * Remove MDX-only constructs (imports, capitalized JSX elements, JSX comments)
 * while preserving prose, code blocks, lists, and markdown links. Idempotent.
 */
export function stripMdx(body: string): string {
  let out = body.replace(IMPORT_RE, '');
  // Apply paired before self-closing so we strip whole component trees first.
  for (let i = 0; i < 3; i++) {
    const next = out.replace(PAIRED_JSX_RE, '');
    if (next === out) break;
    out = next;
  }
  out = out.replace(SELF_CLOSING_JSX_RE, '');
  out = out.replace(JSX_EXPR_RE, '');
  out = out.replace(MULTI_BLANK_RE, '\n\n');
  return out.trim();
}

function countWords(text: string): number {
  const matches = text.match(/\b\w+\b/g);
  return matches ? matches.length : 0;
}

export async function loadSource(anchor: SourceAnchor): Promise<LoadedSource> {
  const filePath = resolveMdxPath(anchor);
  const raw = await readFile(filePath, 'utf8');
  const parsed = matter(raw);
  const markdown = stripMdx(parsed.content);
  return {
    anchor,
    frontmatter: parsed.data,
    markdown,
    wordCount: countWords(markdown),
  };
}

export async function loadSources(anchors: SourceAnchor[]): Promise<LoadedSource[]> {
  return Promise.all(anchors.map((a) => loadSource(a)));
}

/**
 * Approximate token budget per source (claude tokens ≈ words * 1.3).
 * Used by the prompt builder to decide chunking.
 */
export function estimateTokens(markdown: string): number {
  return Math.ceil(countWords(markdown) * 1.3);
}
