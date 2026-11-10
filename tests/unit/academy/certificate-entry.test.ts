import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getCourseConfig } from '@/content/courses';
import { certificateCourseName, certificateEntryId } from '@/lib/academy/certificate-entry';
import { getCourseOutlines } from '@/lib/academy/course-outline';
import { loadAcademyTree } from './helpers/content-tree';

const CONTENT = fileURLToPath(new URL('../../../content/academy/', import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]));

describe('certificateEntryId', () => {
  it('matches the courseId of every <CertificatePage> in content/academy, and each has a template', () => {
    const pages = files(CONTENT)
      .filter((f) => f.endsWith('.mdx'))
      .map((f) => ({ url: `/academy/${relative(CONTENT, f).replace(/\.mdx$/, '')}`, id: /<CertificatePage courseId="([^"]+)"/.exec(readFileSync(f, 'utf8'))?.[1] }))
      .filter((p): p is { url: string; id: string } => Boolean(p.id));
    expect(pages.length).toBeGreaterThan(0);
    for (const { url, id } of pages) {
      expect(certificateEntryId(url.split('/')[3], url), url).toBe(id);
      expect(getCourseConfig()[id], id).toBeDefined();
    }
  });
});

describe('certificateCourseName', () => {
  const outlines = getCourseOutlines(loadAcademyTree());
  const bySlug = (slug: string) => outlines.find((o) => o.slug === slug)!;

  it('prints the content/courses.tsx name, not the sidebar folder title', () => {
    expect(certificateCourseName(bySlug('solidity-foundry'))).toBe('Solidity Programming with Foundry');
    expect(certificateCourseName(bySlug('erc20-bridge'))).toBe('ERC-20 to ERC-20 Bridge');
    expect(certificateCourseName(bySlug('encrypted-erc'))).toBe('Encrypted ERC');
  });

  it("names Access Restriction's first certificate entry, and nothing for Team1", () => {
    expect(certificateCourseName(bySlug('access-restriction'))).toBe('Access Restriction Fundamentals');
    expect(certificateCourseName(bySlug('team1-fundamentals'))).toBeNull();
  });
});
