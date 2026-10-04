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

describe('Campus Connect removal', () => {
  it.each(['/university', '/university/anything', '/students', '/student-launchpad', '/student-launchpad/apply'])(
    '%s redirects to the Academy for good',
    (path) => {
      expect(firstRedirect(redirects, path)).toMatchObject({ destination: '/academy', permanent: true });
    },
  );

  it('has no pages, routes or components left', () => {
    for (const path of [
      'app/(home)/university',
      'app/(home)/students',
      'app/(home)/student-launchpad',
      'app/api/university',
      'app/api/og/university',
      'components/university',
      'components/landing/student-callout.tsx',
    ]) {
      expect(existsSync(join(ROOT, path)), path).toBe(false);
    }
  });

  it('is not named or linked anywhere in the site code', () => {
    const hits = ['app', 'components', 'lib', 'utils']
      .flatMap((dir) => files(join(ROOT, dir)))
      .filter((file) => /\.(tsx?|mdx?)$/.test(file))
      .filter((file) =>
        /Campus Connect|["'`]\/(university|students|student-launchpad)["'`/]/.test(readFileSync(file, 'utf8')),
      )
      .map((file) => file.slice(ROOT.length + 1));
    expect(hits).toEqual([]);
  });
});
