import { describe, expect, it } from 'vitest';
import { formatPreflightError, preflightRpc } from './rpcPreflight';

const RPC = 'https://18.222.144.186.nip.io/ext/bc/xyz/rpc';
const HTTP_REMOTE_RPC = 'http://18.222.144.186:9650/ext/bc/xyz/rpc';

function fetchReturning(body: unknown, ok = true, status = 200): typeof fetch {
  return (async () => ({ ok, status, json: async () => body }) as unknown as Response) as unknown as typeof fetch;
}

function fetchRejecting(message: string): typeof fetch {
  return (async () => {
    throw new TypeError(message);
  }) as unknown as typeof fetch;
}

describe('preflightRpc', () => {
  it('passes when the RPC answers with the expected chain id', async () => {
    const result = await preflightRpc(RPC, 32896, { fetchFn: fetchReturning({ result: '0x8080' }) });
    expect(result).toEqual({ ok: true, chainId: 32896 });
  });

  it('reports a chain mismatch with the actual chain id', async () => {
    const result = await preflightRpc(RPC, 10637, { fetchFn: fetchReturning({ result: '0x8080' }) });
    expect(result).toEqual({ ok: false, reason: 'chain-mismatch', actualChainId: 32896 });
  });

  it('reports unreachable when the fetch rejects', async () => {
    const result = await preflightRpc(RPC, 32896, { fetchFn: fetchRejecting('Failed to fetch') });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unreachable');
  });

  it('names mixed content when an http remote URL fails from an https page', async () => {
    const result = await preflightRpc(HTTP_REMOTE_RPC, 32896, {
      fetchFn: fetchRejecting('Failed to fetch'),
      pageProtocol: 'https:',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('mixed-content-blocked');
  });

  it('stays "unreachable" for the same URL from an http page', async () => {
    const result = await preflightRpc(HTTP_REMOTE_RPC, 32896, {
      fetchFn: fetchRejecting('Failed to fetch'),
      pageProtocol: 'http:',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unreachable');
  });

  it('reports bad-response for HTTP errors and malformed bodies', async () => {
    const httpError = await preflightRpc(RPC, 32896, { fetchFn: fetchReturning({}, false, 502) });
    expect(httpError.ok).toBe(false);
    if (!httpError.ok) expect(httpError.reason).toBe('bad-response');

    const noResult = await preflightRpc(RPC, 32896, { fetchFn: fetchReturning({ error: { message: 'nope' } }) });
    expect(noResult.ok).toBe(false);
    if (!noResult.ok) expect(noResult.reason).toBe('bad-response');
  });
});

describe('formatPreflightError', () => {
  it('names the URL for unreachable RPCs', () => {
    const message = formatPreflightError({ ok: false, reason: 'unreachable' }, RPC, 32896);
    expect(message).toContain(RPC);
    expect(message).toMatch(/can't reach|cannot reach/i);
  });

  it('explains mixed content and points at the reverse proxy step', () => {
    const message = formatPreflightError({ ok: false, reason: 'mixed-content-blocked' }, HTTP_REMOTE_RPC, 32896);
    expect(message).toMatch(/mixed content/i);
    expect(message).toMatch(/reverse proxy/i);
  });

  it('names both chain ids on a mismatch', () => {
    const message = formatPreflightError({ ok: false, reason: 'chain-mismatch', actualChainId: 43113 }, RPC, 32896);
    expect(message).toContain('43113');
    expect(message).toContain('32896');
  });
});
