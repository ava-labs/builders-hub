import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { matchHas } from 'next/dist/shared/lib/router/utils/prepare-destination';
import { describe, expect, it, vi } from 'vitest';

// next.config.mjs wraps its config in fumadocs-mdx's createMDX; the redirects are plain data under it.
vi.mock('fumadocs-mdx/next', () => ({ createMDX: () => (config: unknown) => config }));

import nextConfig from '@/next.config.mjs';
import { firstRedirect, type RedirectRule } from './helpers/redirects';

const ROOT = process.cwd();
const LANDINGS = ['/academy/avalanche-l1', '/academy/blockchain'];
const redirects = (await nextConfig.redirects!()) as RedirectRule[];

/** The redirect Next.js applies to `pathname` with `query` and no headers or cookies, `has` included (entrepreneur-removal.test.ts:27-32). */
const redirectWithQuery = (pathname: string, query: Record<string, string>) =>
  redirects.find(
    (rule) =>
      getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(pathname) !== false &&
      matchHas({ headers: {} } as never, query, rule.has as never) !== false,
  );

const DELETED = [
  'app/(home)/academy/avalanche-l1/page.tsx',
  'app/(home)/academy/avalanche-l1/config.ts',
  'app/(home)/academy/blockchain/page.tsx',
  'app/(home)/academy/blockchain/config.ts',
  'components/academy/learning-path-configs/avalanche.config.tsx',
  'components/academy/learning-path-configs/blockchain.config.tsx',
  'components/academy/shared/academy-track-tabs.tsx',
  'components/academy/shared/academy-shortcut-section.tsx',
  'tests/unit/academy/track-tabs.render.test.tsx',
  'tests/unit/academy/landing-shortcuts.render.test.tsx',
];
const REMOVED_NAMES = [
  'avalanche.config', 'blockchain.config', 'academy-track-tabs', 'academy-shortcut-section',
  'AcademyTrackTabs', 'AcademyShortcutSection', 'visibleAcademyTracks', 'avalancheLearningPaths', 'blockchainLearningPaths',
  'avalancheDeveloperAcademyLandingPageConfig', 'blockchainAcademyLandingPageConfig',
];
const SCAN = ['app', 'components', 'hooks', 'lib', 'utils'];
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|mts)$/.test(entry) ? [path] : [];
  });

describe('the two track landings redirect to the single landing (FDE-155)', () => {
  it.each(LANDINGS)('%s answers a 308 to /academy', (path) => {
    expect(firstRedirect(redirects, path)).toMatchObject({ destination: '/academy', permanent: true });
  });

  it.each([
    '/academy/avalanche-l1/avalanche-fundamentals',
    '/academy/avalanche-l1/interchain-messaging/03-icm-protocol/01-what-is-icm',
    '/academy/blockchain/solidity-foundry',
    '/academy/blockchain/encrypted-erc',
  ])('leaves the course url %s alone', (path) => {
    expect(firstRedirect(redirects, path)).toBeUndefined();
  });

  it('renders /academy?path=avalanche-l1 and ?path=blockchain as /academy, with no redirect (one would loop)', () => {
    expect(redirectWithQuery('/academy', { path: 'avalanche-l1' })).toBeUndefined();
    expect(redirectWithQuery('/academy', { path: 'blockchain' })).toBeUndefined();
    // The matcher does read query rules: the Team1 one still applies.
    expect(redirectWithQuery('/academy', { path: 'team1' })).toMatchObject({ destination: '/academy/team1' });
  });

  it('points no redirect at the two old landings, and /academy itself does not redirect', () => {
    expect(redirects.filter((rule) => LANDINGS.includes(rule.destination)).map((rule) => rule.source)).toEqual([]);
    expect(firstRedirect(redirects, '/academy')).toBeUndefined();
  });
});

describe('the two track landings are removed (FDE-155)', () => {
  it.each(DELETED)('%s is gone', (file) => {
    expect(existsSync(join(ROOT, file))).toBe(false);
  });

  it('leaves no reference to a removed module', () => {
    const hits = SCAN.flatMap((dir) => sources(join(ROOT, dir)))
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return REMOVED_NAMES.some((name) => text.includes(name));
      })
      .map((file) => relative(ROOT, file));
    expect(hits).toEqual([]);
  });
});
