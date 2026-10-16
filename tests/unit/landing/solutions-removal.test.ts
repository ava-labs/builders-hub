import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// next.config.mjs wraps its config in fumadocs-mdx's createMDX; the redirects are plain data under it.
vi.mock('fumadocs-mdx/next', () => ({ createMDX: () => (config: unknown) => config }));

import nextConfig from '@/next.config.mjs';
import { firstRedirect, type RedirectRule } from '../academy/helpers/redirects';

const ROOT = process.cwd();
const redirects = (await nextConfig.redirects!()) as RedirectRule[];

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) =>
    statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)],
  );

describe('Solutions removal', () => {
  it.each([
    ['/solutions', '/docs/avalanche-l1s'],
    ['/solutions/interoperability', '/docs/cross-chain'],
    ['/solutions/performance', '/docs/primary-network/avalanche-consensus'],
    ['/solutions/privacy', '/docs/avalanche-l1s#control-privacy-of-on-chain-data'],
    ['/solutions/compliance', '/docs/avalanche-l1s#launch-networks-designed-with-compliance'],
  ])('%s redirects for good to %s', (path, destination) => {
    expect(firstRedirect(redirects, path)).toMatchObject({ destination, permanent: true });
  });

  it('redirects only the removed pages, so a later route under /solutions stays', () => {
    expect(firstRedirect(redirects, '/solutions/patterns/external-evm-icm')).toBeUndefined();
  });

  it('sends each visitor to a docs page that exists, and to a section of it that exists', () => {
    for (const path of ['/solutions', '/solutions/privacy', '/solutions/compliance']) {
      const [page, section] = firstRedirect(redirects, path)!.destination.split('#');
      const mdx = readFileSync(join(ROOT, 'content', `${page.replace(/^\//, '')}/index.mdx`), 'utf8');
      if (!section) continue;
      // fumadocs makes a heading id from its lower-case words joined by hyphens.
      const ids = [...mdx.matchAll(/^#+ (.+)$/gm)].map((m) => m[1].toLowerCase().replace(/\s+/g, '-'));
      expect(ids, path).toContain(section);
    }
    for (const page of ['cross-chain', 'primary-network/avalanche-consensus']) {
      const dir = join(ROOT, 'content/docs', page);
      expect(existsSync(`${dir}.mdx`) || existsSync(join(dir, 'index.mdx')), page).toBe(true);
    }
  });

  it('has no pages, routes, components or media left', () => {
    for (const path of [
      'app/(home)/solutions',
      'app/api/og/solutions',
      'components/landing-v2/SolutionsIndex.tsx',
      'components/landing-v2/PillarPage.tsx',
      'components/landing-v2/pillars.ts',
      'components/landing-v2/diagrams',
      'public/images/solutions',
      'public/videos/solutions',
      'public/nav/why-avalanche.webp',
      'public/nav/solutions.webp',
    ]) {
      expect(existsSync(join(ROOT, path)), path).toBe(false);
    }
  });

  it('is not linked anywhere in the site code', () => {
    const hits = ['app', 'components', 'lib', 'utils']
      .flatMap((dir) => files(join(ROOT, dir)))
      .filter((file) => /\.(tsx?|mdx?)$/.test(file))
      .filter((file) => /["'`]\/solutions["'`/]/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(ROOT.length + 1));
    expect(hits).toEqual([]);
  });
});
