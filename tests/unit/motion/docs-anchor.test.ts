import { describe, expect, it } from 'vitest';
import { idFromHash } from '@/app/docs/docs-layout-wrapper';

/** docs-anchor-flash: the heading id that a URL fragment names (a link's hash, or location.hash on load). */
describe('idFromHash', () => {
  it('gives no id for an empty fragment', () => {
    expect(idFromHash('')).toBeNull();
    expect(idFromHash('#')).toBeNull();
  });

  it('drops the # and keeps the id as written', () => {
    expect(idFromHash('#how-a-healthy-view-goes-stale')).toBe('how-a-healthy-view-goes-stale');
  });

  it('decodes a percent-encoded id', () => {
    expect(idFromHash('#a%20b')).toBe('a b');
    expect(idFromHash('#%C3%A9t%C3%A9')).toBe('été');
    expect(idFromHash('#100%25')).toBe('100%');
  });

  it('gives no id for a fragment that does not decode', () => {
    expect(idFromHash('#100%')).toBeNull();
    expect(idFromHash('#%E0%A4%A')).toBeNull();
  });
});
