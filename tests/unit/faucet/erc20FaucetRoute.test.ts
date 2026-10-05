import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const FAUCET_ADDRESS = '0x1111111111111111111111111111111111111111';
const DESTINATION = '0x2222222222222222222222222222222222222222';
const WAVAX = '0xd00ae08403B9bbb9124bB305C09058E32C39A48c';
const DRIP = 250_000_000_000_000_000n; // 0.25 WAVAX

const { mocks } = vi.hoisted(() => {
  // The route reads its env at module load, which happens before this file's
  // top-level statements run, so the env must be set inside the hoisted block.
  process.env.FAUCET_C_CHAIN_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  process.env.FAUCET_C_CHAIN_ADDRESS = '0x1111111111111111111111111111111111111111';
  return { mocks: {
    getAuthSession: vi.fn(),
    checkAndReserveFaucetClaim: vi.fn(),
    completeFaucetClaim: vi.fn(),
    cancelFaucetClaim: vi.fn(),
    readContract: vi.fn(),
    getBalance: vi.fn(),
    getTransactionCount: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    writeContract: vi.fn(),
  } };
});

vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock('@/lib/faucet/rateLimit', () => ({
  checkAndReserveFaucetClaim: mocks.checkAndReserveFaucetClaim,
  completeFaucetClaim: mocks.completeFaucetClaim,
  cancelFaucetClaim: mocks.cancelFaucetClaim,
}));
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: () => ({
      readContract: mocks.readContract,
      getBalance: mocks.getBalance,
      getTransactionCount: mocks.getTransactionCount,
      waitForTransactionReceipt: mocks.waitForTransactionReceipt,
    }),
    createWalletClient: () => ({ writeContract: mocks.writeContract }),
  };
});

import { POST } from '@/app/api/erc20-faucet/route';

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/erc20-faucet', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getAuthSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.checkAndReserveFaucetClaim.mockResolvedValue({ allowed: true, claimId: 'claim-1' });
  mocks.getTransactionCount.mockResolvedValue(7);
  mocks.waitForTransactionReceipt.mockResolvedValue({ status: 'success' });
});

describe('POST /api/erc20-faucet', () => {
  it('rejects unauthenticated requests', async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const res = await post({ address: DESTINATION, chainId: 43113, tokenAddress: WAVAX });
    expect(res.status).toBe(401);
  });

  it('rejects tokens that are not configured for the chain faucet', async () => {
    const res = await post({
      address: DESTINATION,
      chainId: 43113,
      tokenAddress: '0x3333333333333333333333333333333333333333',
    });
    expect(res.status).toBe(400);
    expect(mocks.checkAndReserveFaucetClaim).not.toHaveBeenCalled();
  });

  it('rejects chains without a Builder Hub faucet', async () => {
    const res = await post({ address: DESTINATION, chainId: 43114, tokenAddress: WAVAX });
    expect(res.status).toBe(400);
  });

  it('returns 429 without touching the chain when the claim is rate limited', async () => {
    mocks.checkAndReserveFaucetClaim.mockResolvedValue({ allowed: false, reason: 'Rate limit exceeded.' });
    const res = await post({ address: DESTINATION, chainId: 43113, tokenAddress: WAVAX });
    expect(res.status).toBe(429);
    expect(mocks.writeContract).not.toHaveBeenCalled();
  });

  it('reserves the claim under the erc20 type scoped by chain and token', async () => {
    mocks.readContract.mockResolvedValue(DRIP * 10n);
    mocks.writeContract.mockResolvedValue('0xtransfer');

    await post({ address: DESTINATION, chainId: 43113, tokenAddress: WAVAX });

    expect(mocks.checkAndReserveFaucetClaim).toHaveBeenCalledWith(
      'user-1',
      'erc20',
      DESTINATION,
      '0.25',
      `43113:${WAVAX.toLowerCase()}`,
    );
  });

  it('transfers directly when the faucet already holds enough of the token', async () => {
    mocks.readContract.mockResolvedValue(DRIP * 10n);
    mocks.writeContract.mockResolvedValue('0xtransfer');

    const res = await post({ address: DESTINATION, chainId: 43113, tokenAddress: WAVAX });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, txHash: '0xtransfer', amount: '0.25', chainId: 43113 });
    expect(body.wrapTxHash).toBeUndefined();
    expect(mocks.writeContract).toHaveBeenCalledTimes(1);
    expect(mocks.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'transfer', args: [DESTINATION, DRIP], nonce: 7 }),
    );
    expect(mocks.completeFaucetClaim).toHaveBeenCalledWith('claim-1', '0xtransfer');
  });

  it('wraps the shortfall from native balance before transferring a wrapped-native token', async () => {
    mocks.readContract.mockResolvedValue(DRIP / 5n); // holds 0.05 WAVAX, needs 0.25
    mocks.getBalance.mockResolvedValue(10n ** 18n); // 1 AVAX available
    mocks.writeContract.mockResolvedValueOnce('0xwrap').mockResolvedValueOnce('0xtransfer');

    const res = await post({ address: DESTINATION, chainId: 43113, tokenAddress: WAVAX });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ txHash: '0xtransfer', wrapTxHash: '0xwrap' });
    expect(mocks.writeContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: 'deposit', value: DRIP - DRIP / 5n }),
    );
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0xwrap' });
    expect(mocks.writeContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: 'transfer', args: [DESTINATION, DRIP] }),
    );
  });

  it('cancels the reserved claim when the faucet cannot cover the drip', async () => {
    mocks.readContract.mockResolvedValue(0n);
    mocks.getBalance.mockResolvedValue(1_000n); // dust, below drip + gas reserve

    const res = await post({ address: DESTINATION, chainId: 43113, tokenAddress: WAVAX });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.message).toMatch(/Insufficient faucet AVAX balance/);
    expect(mocks.writeContract).not.toHaveBeenCalled();
    expect(mocks.cancelFaucetClaim).toHaveBeenCalledWith('claim-1');
  });
});
