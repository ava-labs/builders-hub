/**
 * Utility for sanitizing and rendering markdown content safely.
 * Uses `marked` for markdown parsing and `sanitize-html` for HTML sanitization
 * with a strict allowlist. This replaces the previous regex-based approach,
 * which was bypassable via HTML-entity-encoded protocol schemes (e.g. java&#x09;script:).
 */

import { marked } from 'marked';
import sanitizeHtmlLib from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    'a', 'b', 'blockquote', 'br', 'code', 'div', 'em',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
    'li', 'ol', 'p', 'pre', 'span', 'strong',
    'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'code': ['class'],
    'pre': ['class'],
    'span': ['class'],
    'div': ['class'],
    'td': ['align'],
    'th': ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {},
  // sanitize-html parses and re-serializes, so entity-encoded protocol bypasses
  // (java&#x09;script:) are decoded and caught before the scheme check.
};

/**
 * Sanitizes HTML content, removing dangerous elements while preserving safe ones.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return sanitizeHtmlLib(html, SANITIZE_OPTIONS);
}

/**
 * Converts markdown to safe HTML.
 * Parses markdown with `marked`, then sanitizes with sanitize-html.
 */
export function markdownToSafeHtml(text: string): string {
  if (!text) return '';

  const html = marked.parse(text, {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;

  return sanitizeHtml(html);
}
