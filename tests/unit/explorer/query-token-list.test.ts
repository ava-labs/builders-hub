import { afterEach, describe, expect, it, vi } from 'vitest';

import { tokenList } from '@/lib/explorer-query/enrich';

const USDC = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';
const at = (hms: string) => Date.parse(`2026-09-29T${hms}Z`);
/** what a protected deployment host answers: a sign-in page, not the list */
const signIn = () => new Response('<!doctype html><title>Vercel</title>', { headers: { 'content-type': 'text/html' } });
const list = () => Response.json({ tokens: { [USDC]: { symbol: 'USDC', name: 'USDC', decimals: 6, logoURI: null } } });

describe('tokenList', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('holds a failed read a minute, not the hour', async () => {
    vi.useFakeTimers({ now: at('20:00:00'), toFake: ['Date'] });
    const fetch = vi.fn(async () => signIn());
    vi.stubGlobal('fetch', fetch);
    expect((await tokenList(43114, 'https://example.test')).size).toBe(0);
    // within the minute the failed read stands
    vi.setSystemTime(at('20:00:30'));
    expect((await tokenList(43114, 'https://example.test')).size).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    // after it the list is read again, and a monitor finds USDC
    fetch.mockImplementation(async () => list());
    vi.setSystemTime(at('20:01:01'));
    expect((await tokenList(43114, 'https://example.test')).get(USDC)?.decimals).toBe(6);
    // a good read is held the hour
    vi.setSystemTime(at('20:59:00'));
    await tokenList(43114, 'https://example.test');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
