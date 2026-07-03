/**
 * QA Surface Manifest Generator
 *
 * Enumerates every user-facing surface the Academy/Console QA harness can
 * exercise and writes a deterministic manifest to e2e/qa-manifest.json:
 *
 *   - academy-page: content/academy MDX pages embedding console toolbox tools
 *     (route = /academy/<path minus content/academy + .mdx>; numeric prefixes
 *     stay in the URL — see scripts/lib/qa-surfaces.mts for the evidence)
 *   - docs-page: same scan over content/docs
 *   - console-tool: every non-external entry (and sub-step) in the console
 *     tool registry, components/toolbox/console/toolbox/tools.ts — the same
 *     source of truth the console sidebar + toolbox grid render from
 *
 * Tool imports are resolved against the tsconfig "@/*" -> "./*" mapping
 * (exact, +.tsx, +.ts, +/index.tsx, +/index.ts) and flagged exists: true/false.
 * Surfaces are stably sorted by kind then route so JSON diffs stay reviewable.
 *
 * Run: yarn qa:manifest  (npx tsx ./scripts/generate-qa-manifest.mts)
 */

import * as fs from 'fs';
import * as path from 'path';
import { REPO_ROOT, scanContentMdx, type MdxScanResult } from './lib/qa-surfaces.mts';

// The academy wrapper is page chrome, not a tool — keep it out of the tools
// list (check-academy-embeds still validates its import resolution).
const WRAPPER_IMPORT_PREFIX = '@/components/toolbox/academy/wrapper/ToolboxMdxWrapper';

interface ManifestTool {
  name: string;
  importPath: string;
  resolved: string | null;
  exists: boolean;
}

interface ManifestSurface {
  kind: 'academy-page' | 'docs-page' | 'console-tool';
  route: string;
  file: string | null;
  title: string | null;
  walletMode?: string | null;
  tools?: ManifestTool[];
}

function mdxSurfaces(kind: 'academy-page' | 'docs-page', scans: MdxScanResult[]): ManifestSurface[] {
  const surfaces: ManifestSurface[] = [];
  for (const scan of scans) {
    const tools: ManifestTool[] = scan.tools
      .filter((t) => !t.importPath.startsWith(WRAPPER_IMPORT_PREFIX))
      .map(({ name, importPath, resolved, exists }) => ({ name, importPath, resolved, exists }));
    if (tools.length === 0) continue; // wrapper-only pages embed no tools
    surfaces.push({
      kind,
      route: scan.route,
      file: scan.file,
      title: scan.title,
      walletMode: scan.walletMode,
      tools,
    });
  }
  return surfaces;
}

/**
 * Map a /console/... route to its Next.js page file under app/console.
 * Prefers exact segment directories, falling back to a single dynamic
 * [param] directory (e.g. /console/icm/setup/teleporter-registry ->
 * app/console/icm/setup/[step]/page.tsx).
 */
function resolveConsolePageFile(route: string): string | null {
  const segments = route.replace(/^\/console\/?/, '').split('/').filter(Boolean);
  let dir = path.join(REPO_ROOT, 'app', 'console');
  for (const segment of segments) {
    const exact = path.join(dir, segment);
    if (fs.existsSync(exact) && fs.statSync(exact).isDirectory()) {
      dir = exact;
      continue;
    }
    const dynamic = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\[.+\]$/.test(e.name))
      .map((e) => e.name)
      .sort();
    if (dynamic.length === 0) return null;
    dir = path.join(dir, dynamic[0]);
  }
  for (const pageName of ['page.tsx', 'page.mdx', 'page.ts']) {
    const page = path.join(dir, pageName);
    if (fs.existsSync(page)) return path.relative(REPO_ROOT, page).replace(/\\/g, '/');
  }
  return null;
}

async function consoleSurfaces(): Promise<ManifestSurface[]> {
  // tools.ts is the registry both the sidebar search index and the toolbox
  // grid render from (imported there as ALL_CONSOLE_TOOLS / TOOLS).
  // Dynamic import + interop fallback: tsx loads this CJS-transpiled module
  // without static named-export detection.
  const mod: any = await import('../components/toolbox/console/toolbox/tools');
  const TOOLS: any[] = mod.TOOLS ?? mod.default?.TOOLS ?? mod['module.exports']?.TOOLS;
  if (!Array.isArray(TOOLS)) {
    throw new Error('Could not load TOOLS from components/toolbox/console/toolbox/tools.ts');
  }

  const surfaces: ManifestSurface[] = [];
  for (const tool of TOOLS) {
    if (tool.external || !tool.path?.startsWith('/console')) continue;
    surfaces.push({
      kind: 'console-tool',
      route: tool.path,
      file: resolveConsolePageFile(tool.path),
      title: tool.name,
    });
    for (const step of tool.subSteps ?? []) {
      if (!step.path?.startsWith('/console')) continue;
      surfaces.push({
        kind: 'console-tool',
        route: step.path,
        file: resolveConsolePageFile(step.path),
        title: `${tool.name} › ${step.name}`,
      });
    }
  }
  return surfaces;
}

async function main() {
  const surfaces: ManifestSurface[] = [
    ...mdxSurfaces('academy-page', scanContentMdx('academy')),
    ...mdxSurfaces('docs-page', scanContentMdx('docs')),
    ...(await consoleSurfaces()),
  ];

  // Stable order: kind, then route, then file — keeps diffs reviewable.
  const kindOrder = { 'academy-page': 0, 'docs-page': 1, 'console-tool': 2 } as const;
  surfaces.sort(
    (a, b) =>
      kindOrder[a.kind] - kindOrder[b.kind] ||
      a.route.localeCompare(b.route) ||
      (a.file ?? '').localeCompare(b.file ?? ''),
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    surfaces,
  };

  const outDir = path.join(REPO_ROOT, 'e2e');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'qa-manifest.json');
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n');

  const counts = surfaces.reduce<Record<string, number>>((acc, s) => {
    acc[s.kind] = (acc[s.kind] ?? 0) + 1;
    return acc;
  }, {});
  const unresolved = surfaces.flatMap((s) => (s.tools ?? []).filter((t) => !t.exists));
  console.log(`Wrote ${path.relative(REPO_ROOT, outFile)}: ${surfaces.length} surfaces`, counts);
  if (unresolved.length > 0) {
    console.warn(`Warning: ${unresolved.length} unresolved tool import(s) — run scripts/check-academy-embeds.mts for details`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
