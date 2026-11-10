import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Root-relative images in the Academy's MDX are imported and re-emitted as hashed media files that
// keep the source file name. Vercel's static layer reads a literal "+" in such a path as a space, so
// its image optimizer rejects the image (400) while the dev server still shows it; spaces, "%", "#"
// and "?" break the same URLs.
const CONTENT = fileURLToPath(new URL('../../../content/academy/', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../../../public/', import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]));

const IMAGE_REF = /!\[[^\]]*\]\((\/[^)\s]+)\)|<img\b[^>]*\bsrc="(\/[^"]+)"/g;
const refs = files(CONTENT)
  .filter((file) => file.endsWith('.mdx'))
  .flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(IMAGE_REF)].map((match) => ({
      page: relative(CONTENT, file),
      path: match[1] ?? match[2],
    })),
  );
const isFile = (path: string): boolean => {
  try {
    return statSync(join(PUBLIC, path)).isFile();
  } catch {
    return false;
  }
};

describe('root-relative images in content/academy', () => {
  it('finds image references to check', () => {
    expect(refs.length).toBeGreaterThan(0);
  });

  it('point at files that exist under public/', () => {
    expect(refs.filter((ref) => !isFile(ref.path)).map((ref) => `${ref.page}: ${ref.path}`)).toEqual([]);
  });

  it('use file names Vercel can serve through its image optimizer', () => {
    expect(refs.filter((ref) => /[+ %#?]/.test(ref.path)).map((ref) => `${ref.page}: ${ref.path}`)).toEqual([]);
  });
});
