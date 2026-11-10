import { describe, expect, it } from 'vitest';
import { pickReleaseVersion } from '@/scripts/pick-release-version.mjs';

type Release = { tag_name: string; prerelease?: boolean; draft?: boolean };

const stable = (tag_name: string): Release => ({ tag_name });
const pre = (tag_name: string): Release => ({ tag_name, prerelease: true });

describe('pickReleaseVersion on testnet', () => {
  const testnet = { isFuji: true };

  it('takes a stable patch release over the older -fuji tag', () => {
    expect(pickReleaseVersion([stable('v1.15.3'), pre('v1.15.0-fuji')], testnet)).toBe('v1.15.3');
  });

  it('takes a -fuji tag that is ahead of mainnet', () => {
    expect(pickReleaseVersion([pre('v1.16.0-fuji'), stable('v1.15.3')], testnet)).toBe('v1.16.0-fuji');
  });

  it('takes the stable release over the -fuji tag of the same version', () => {
    expect(pickReleaseVersion([pre('v1.16.0-fuji'), stable('v1.16.0')], testnet)).toBe('v1.16.0');
  });

  it('ignores release candidates and drafts', () => {
    const releases = [
      pre('v1.16.0-rc.1'),
      pre('v1.16.0-fuji-rc.0'),
      { tag_name: 'v1.16.0-fuji', prerelease: true, draft: true },
      stable('v1.15.3'),
    ];
    expect(pickReleaseVersion(releases, testnet)).toBe('v1.15.3');
  });

  it('orders by version, not by list position', () => {
    expect(pickReleaseVersion([stable('v1.14.2'), stable('v1.15.10'), stable('v1.15.9')], testnet)).toBe('v1.15.10');
  });

  it('strips the tag prefix and skips other products', () => {
    const releases = [
      stable('signature-aggregator-v0.6.1'),
      stable('icm-relayer-v1.8.4'),
      pre('icm-relayer-v1.8.3-rc.0'),
      pre('icm-relayer-v1.8.1-fuji-rc.0'),
      pre('icm-relayer-v1.8.0-fuji'),
    ];
    expect(pickReleaseVersion(releases, { isFuji: true, prefix: 'icm-relayer-' })).toBe('v1.8.4');
  });
});

describe('pickReleaseVersion on mainnet', () => {
  it('never takes a -fuji tag or a release marked prerelease', () => {
    const releases = [pre('v1.16.0-fuji'), pre('v1.15.4'), stable('v1.15.3')];
    expect(pickReleaseVersion(releases, { isFuji: false })).toBe('v1.15.3');
  });

  it('returns null when no release qualifies', () => {
    expect(pickReleaseVersion([pre('v1.16.0-fuji')], { isFuji: false })).toBeNull();
  });
});
