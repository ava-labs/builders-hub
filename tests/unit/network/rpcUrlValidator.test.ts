import { describe, expect, it, vi, beforeEach } from 'vitest';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('dns/promises', () => ({ lookup: lookupMock }));

import { isValidRpcUrl, isPublicRpcHost, assertPublicRpcTarget } from '@/lib/rpcUrlValidator';

// Block body on purpose: an expression body returns the mock, and vitest
// treats a function returned from a hook as a teardown callback — it would
// then *call* the mock after each test.
beforeEach(() => { lookupMock.mockReset(); });

describe('isValidRpcUrl (textual gate)', () => {
  it('accepts a plain https endpoint', () => {
    expect(isValidRpcUrl('https://api.avax.network/ext/bc/C/rpc')).toBe(true);
  });

  it('rejects non-https schemes', () => {
    expect(isValidRpcUrl('http://api.avax.network/rpc')).toBe(false);
    expect(isValidRpcUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects literal private and metadata addresses', () => {
    for (const host of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '169.254.169.254', 'localhost']) {
      expect(isValidRpcUrl(`https://${host}/rpc`)).toBe(false);
    }
  });

  it('rejects a bracketed IPv6 loopback', () => {
    expect(isValidRpcUrl('https://[::1]/rpc')).toBe(false);
  });
});

describe('isPublicRpcHost (resolving gate)', () => {
  // Finding gap: the textual check cannot see where a *name* points, so a
  // domain the attacker controls could still aim at the metadata service.
  it('rejects a public name that resolves into the private range', async () => {
    lookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    expect(await isPublicRpcHost('evil.example')).toBe(false);
  });

  it('accepts a name that resolves to a public address', async () => {
    lookupMock.mockResolvedValue([{ address: '34.120.1.1', family: 4 }]);
    expect(await isPublicRpcHost('api.avax.network')).toBe(true);
  });

  // A mixed record set must not slip one internal address through.
  it('rejects when any record is private', async () => {
    lookupMock.mockResolvedValue([
      { address: '34.120.1.1', family: 4 },
      { address: '10.1.2.3', family: 4 },
    ]);
    expect(await isPublicRpcHost('mixed.example')).toBe(false);
  });

  it('rejects a name that does not resolve', async () => {
    // Throws synchronously: an async throw here makes vitest's mock-result
    // tracking surface the rejection as an unhandled error even though the
    // code under test catches it. Either shape exercises the same catch.
    lookupMock.mockImplementation(() => { throw new Error('ENOTFOUND'); });
    expect(await isPublicRpcHost('nope.example')).toBe(false);
  });

  it('rejects an empty record set', async () => {
    lookupMock.mockResolvedValue([]);
    expect(await isPublicRpcHost('empty.example')).toBe(false);
  });

  it('checks a literal without consulting DNS', async () => {
    expect(await isPublicRpcHost('10.0.0.1')).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });
});

describe('assertPublicRpcTarget', () => {
  it('rejects the rebinding-style URL that passed the textual gate alone', async () => {
    lookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    const url = 'https://metadata.attacker.example/latest/meta-data/';
    expect(isValidRpcUrl(url)).toBe(true);        // textual gate says fine...
    expect(await assertPublicRpcTarget(url)).toBe(false); // ...resolution does not
  });

  it('accepts a genuine public endpoint', async () => {
    lookupMock.mockResolvedValue([{ address: '34.120.1.1', family: 4 }]);
    expect(await assertPublicRpcTarget('https://api.avax.network/ext/bc/C/rpc')).toBe(true);
  });

  it('short-circuits on scheme without a lookup', async () => {
    expect(await assertPublicRpcTarget('http://api.avax.network/rpc')).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });
});
