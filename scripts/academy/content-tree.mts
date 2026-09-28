import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loader } from 'fumadocs-core/source';
import type { Root } from 'fumadocs-core/page-tree';

// The real academy.pageTree (lib/source.ts:91-98) imports the generated .source module, which
// imports every MDX file and cannot load under Vitest. This rebuilds the same tree from
// content/academy with fumadocs-core's own loader and page-tree builder: meta.json files as they
// are, pages with their frontmatter title (every academy page has one single-line title).
const CONTENT = fileURLToPath(new URL('../../content/academy/', import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

function frontmatterTitle(source: string): string | undefined {
  const end = source.indexOf('\n---', 3);
  const match = /^title:\s*(.*)$/m.exec(source.startsWith('---') && end > 0 ? source.slice(3, end) : '');
  const value = match?.[1].trim();
  return value?.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

export function loadAcademyTree(): Root {
  const files = filesUnder(CONTENT)
    .filter((file) => file.endsWith('.mdx') || file.endsWith('meta.json'))
    .map((file) => {
      const path = relative(CONTENT, file);
      const raw = readFileSync(file, 'utf8');
      return file.endsWith('.json')
        ? { type: 'meta' as const, path, data: JSON.parse(raw) }
        : { type: 'page' as const, path, data: { title: frontmatterTitle(raw) } };
    });
  return loader({ baseUrl: '/academy', source: { files } }).pageTree;
}
