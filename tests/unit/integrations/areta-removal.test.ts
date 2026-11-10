import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// next.config.mjs wraps its config in fumadocs-mdx's createMDX; the redirects are plain data under it.
vi.mock('fumadocs-mdx/next', () => ({ createMDX: () => (config: unknown) => config }));

import nextConfig from '@/next.config.mjs';
import { firstRedirect, type RedirectRule } from '../academy/helpers/redirects';

// Builder Hub runs its own audit marketplace, so it no longer sends builders to a competing one
// (.scratch/audits-subsidy-timer, Part 2, 2026-10-20).
const ROOT = process.cwd();
const redirects = (await nextConfig.redirects!()) as RedirectRule[];

// On the Ava Labs audit whitelist when checked on build.avax.network/audits/firms (2026-10-21),
// each with the name its page uses.
const WHITELISTED: Record<string, string> = {
  bailsec: 'BailSec',
  'openzeppelin-audit': 'OpenZeppelin',
  paladinsec: 'Paladin Security',
  trailofbits: 'Trail of Bits',
  zokyo: 'Zokyo',
};
const NOT_WHITELISTED = ['peckshield', 'spearbit'];
const page = (slug: string) => readFileSync(join(ROOT, 'content/integrations', `${slug}.mdx`), 'utf8');

// Tracked text files only, as in tests/unit/docs/unused-tools-removal.test.ts.
const trackedText = (...paths: string[]): string[] =>
  execFileSync('git', ['ls-files', '--', ...paths], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((file) => /\.(mdx?|json|ya?ml|txt|html|svg)$/.test(file) && existsSync(join(ROOT, file)));

describe('Areta off the integration pages', () => {
  it('sends the old Areta page to the audit marketplace', () => {
    expect(firstRedirect(redirects, '/integrations/areta')).toMatchObject({
      destination: '/audits',
      permanent: true,
    });
  });

  it('deletes the Areta page and its logo', () => {
    expect(existsSync(join(ROOT, 'content/integrations/areta.mdx'))).toBe(false);
    expect(existsSync(join(ROOT, 'public/images/areta.png'))).toBe(false);
  });

  it('leaves no Areta mention or cashback line under content and public', () => {
    // Substrings, as the note's own check (`git grep -i "areta\|cashback"`) reads them.
    const mentions = trackedText('content', 'public').filter((file) =>
      /areta|cashback/i.test(readFileSync(join(ROOT, file), 'utf8')),
    );
    expect(mentions).toEqual([]);
    for (const slug of [...Object.keys(WHITELISTED), ...NOT_WHITELISTED]) {
      // Subsidy, subsidies, subsidized; a firm's "subsidiary" is fine.
      expect(page(slug), slug).not.toMatch(/subsid(?!iar)/i);
    }
  });

  it('points the whitelisted firms to Builder Hub and the others to the firm alone', () => {
    for (const [slug, firm] of Object.entries(WHITELISTED)) {
      const text = page(slug);
      expect(text, slug).toContain('## Request quotes on Builder Hub');
      expect(text, slug).toContain(
        `${firm} is on the Ava Labs audit whitelist. Request a quote through the [Builder Hub audit marketplace](/audits), from ${firm} alone or from every vetted firm at once.`,
      );
      expect(text, slug).toContain('1. **Via Builder Hub** (Recommended for Avalanche):');
      expect(text, slug).toContain('   - Visit [build.avax.network/audits](/audits)');
    }
    for (const slug of NOT_WHITELISTED) {
      const text = page(slug);
      expect(text, slug).not.toContain('/audits');
      expect(text, slug).not.toContain('Builder Hub');
      expect(text, slug).toMatch(/^1\. \*\*Direct Contact\*\*:/m);
    }
  });
});
