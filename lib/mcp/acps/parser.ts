/**
 * Structured parser for Avalanche Community Proposal (ACP) markdown documents.
 *
 * ACP source files live under content/docs/acps/*.mdx. Each file follows the
 * upstream `avalanche-foundation/ACPs` README format: a frontmatter block plus
 * a leading metadata table that exposes ACP number, title, authors, status,
 * track, and optional cross-references (Replaces / Superseded-By / Updates /
 * Updated-By).
 *
 * This module turns the raw markdown into a typed record so AI clients can
 * filter and answer ACP questions without re-parsing markdown each call.
 */

export const ACP_STATUSES = [
  'Proposed',
  'Implementable',
  'Activated',
  'Stale',
  'Withdrawn',
] as const;

export type AcpStatus = (typeof ACP_STATUSES)[number] | 'Unknown';

export interface AcpEntry {
  number: number;
  title: string;
  status: AcpStatus;
  rawStatus: string;
  tracks: string[];
  authors: string[];
  replaces?: number[];
  supersededBy?: number[];
  updates?: number[];
  updatedBy?: number[];
  description?: string;
  discussionUrl?: string;
  url: string;
}

const STATUS_LOOKUP: Record<string, AcpStatus> = {
  proposed: 'Proposed',
  implementable: 'Implementable',
  activated: 'Activated',
  stale: 'Stale',
  withdrawn: 'Withdrawn',
};

export function normalizeStatus(value: string): AcpStatus {
  const lower = value.toLowerCase().trim();
  if (!lower) return 'Unknown';
  for (const [key, status] of Object.entries(STATUS_LOOKUP)) {
    if (lower.startsWith(key)) return status;
  }
  return 'Unknown';
}

export function normalizeTracks(value: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().replace(/\s+Track$/i, ''))
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripFrontmatter(content: string): { body: string; frontmatter: Record<string, string> } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { body: content, frontmatter: {} };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim().replace(/^"|"$/g, '');
    if (key) frontmatter[key] = value;
  }

  return { body: content.slice(match[0].length), frontmatter };
}

function parseTableRows(body: string): Map<string, string> {
  const rows = new Map<string, string>();
  const lines = body.split('\n');

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    if (/^\|[\s:|-]+\|/.test(line)) continue; // separator row

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;

    const key = cells[0].replace(/\*\*/g, '').replace(/[:\s]+$/, '').trim().toLowerCase();
    const value = cells.slice(1).join(' | ').trim();
    if (key && !rows.has(key)) rows.set(key, value);
  }

  return rows;
}

function parseAcpReferences(value: string): number[] {
  if (!value) return [];
  const numbers: number[] = [];
  const seen = new Set<number>();

  const matches = value.matchAll(/ACP-?(\d+)/gi);
  for (const match of matches) {
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && !seen.has(n)) {
      seen.add(n);
      numbers.push(n);
    }
  }

  return numbers;
}

function parseAuthors(value: string): string[] {
  if (!value) return [];
  // Author names appear before any handle/link metadata, which begins with
  // either '(' (e.g. "(@handle)") or '[' (e.g. "[github.com/...]").
  return value
    .split(',')
    .map((part) => part.split(/[(\[]/)[0].replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseDiscussionUrl(value: string): string | undefined {
  const match = value.match(/Discussion\]\(([^)]+)\)/i);
  return match ? match[1] : undefined;
}

function parseAcpNumberFromUrl(url: string): number | undefined {
  const match = url.match(/\/(\d+)-/);
  if (!match) return undefined;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseAcpNumberFromTitle(title: string | undefined): number | undefined {
  if (!title) return undefined;
  const match = title.match(/ACP-?(\d+)/i);
  if (!match) return undefined;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseTitleFromFrontmatter(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const stripped = title.replace(/^ACP-?\d+:\s*/i, '').trim();
  return stripped || undefined;
}

/**
 * Parse an ACP markdown document into a structured record.
 *
 * The parser is tolerant of small formatting variations (extra spaces,
 * variable separator widths, missing optional fields). When fields cannot
 * be derived from the body, it falls back to the frontmatter or URL.
 */
export function parseAcpDocument(content: string, url: string): AcpEntry {
  const { body, frontmatter } = stripFrontmatter(content);
  const rows = parseTableRows(body);

  const tableNumber = rows.get('acp');
  const number =
    (tableNumber ? Number.parseInt(tableNumber, 10) : Number.NaN) ||
    parseAcpNumberFromTitle(frontmatter.title) ||
    parseAcpNumberFromUrl(url) ||
    0;

  const tableTitle = rows.get('title');
  const title = tableTitle || parseTitleFromFrontmatter(frontmatter.title) || 'Untitled ACP';

  const rawStatus = rows.get('status') || '';
  const status = normalizeStatus(rawStatus);

  const trackValue = rows.get('track') || '';
  const tracks = normalizeTracks(trackValue);

  const authors = parseAuthors(rows.get('author(s)') || rows.get('authors') || '');

  const replaces = parseAcpReferences(rows.get('replaces') || '');
  const supersededBy = parseAcpReferences(rows.get('superseded-by') || rows.get('superseded by') || '');
  const updates = parseAcpReferences(rows.get('updates') || '');
  const updatedBy = parseAcpReferences(rows.get('updated-by') || rows.get('updated by') || '');

  const entry: AcpEntry = {
    number,
    title,
    status,
    rawStatus,
    tracks,
    authors,
    description: frontmatter.description,
    discussionUrl: parseDiscussionUrl(rawStatus),
    url,
  };

  if (replaces.length > 0) entry.replaces = replaces;
  if (supersededBy.length > 0) entry.supersededBy = supersededBy;
  if (updates.length > 0) entry.updates = updates;
  if (updatedBy.length > 0) entry.updatedBy = updatedBy;

  return entry;
}
