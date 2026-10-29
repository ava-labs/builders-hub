import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cancelFaucetClaim } = vi.hoisted(() => ({ cancelFaucetClaim: vi.fn() }));

vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => ({ user: { id: 'user-1' } })) }));
vi.mock('@/lib/faucet/rateLimit', () => ({
  checkAndReserveFaucetClaim: vi.fn(async () => ({ allowed: true, claimId: 'claim-1' })),
  completeFaucetClaim: vi.fn(),
  cancelFaucetClaim,
}));

const FAUCET_ADDRESS = 'P-fuji1qyqszqgpqyqszqgpqyqszqgpqyqszqgptrggc7';
const DESTINATION = 'P-fuji1qgpqyqszqgpqyqszqgpqyqszqgpqyqszfvxe3x';
/** A valid secp256k1 key with no real funds: 32 bytes of 0x11. */
const KEY = '11'.repeat(32);

/** The route reads its env when it loads, so each case loads it again. */
async function loadRoute(serverKey: string) {
  vi.resetModules();
  vi.stubEnv('SERVER_PRIVATE_KEY', serverKey);
  vi.stubEnv('FAUCET_P_CHAIN_ADDRESS', FAUCET_ADDRESS);
  return import('@/app/api/pchain-faucet/route');
}

const request = () =>
  ({ nextUrl: new URL(`https://build.avax.network/api/pchain-faucet?address=${DESTINATION}`) }) as never;

/** A node that answers every JSON-RPC call with an error: viem's error then carries the request body and the URL. */
function failingNode() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const { id } = JSON.parse(String(init?.body));
    const error = { code: -32000, message: 'failed to issue tx', data: null };
    return new Response(JSON.stringify({ jsonrpc: '2.0', error, id }), {
      headers: { 'content-type': 'application/json' },
    });
  });
}

beforeEach(() => {
  cancelFaucetClaim.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('GET /api/pchain-faucet', () => {
  it('answers a failed transfer with a fixed message, not the RPC error with its request body', async () => {
    failingNode();
    const { GET } = await loadRoute(`0x${KEY}`);

    const response = await GET(request());
    const text = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ success: false, message: 'Failed to complete transfer' });
    expect(text).not.toContain('Request body');
    expect(text).not.toContain('api.avax-test.network');
    expect(cancelFaucetClaim).toHaveBeenCalledWith('claim-1');
  });

  it.each([
    ['0x-prefixed', `0x${KEY}`],
    ['bare', KEY],
    ['0X-prefixed', `0X${KEY}`],
    ['with its leading zero dropped', 'a'.repeat(63)],
  ])('takes a faucet key %s, as avalanchejs did, and goes on to the node', async (_format, serverKey) => {
    const fetchMock = failingNode();
    const { GET } = await loadRoute(serverKey);

    await GET(request());

    expect(fetchMock).toHaveBeenCalled();
  });
});
