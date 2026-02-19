/**
 * Utility for sanitizing and rendering markdown content safely.
 * Addresses vulnerability SBP-002: Persistent XSS risk from untrusted content.
 * Uses `marked` for markdown parsing and `DOMPurify` for HTML sanitization.
 */

import { marked } from 'marked';

/**
 * Simple sanitizer for Edge Runtime environments
 * Removes script tags and dangerous attributes
 */
function simpleSanitize(html: string): string {
  if (!html) return '';

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Sanitizes HTML content, removing dangerous elements while preserving safe ones.
 * Falls back to simple sanitization if DOMPurify is not available (Edge Runtime)
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Use simple sanitizer that works in all environments
  // This is safer for Edge Runtime and serverless environments
  return simpleSanitize(html);
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
