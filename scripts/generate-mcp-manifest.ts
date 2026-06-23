/**
 * Regenerate public/mcp-manifest.json from the live MCP tool surface.
 *
 * The manifest is documentation served at /mcp-manifest.json; the runtime builds
 * tools/list dynamically, so this reconciles the static manifest with the
 * actually-registered tools (killing the name/count drift). It reads the running
 * server's tools/list — start the dev server first:
 *
 *   npm run dev
 *   npx tsx scripts/generate-mcp-manifest.ts
 *   # or against a preview:  MCP_URL=https://<preview>/api/mcp VERCEL_BYPASS=<tok> npx tsx scripts/generate-mcp-manifest.ts
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000/api/mcp';
const VERSION = '2.4.0';

interface ListedTool {
  name: string;
  description: string;
}

async function main(): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.VERCEL_BYPASS) headers['x-vercel-protection-bypass'] = process.env.VERCEL_BYPASS;

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  const body = (await res.json()) as { result?: { tools?: ListedTool[] } };
  const tools = (body.result?.tools ?? []).map((t) => ({ name: t.name, description: t.description }));
  if (tools.length === 0) throw new Error(`no tools returned from ${MCP_URL} — is the server running?`);

  const manifest = {
    name: 'avalanche-mcp',
    version: VERSION,
    description:
      'Unified MCP server for Avalanche docs, CLI/RPC/ACP lookup, blockchain & P-Chain lookups, indexed on-chain data (Glacier + ClickHouse), build-plan runbooks, and Builder Console guidance.',
    endpoint: 'https://build.avax.network/api/mcp',
    protocol: 'mcp/http',
    readOnly: true,
    categories: ['documentation', 'blockchain', 'developer-tools', 'on-chain-data'],
    capabilities: { tools: true, resources: true, streamableHttp: true },
    canonicalTooling: {
      preferredDocsTools: ['docs_search', 'docs_fetch', 'docs_list_sections'],
      compatibilityAliases: ['avalanche_docs_search', 'avalanche_docs_fetch', 'avalanche_docs_list_sections'],
    },
    tools,
  };

  const out = join(process.cwd(), 'public', 'mcp-manifest.json');
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${tools.length} tools to ${out} (version ${VERSION})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
