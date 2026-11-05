import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/prisma/prisma', () => ({ prisma: {} }));

import { ManagedTestnetNodesServiceURLs } from '@/app/api/managed-testnet-nodes/constants';
import { builderHubDeleteNode } from '@/app/api/managed-testnet-nodes/service';
import { readJsonResponse } from '@/lib/read-json-response';

const SUBNET = '2W9boARgCWL25z6pMFNtkCfNA5v28VGg9PmBgUJfuKndEdhrvw';
const CLOUDFLARE_BLOCK = '<!DOCTYPE html>\n<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->';

function answer(body: string, status: number, contentType: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status, headers: { 'content-type': contentType } })),
  );
}

beforeEach(() => vi.stubEnv('MANAGED_TESTNET_NODE_SERVICE_PASSWORD', 'test-password'));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('builderHubDeleteNode', () => {
  it('turns an HTML block page into a readable error, with a status Cloudflare passes through', async () => {
    answer(CLOUDFLARE_BLOCK, 403, 'text/html; charset=UTF-8');
    const error = await builderHubDeleteNode(SUBNET, 11).catch((e: unknown) => e);
    expect(error).toMatchObject({
      status: 503,
      message: 'The managed nodes service returned HTTP 403 with an HTML page instead of JSON.',
    });
  });

  it('keeps the JSON error message of the service', async () => {
    answer(JSON.stringify({ error: 'Slot is busy' }), 409, 'application/json');
    await expect(builderHubDeleteNode(SUBNET, 11)).rejects.toMatchObject({ status: 503, message: 'Slot is busy' });
  });

  it('treats a 404 as already deleted', async () => {
    answer(JSON.stringify({ error: 'not found' }), 404, 'application/json');
    expect(await builderHubDeleteNode(SUBNET, 11)).toEqual({ deletedExternally: false });
  });

  it('sends the WAF bypass token on the delete, and never puts it in the stored RPC URL', async () => {
    vi.stubEnv('QUICK_L1_WAF_BYPASS_TOKEN', 'waf-token');
    answer('{}', 200, 'application/json');
    await builderHubDeleteNode(SUBNET, 11);
    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(new URL(url).searchParams.get('token')).toBe('waf-token');
    expect(ManagedTestnetNodesServiceURLs.rpcEndpoint(SUBNET)).not.toContain('token');
  });
});

describe('readJsonResponse', () => {
  it('reads a JSON body', async () => {
    expect(await readJsonResponse(new Response('{"message":"ok"}', { status: 200 }))).toEqual({ message: 'ok' });
  });

  it('names the status instead of a JSON parse error when the body is HTML', async () => {
    await expect(readJsonResponse(new Response(CLOUDFLARE_BLOCK, { status: 502 }))).rejects.toThrow(
      'The server returned HTTP 502 with a non-JSON response. Try again later.',
    );
  });
});
