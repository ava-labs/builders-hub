import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file is tests/e2e/embeds/embed-pages.ts. The repo root is three folders up.
// Read paths from this file, not from the cwd, so the list is the same wherever the runner starts.
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// The academy renderer gives these components to every academy page without an import line.
const ACADEMY_RENDERER = 'app/academy/[...slug]/page.tsx';

// The wrapper is page chrome, not a tool. A page with only the wrapper embeds no tool.
const WRAPPER_IMPORT = '@/components/toolbox/academy/wrapper/ToolboxMdxWrapper';

// A default import of a toolbox module: `import DeployICMDemo from "@/components/toolbox/..."`.
const TOOLBOX_IMPORT_RE = /^import\s+(\w+)\s+from\s+["'](@\/components\/toolbox\/[^"']+)["'];?/gm;

export interface EmbedPage {
  /** The site path, for example /academy/avalanche-l1/interchain-messaging/04-icm-setup/04-relayer-setup. */
  route: string;
  /** The MDX file, relative to the repo root. */
  file: string;
  /** The frontmatter title. The page shows it as its h1. */
  title: string | null;
  /** The toolbox components the page renders, by their MDX tag. */
  tools: string[];
}

/** Lists every .mdx file under a folder, sorted, so the test order is stable. */
function listMdxFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMdxFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

/** Reads the tags of the academy renderer's toolboxComponents map that point to a toolbox import. */
function academyGlobalTags(): string[] {
  const file = join(REPO_ROOT, ACADEMY_RENDERER);
  if (!existsSync(file)) return [];
  const source = readFileSync(file, 'utf8');
  const toolboxBindings = new Map<string, string>();
  for (const m of source.matchAll(TOOLBOX_IMPORT_RE)) toolboxBindings.set(m[1], m[2]);

  const map = source.match(/const\s+toolboxComponents\s*=\s*\{([\s\S]*?)\n\};/);
  if (!map) return [];
  const tags: string[] = [];
  for (const line of map[1].split('\n')) {
    // Two entry forms: `TestSend,` and `ConvertToL1: ConvertSubnetToL1,`.
    const entry = line.match(/^\s*(\w+)\s*(?::\s*(\w+)\s*)?,?\s*$/);
    if (!entry) continue;
    const [, tag, binding = tag] = entry;
    const importPath = toolboxBindings.get(binding);
    if (importPath && !importPath.startsWith(WRAPPER_IMPORT)) tags.push(tag);
  }
  return tags;
}

/** Every name the MDX file imports itself. A local import hides the global component of the same name. */
function importedBindings(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(/^import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+["'][^"']+["'];?/gm)) {
    if (m[1]) names.add(m[1]);
    for (const part of m[2]?.split(',') ?? []) {
      const named = part.trim().match(/^(?:\w+\s+as\s+)?(\w+)$/);
      if (named) names.add(named[1]);
    }
  }
  return names;
}

/** Removes fenced and inline code, so an example snippet does not count as a rendered tag. */
function stripCode(source: string): string {
  return source.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function frontmatterTitle(source: string): string | null {
  const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = fm?.[1].match(/^title:\s*(.+?)\s*$/m);
  if (!line) return null;
  const title = line[1];
  const quoted = /^(["']).*\1$/.test(title);
  return quoted ? title.slice(1, -1) : title;
}

/** content/academy/a/b.mdx is /academy/a/b. An index.mdx is the route of its folder. */
function routeOf(file: string): string {
  const rel = relative(join(REPO_ROOT, 'content'), file).split('\\').join('/');
  return ('/' + rel.replace(/\.mdx$/, '')).replace(/\/index$/, '');
}

function scan(subdir: 'academy' | 'docs', globalTags: string[]): EmbedPage[] {
  const pages: EmbedPage[] = [];
  for (const file of listMdxFiles(join(REPO_ROOT, 'content', subdir))) {
    const source = readFileSync(file, 'utf8');
    const tools: string[] = [];
    for (const m of source.matchAll(TOOLBOX_IMPORT_RE)) {
      if (!m[2].startsWith(WRAPPER_IMPORT)) tools.push(m[1]);
    }
    // The global map exists only in the academy renderer.
    if (subdir === 'academy') {
      const imported = importedBindings(source);
      const body = stripCode(source);
      for (const tag of globalTags) {
        if (!imported.has(tag) && new RegExp(`<${tag}[\\s/>]`).test(body)) tools.push(tag);
      }
    }
    if (tools.length === 0) continue;
    pages.push({
      route: routeOf(file),
      file: relative(REPO_ROOT, file).split('\\').join('/'),
      title: frontmatterTitle(source),
      tools,
    });
  }
  return pages;
}

/**
 * Every academy and docs page that embeds a console tool, read from the MDX at collection time.
 * The same rules as scripts/lib/qa-surfaces.mts (scripts/check-academy-embeds.mts).
 * It uses Node fs only, because the CI job does not install the repo's node_modules.
 */
export function findEmbedPages(): EmbedPage[] {
  if (!statSync(join(REPO_ROOT, 'content'), { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`content/ not found under ${REPO_ROOT}`);
  }
  const globalTags = academyGlobalTags();
  return [...scan('academy', globalTags), ...scan('docs', [])].sort((a, b) => a.route.localeCompare(b.route));
}
