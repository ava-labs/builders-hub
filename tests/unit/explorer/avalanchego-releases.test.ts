import { describe, expect, it } from 'vitest';

import { deadlineOf, toReleases, type GitHubRelease } from '@/lib/avalanchego-releases';

/* Release-note wording from the real AvalancheGo releases. */
function release(tag: string, body: string, over: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    tag_name: tag,
    prerelease: false,
    body,
    published_at: '2026-09-08T18:00:00Z',
    html_url: `https://github.com/ava-labs/avalanchego/releases/tag/${tag}`,
    ...over,
  };
}

const HELICON =
  'This release schedules the activation of the Helicon network upgrade at 11 AM ET (3 PM UTC) on Tuesday, September 22nd, 2026 on Mainnet.\n\n**All Mainnet nodes must upgrade before 11 AM ET, September 22nd 2026.**\n\nThis release updates the plugin version to `46`.';
const FORTUNA = '**All Fortuna supporting Mainnet nodes should upgrade before 11 AM ET, April 8th 2025.**';
const PATCH =
  'This version is backwards compatible to [v1.14.0](https://github.com/ava-labs/avalanchego/releases/tag/v1.14.0). It is optional, but encouraged.\n\nThe plugin version is updated to `43` all plugins must update to be compatible.';

describe('toReleases', () => {
  it('marks upgrade releases mandatory and patch releases optional, newest first', () => {
    const releases = toReleases([
      release('v1.14.2', PATCH),
      release('v1.15.0', HELICON),
      release('v1.13.0', FORTUNA),
    ]);
    expect(releases.map((r) => [r.version, r.mandatory])).toEqual([
      ['1.15.0', true],
      ['1.14.2', false],
      ['1.13.0', true],
    ]);
  });

  it('reads older mandatory wording too', () => {
    const releases = toReleases([
      release('v1.8.0', 'This is a mandatory security upgrade. Please upgrade your node as soon as possible.'),
      release('v1.5.3', 'If you are running a node, you must upgrade to this version.'),
    ]);
    expect(releases.map((r) => [r.version, r.mandatory])).toEqual([
      ['1.8.0', true],
      ['1.5.3', true],
    ]);
  });

  it('drops pre-releases, drafts and Fuji-only builds', () => {
    const releases = toReleases([
      release('v1.15.0-fuji', HELICON, { prerelease: true }),
      release('v1.16.0', HELICON, { draft: true }),
      release('v1.15.0-rc.1', HELICON),
      release('v1.15.0', HELICON),
    ]);
    expect(releases.map((r) => r.version)).toEqual(['1.15.0']);
  });
});

describe('deadlineOf', () => {
  it('quotes the notes’ own deadline sentence without the markdown', () => {
    expect(deadlineOf(HELICON)).toBe('All Mainnet nodes must upgrade before 11 AM ET, September 22nd 2026.');
    expect(deadlineOf(FORTUNA)).toBe('All Fortuna supporting Mainnet nodes should upgrade before 11 AM ET, April 8th 2025.');
  });

  it('finds no deadline in a patch release', () => {
    expect(deadlineOf(PATCH)).toBeNull();
  });
});
