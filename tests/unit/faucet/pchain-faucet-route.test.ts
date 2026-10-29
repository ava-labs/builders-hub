import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cancelFaucetClaim, checkAndReserveFaucetClaim, getPChainUnlockedNAvax } = vi.hoisted(() => ({
  cancelFaucetClaim: vi.fn(),
  checkAndReserveFaucetClaim: vi.fn(),
  getPChainUnlockedNAvax: vi.fn(),
}));

vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => ({ user: { id: 'user-1' } })) }));
vi.mock('@/lib/faucet/rateLimit', () => ({
  checkAndReserveFaucetClaim,
  completeFaucetClaim: vi.fn(),
  cancelFaucetClaim,
}));
vi.mock('@/components/toolbox/utils/pChainNodeBalance', () => ({ getPChainUnlockedNAvax }));

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
  checkAndReserveFaucetClaim.mockReset().mockResolvedValue({ allowed: true, claimId: 'claim-1' });
  getPChainUnlockedNAvax.mockReset().mockResolvedValue(0n);
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

  it('refuses a drip to an address that holds more than 0.5 AVAX, and reserves no claim', async () => {
    getPChainUnlockedNAvax.mockResolvedValue(500_000_001n);
    const { GET } = await loadRoute(`0x${KEY}`);

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message:
        'This address holds more than 0.5 AVAX. The faucet sends AVAX only to an address that holds 0.5 AVAX or less.',
    });
    expect(getPChainUnlockedNAvax).toHaveBeenCalledWith(true, DESTINATION);
    expect(checkAndReserveFaucetClaim).not.toHaveBeenCalled();
  });

  it('goes on to the reservation for an address that holds 0.5 AVAX or less', async () => {
    getPChainUnlockedNAvax.mockResolvedValue(500_000_000n);
    checkAndReserveFaucetClaim.mockResolvedValue({ allowed: false, reason: 'Rate limit exceeded.' });
    const { GET } = await loadRoute(`0x${KEY}`);

    const response = await GET(request());

    expect(response.status).toBe(429);
    expect(checkAndReserveFaucetClaim).toHaveBeenCalledOnce();
  });

  it('sends nothing and reserves no claim when it cannot read the balance', async () => {
    getPChainUnlockedNAvax.mockRejectedValue(new Error('no answer from the node in time'));
    const { GET } = await loadRoute(`0x${KEY}`);

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect((await response.json()).message).toBe(
      'The faucet cannot read the balance of this address. Try again later.',
    );
    expect(checkAndReserveFaucetClaim).not.toHaveBeenCalled();
  });
});
