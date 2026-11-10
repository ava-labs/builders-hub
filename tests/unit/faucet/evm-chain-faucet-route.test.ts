import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther } from 'viem';

const { checkAndReserveFaucetClaim, getBalance } = vi.hoisted(() => ({
  checkAndReserveFaucetClaim: vi.fn(),
  getBalance: vi.fn(),
}));

vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => ({ user: { id: 'user-1' } })) }));
vi.mock('@/lib/faucet/rateLimit', () => ({
  checkAndReserveFaucetClaim,
  completeFaucetClaim: vi.fn(),
  cancelFaucetClaim: vi.fn(),
}));
// Every balance read of the route goes to this stub, so the test sends nothing to a node
vi.mock('viem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('viem')>()),
  createPublicClient: () => ({ getBalance }),
}));

const FAUCET_ADDRESS = '0x00000000000000000000000000000000000fa0ce';
const DESTINATION = '0x000000000000000000000000000000000000dEaD';
const FUJI_C_CHAIN = 43113;
const ECHO = 173750;
/** A valid secp256k1 key with no real funds: 32 bytes of 0x11. */
const KEY = `0x${'11'.repeat(32)}`;

/** The route reads its env when it loads. */
async function loadRoute() {
  vi.resetModules();
  vi.stubEnv('FAUCET_C_CHAIN_PRIVATE_KEY', KEY);
  vi.stubEnv('FAUCET_C_CHAIN_ADDRESS', FAUCET_ADDRESS);
  return import('@/app/api/evm-chain-faucet/route');
}

const request = (chainId: number) => ({ json: async () => ({ address: DESTINATION, chainId }) }) as never;

beforeEach(() => {
  checkAndReserveFaucetClaim.mockReset().mockResolvedValue({ allowed: false, reason: 'Rate limit exceeded.' });
  getBalance.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/evm-chain-faucet', () => {
  it('refuses a C-Chain drip to an address that holds more than 1 AVAX, and reserves no claim', async () => {
    getBalance.mockResolvedValue(parseEther('285.71'));
    const { POST } = await loadRoute();

    const response = await POST(request(FUJI_C_CHAIN));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: 'This address holds more than 1 AVAX. The faucet sends AVAX only to an address that holds 1 AVAX or less.',
    });
    expect(getBalance).toHaveBeenCalledWith({ address: DESTINATION });
    expect(checkAndReserveFaucetClaim).not.toHaveBeenCalled();
  });

  it('refuses an L1 drip to an address that holds more than 1 of the L1 token', async () => {
    getBalance.mockResolvedValue(parseEther('1') + 1n);
    const { POST } = await loadRoute();

    const response = await POST(request(ECHO));

    expect(response.status).toBe(403);
    expect((await response.json()).message).toBe(
      'This address holds more than 1 ECH. The faucet sends ECH only to an address that holds 1 ECH or less.',
    );
    expect(checkAndReserveFaucetClaim).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty address', 0n],
    ['an address that holds exactly 1 AVAX', parseEther('1')],
  ])('goes on to the reservation for %s', async (_case, balance) => {
    getBalance.mockResolvedValue(balance);
    const { POST } = await loadRoute();

    const response = await POST(request(FUJI_C_CHAIN));

    // The mocked reservation refuses, so the route stops before it sends a transaction
    expect(response.status).toBe(429);
    expect(checkAndReserveFaucetClaim).toHaveBeenCalledWith('user-1', 'evm', DESTINATION, '0.5', '43113');
  });

  it('sends nothing and reserves no claim when it cannot read the balance', async () => {
    getBalance.mockRejectedValue(new Error('HTTP request failed'));
    const { POST } = await loadRoute();

    const response = await POST(request(FUJI_C_CHAIN));

    expect(response.status).toBe(503);
    expect((await response.json()).message).toBe(
      'The faucet cannot read the balance of this address. Try again later.',
    );
    expect(checkAndReserveFaucetClaim).not.toHaveBeenCalled();
  });
});
