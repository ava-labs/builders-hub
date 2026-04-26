/**
 * Lazy registry of Avalanche Community Proposals (ACPs).
 *
 * The registry walks every page under /docs/acps, reads the markdown via the
 * fumadocs source loader, and caches parsed AcpEntry records for the lifetime
 * of the module. An optional in-process refresh helper is exposed for tests.
 */

import { documentation } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';
import { parseAcpDocument, type AcpEntry } from './parser';
import { filterAcps, type ListOptions } from './filter';

const ACP_URL_PREFIX = '/docs/acps';
const INDEX_PAGE_URL = `${ACP_URL_PREFIX}`;

let registryPromise: Promise<AcpEntry[]> | null = null;

function isAcpPage(url: string): boolean {
  if (!url.startsWith(ACP_URL_PREFIX)) return false;
  if (url === INDEX_PAGE_URL || url === `${ACP_URL_PREFIX}/`) return false;
  // Skip pages whose final segment does not start with a digit; the upstream
  // ACP repo uses `<number>-<slug>` for proposals, while sibling pages such
  // as /docs/acps/index do not.
  const segments = url.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return /^\d+/.test(last);
}

async function loadAcpEntry(page: { url: string }): Promise<AcpEntry | null> {
  try {
    const fullPage = page as { url: string; absolutePath?: string; data?: { getText?: (k: string) => Promise<string> } };
    const content = await getLLMText(fullPage as Parameters<typeof getLLMText>[0]);
    if (!content) return null;
    // parseAcpDocument now returns null when no ACP number can be derived; we propagate that
    // upward so the registry only contains real numbered ACPs.
    return parseAcpDocument(content, page.url);
  } catch (error) {
    console.error(`[mcp/acps] failed to load ${page.url}`, error);
    return null;
  }
}

async function buildRegistry(): Promise<AcpEntry[]> {
  const pages = documentation.getPages().filter((p) => isAcpPage(p.url));
  const entries = await Promise.all(pages.map((p) => loadAcpEntry(p)));
  return entries
    .filter((entry): entry is AcpEntry => entry !== null)
    .sort((a, b) => b.number - a.number);
}

export async function getAcpRegistry(): Promise<AcpEntry[]> {
  if (!registryPromise) {
    registryPromise = buildRegistry();
  }
  return registryPromise;
}

/**
 * Find a single ACP by its number. Useful for exact lookups in the
 * `acp_lookup` MCP tool.
 */
export async function findAcpByNumber(number: number): Promise<AcpEntry | undefined> {
  const registry = await getAcpRegistry();
  return registry.find((entry) => entry.number === number);
}

/**
 * List ACPs, optionally filtered by status and / or track. See `filterAcps`
 * in ./filter for the matching rules.
 */
export async function listAcps(options: ListOptions = {}): Promise<AcpEntry[]> {
  const registry = await getAcpRegistry();
  return filterAcps(registry, options);
}

/**
 * Reset the cached registry (test-only helper).
 */
export function __resetAcpRegistryForTests(): void {
  registryPromise = null;
}
