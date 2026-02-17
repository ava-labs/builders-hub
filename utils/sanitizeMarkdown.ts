/**
 * Utility for sanitizing and rendering markdown content safely.
 * Addresses vulnerability SBP-002: Persistent XSS risk from untrusted content.
 * Uses `marked` for markdown parsing and `DOMPurify` for HTML sanitization.
 */

import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Configure DOMPurify to allow safe HTML elements
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'a', 'img',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'target', 'rel',
  'width', 'height',
];

/**
 * Sanitizes HTML content, removing dangerous elements while preserving safe ones.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'], // Allow target="_blank" on links
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}

/**
 * Converts markdown to safe HTML.
 * Parses markdown with `marked`, then sanitizes with DOMPurify.
 */
export function markdownToSafeHtml(text: string): string {
  if (!text) return '';
  
  // Parse markdown to HTML
  const html = marked.parse(text, {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;
  
  // Sanitize the resulting HTML
  return sanitizeHtml(html);
}
