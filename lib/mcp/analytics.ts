/**
 * Analytics helpers for MCP server events.
 * Wraps PostHog captureServerEvent with MCP-specific defaults.
 */

import { captureServerEvent } from '@/lib/posthog-server';

const MAX_TRACKED_STRING_LENGTH = 100;

/**
 * Truncate a string for analytics tracking (avoids large payloads).
 */
export function truncateForTracking(str: string, maxLen = MAX_TRACKED_STRING_LENGTH): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Sanitize an error for analytics (removes potentially sensitive info).
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown error';
  const name = error.name || 'Error';
  const message = truncateForTracking(error.message);
  return `${name}: ${message}`;
}

/**
 * Capture an MCP-specific event to PostHog.
 * Intentionally fire-and-forget so analytics never blocks MCP responses.
 */
export function captureMCPEvent(
  event: string,
  properties: Record<string, unknown>
): void {
  void captureServerEvent(event, { ...properties, source: 'mcp-server' }, 'mcp_server');
}
