/**
 * Shared helpers for the Academy/Console QA harness scripts.
 *
 * Provides MDX scanning + toolbox import resolution used by:
 *   - scripts/generate-qa-manifest.mts   (writes e2e/qa-manifest.json)
 *   - scripts/check-academy-embeds.mts   (tier-1 CI integrity check)
 *
 * Route mapping evidence:
 *   - lib/source.ts: `academy` loader has baseUrl '/academy' and sources
 *     content/academy (source.config.ts `course` collection, dir 'content/academy');
 *     `documentation` loader has baseUrl '/docs' and sources content/docs.
 *   - Fumadocs default slugs keep the file path verbatim (numeric prefixes
 *     like 05-testing-icm stay in the URL), confirmed against the live URL
 *     /academy/avalanche-l1/interchain-messaging/05-testing-icm/01-deploy-icm-demo.
 *     `index.mdx` maps to the parent directory route.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// scripts/lib/ -> repo root
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface ToolboxImport {
  /** Local (default-import) binding name, e.g. "DeployICMDemo". */
  name: string;
  /** Import specifier as written in the MDX, e.g. "@/components/toolbox/...". */
  importPath: string;
  /** Repo-relative resolved file, e.g. "components/toolbox/.../DeployICMDemo.tsx" (best candidate if unresolved). */
  resolved: string | null;
  exists: boolean;
  /** 1-based line of the import statement in the MDX source. */
  line: number;
}

/** Recursively list all .mdx files under an absolute directory (sorted, deterministic). */
export function listMdxFiles(absDir: string): string[] {
  if (!fs.existsSync(absDir)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.mdx')) out.push(full);
    }
  };
  walk(absDir);
  return out;
}

/**
 * Resolve an `@/...` import specifier against the tsconfig path mapping
 * ("@/*" -> "./*", see tsconfig.json). Tries, in order:
 * exact, +.tsx, +.ts, +/index.tsx, +/index.ts.
 */
export function resolveAliasImport(importPath: string): { resolved: string | null; exists: boolean } {
  const rel = importPath.replace(/^@\//, '');
  const candidates = [rel, `${rel}.tsx`, `${rel}.ts`, `${rel}/index.tsx`, `${rel}/index.ts`];
  for (const candidate of candidates) {
    const abs = path.join(REPO_ROOT, candidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return { resolved: candidate, exists: true };
    }
  }
  // Best-guess candidate for error reporting: bare path + .tsx
  return { resolved: null, exists: false };
}

const TOOLBOX_IMPORT_RE =
  /^import\s+(\w+)\s+from\s+["'](@\/components\/toolbox\/[^"']+)["'];?/gm;

/** Extract all default imports of components/toolbox modules from MDX source. */
export function extractToolboxImports(source: string): ToolboxImport[] {
  const imports: ToolboxImport[] = [];
  for (const match of source.matchAll(TOOLBOX_IMPORT_RE)) {
    const [, name, importPath] = match;
    const line = source.slice(0, match.index).split('\n').length;
    const { resolved, exists } = resolveAliasImport(importPath);
    imports.push({ name, importPath, resolved, exists, line });
  }
  return imports;
}

/** Parse the frontmatter `title:` value (handles bare, single- and double-quoted). */
export function parseFrontmatterTitle(source: string): string | null {
  const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const titleLine = fm[1].match(/^title:\s*(.+)\s*$/m);
  if (!titleLine) return null;
  let title = titleLine[1].trim();
  if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
    title = title.slice(1, -1);
  }
  return title;
}

/** Parse walletMode from a <ToolboxMdxWrapper walletMode="..."> usage, if any. */
export function parseWalletMode(source: string): string | null {
  const match = source.match(/<ToolboxMdxWrapper[^>]*\bwalletMode=["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * Map a content MDX file to its route.
 * content/academy/a/b.mdx -> /academy/a/b ; content/docs/a/index.mdx -> /docs/a
 * (see route mapping evidence in the header comment).
 */
export function mdxRoute(absFile: string): string {
  const rel = path.relative(REPO_ROOT, absFile).replace(/\\/g, '/');
  let route = '/' + rel.replace(/^content\//, '').replace(/\.mdx$/, '');
  route = route.replace(/\/index$/, '');
  return route;
}

export interface MdxScanResult {
  /** Repo-relative file path. */
  file: string;
  route: string;
  title: string | null;
  walletMode: string | null;
  tools: ToolboxImport[];
}

/** Scan every .mdx under content/<subdir> and report toolbox imports per file. */
export function scanContentMdx(subdir: string): MdxScanResult[] {
  const results: MdxScanResult[] = [];
  for (const absFile of listMdxFiles(path.join(REPO_ROOT, 'content', subdir))) {
    const source = fs.readFileSync(absFile, 'utf8');
    const tools = extractToolboxImports(source);
    if (tools.length === 0) continue;
    results.push({
      file: path.relative(REPO_ROOT, absFile).replace(/\\/g, '/'),
      route: mdxRoute(absFile),
      title: parseFrontmatterTitle(source),
      walletMode: parseWalletMode(source),
      tools,
    });
  }
  return results;
}
