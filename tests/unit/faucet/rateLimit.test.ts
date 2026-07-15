import { describe, expect, it, vi, beforeEach } from 'vitest';

const { txMocks } = vi.hoisted(() => ({
  txMocks: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        faucetClaim: {
          count: txMocks.count,
          findFirst: txMocks.findFirst,
          create: txMocks.create,
        },
        user: { findUnique: txMocks.findUnique },
      }),
  },
}));

import { checkAndReserveFaucetClaim } from '@/lib/faucet/rateLimit';

beforeEach(() => {
  Object.values(txMocks).forEach((m) => m.mockReset());
});

describe('checkAndReserveFaucetClaim — devnet + coupon', () => {
  it('reserves a devnet claim tagged with the coupon id', async () => {
    txMocks.count.mockResolvedValue(0); // under per-user and per-address limits
    txMocks.findUnique.mockResolvedValue({ id: 'user-1' });
    txMocks.create.mockResolvedValue({ id: 'claim-1' });

    const result = await checkAndReserveFaucetClaim(
      'user-1',
      'devnet',
      '0xAbCdEf',
      '2005',
      '43117',
      'coupon-1',
    );

    expect(result.allowed).toBe(true);
    expect(result.claimId).toBe('claim-1');
    expect(txMocks.create).toHaveBeenCalledWith({
      data: {
        user_id: 'user-1',
        faucet_type: 'devnet',
        chain_id: '43117',
        destination_address: '0xabcdef', // normalized to lowercase
        amount: '2005',
        tx_hash: null,
        coupon_id: 'coupon-1',
      },
    });
  });

  it('stores null coupon_id when none is supplied', async () => {
    txMocks.count.mockResolvedValue(0);
    txMocks.findUnique.mockResolvedValue({ id: 'user-1' });
    txMocks.create.mockResolvedValue({ id: 'claim-2' });

    await checkAndReserveFaucetClaim('user-1', 'evm', '0xAbC', '3', '43113');

    expect(txMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ coupon_id: null }) }),
    );
  });

  it('blocks (and does not create a claim) when the per-user daily limit is reached', async () => {
    txMocks.count.mockResolvedValueOnce(1); // user already claimed in window
    txMocks.findFirst.mockResolvedValue({ created_at: new Date() });

    const result = await checkAndReserveFaucetClaim(
      'user-1',
      'devnet',
      '0xAbCdEf',
      '2005',
      '43117',
      'coupon-1',
    );

    expect(result.allowed).toBe(false);
    expect(txMocks.create).not.toHaveBeenCalled();
  });
});
