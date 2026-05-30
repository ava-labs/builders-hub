/**
 * Pure search utilities (chunking, normalization, scoring, excerpt extraction).
 *
 * Kept dependency-free so tests can import these helpers without pulling in
 * fumadocs source loaders.
 */

export const CHUNK_WORDS = 180;
export const CHUNK_OVERLAP_WORDS = 35;

// ---------------------------------------------------------------------------
// Reflection sanitization — applied to text that flows from docs/ACP content
// to AI clients. Even though the docs corpus is mostly maintainer-controlled,
// ACP markdown comes from an upstream community repo and external doc PRs
// land regularly, so we neutralize the most common prompt-injection vectors.
// ---------------------------------------------------------------------------

// Zero-width / bidi characters used to hide text or alter rendering order:
//   U+200B-U+200D zero-width space/joiner/non-joiner
//   U+200E-U+200F LTR/RTL marks
//   U+202A-U+202E embedding/override
//   U+2060        word joiner
//   U+2061-U+2064 invisible operators
//   U+FEFF        zero-width no-break space (BOM)
const ZERO_WIDTH_REGEX = /[​-‏‪-‮⁠-⁤﻿]/g;
// ASCII control chars (excluding \t, \n, \r which we want to preserve in excerpts).
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
// Markdown links pointing at dangerous URL schemes. Replace with the link text only.
// Use [^\s]* greedy so nested parens inside the URL (e.g. javascript:alert(1)) are consumed
// up to the final closing paren before whitespace.
const DANGEROUS_LINK_REGEX = /\[([^\]]*)\]\(\s*(?:javascript|data|vbscript|file):[^\s]*\)/gi;
// Bare dangerous URLs (not wrapped in markdown link syntax) — neutralize the scheme.
const BARE_DANGEROUS_SCHEME_REGEX = /\b(?:javascript|data|vbscript|file):/gi;

export function sanitizeForReflection(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(DANGEROUS_LINK_REGEX, '$1')
    .replace(BARE_DANGEROUS_SCHEME_REGEX, '[blocked-scheme]:');
}

/**
 * Allowlist URL filter — returns the URL only if it points at http(s) or an
 * internal site path. Anything else (javascript:, data:, file:, mailto:, etc.)
 * is rejected.
 */
export function sanitizeUrl(url: string | undefined): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return undefined;
}

export function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function tokenizeQuery(query: string): string[] {
  return normalizeForSearch(query)
    .split(/[^a-z0-9_/-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

export function splitIntoChunks(content: string): string[] {
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
    // Skip producing a tail chunk that is fully covered by the previous window.
    // (E.g., for `words.length = step + k` with `k <= CHUNK_OVERLAP_WORDS`.)
    if (start + step + CHUNK_OVERLAP_WORDS >= words.length) break;
  }

  return chunks;
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;

  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
}

export interface ScorableChunk {
  url: string;
  title: string;
  description?: string;
  normalizedText: string;
}

export function scoreChunk(
  chunk: ScorableChunk,
  normalizedQuery: string,
  queryTerms: string[]
): number {
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

export function makeExcerpt(text: string, normalizedQuery: string, queryTerms: string[]): string {
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

  // Neutralize prompt-injection vectors (zero-width unicode, dangerous URL schemes)
  // before the excerpt flows into AI client context.
  return sanitizeForReflection(`${prefix}${collapsed.slice(start, end)}${suffix}`);
}

export function matchesPathPrefix(url: string, pathPrefixes?: string[]): boolean {
  if (!pathPrefixes || pathPrefixes.length === 0) return true;
  return pathPrefixes.some((prefix) => url.startsWith(prefix));
}
