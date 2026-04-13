import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import {
  createMockSession,
  mockAuthSession,
} from '@/tests/api/helpers/mock-session';

// Module-level mocks (hoisted by vitest)
vi.mock('@/lib/auth/authSession');
vi.mock('@/lib/faucet/rateLimit');
vi.mock('@/server/services/consoleBadge/consoleBadgeService');
vi.mock('@avalabs/avalanchejs', () => ({
  TransferableOutput: { fromNative: vi.fn() },
  addTxSignatures: vi.fn(),
  pvm: {
    PVMApi: vi.fn().mockImplementation(() => ({
      getFeeState: vi.fn().mockResolvedValue({}),
      getUTXOs: vi.fn().mockResolvedValue({ utxos: [] }),
      issueSignedTx: vi.fn().mockResolvedValue({ txID: 'mock-tx-id' }),
    })),
    newBaseTx: vi.fn().mockReturnValue({
      getSignedTx: vi.fn(),
    }),
  },
  utils: {
    bech32ToBytes: vi.fn().mockReturnValue(new Uint8Array()),
    hexToBuffer: vi.fn().mockReturnValue(new Uint8Array()),
  },
  Context: {
    getContextFromURI: vi.fn().mockResolvedValue({ avaxAssetID: 'mock-asset-id' }),
  },
}));

import {
  checkAndReserveFaucetClaim,
  completeFaucetClaim,
  cancelFaucetClaim,
} from '@/lib/faucet/rateLimit';
import { checkAndAwardConsoleBadges } from '@/server/services/consoleBadge/consoleBadgeService';
import { GET } from '@/app/api/pchain-faucet/route';

const VALID_P_ADDRESS = 'P-fuji1abcdef1234567890abcdef1234567890abcdef12';

describe('GET /api/pchain-faucet', () => {
  const session = createMockSession();

  beforeEach(() => {
    vi.stubEnv('SERVER_PRIVATE_KEY', '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
    vi.stubEnv('FAUCET_P_CHAIN_ADDRESS', 'P-fuji1faucetaddress000000000000000000000000000');

    mockAuthSession(session);

    vi.mocked(checkAndReserveFaucetClaim).mockResolvedValue({
      allowed: true,
      claimId: 'mock-claim-id',
    });
    vi.mocked(completeFaucetClaim).mockResolvedValue();
    vi.mocked(cancelFaucetClaim).mockResolvedValue();
    vi.mocked(checkAndAwardConsoleBadges).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    mockAuthSession(null);
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/pchain-faucet',
      searchParams: { address: VALID_P_ADDRESS },
    });

    const result = await callHandler(GET, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });

  it('validates address is present', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/pchain-faucet',
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('validates P-Chain address format', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/pchain-faucet',
      searchParams: { address: '0x1234567890abcdef1234567890abcdef12345678' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
    expect(result.body.error.message).toContain('P-Chain');
  });

  it('enforces rate limiting via checkAndReserveFaucetClaim', async () => {
    vi.mocked(checkAndReserveFaucetClaim).mockResolvedValue({
      allowed: false,
      reason: 'Rate limit exceeded. You can claim again after tomorrow.',
    });

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/pchain-faucet',
      searchParams: { address: VALID_P_ADDRESS },
    });

    const result = await callHandler(GET, req);
    expectError(result, 429, 'RATE_LIMITED');
    expect(result.body.error.message).toContain('Rate limit exceeded');
  });

  it('does not leak private key material in error responses', async () => {
    vi.mocked(checkAndReserveFaucetClaim).mockRejectedValue(
      new Error('Transaction failed with key 0xdeadbeef...'),
    );

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/pchain-faucet',
      searchParams: { address: VALID_P_ADDRESS },
    });

    const result = await callHandler(GET, req);

    // Should get a generic 500, not the raw error with key material
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain('0xdeadbeef');
    expect(JSON.stringify(result.body)).not.toContain('private');
    expect(JSON.stringify(result.body)).not.toContain('key');
  });

  it('returns success with txID on successful transfer', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/pchain-faucet',
      searchParams: { address: VALID_P_ADDRESS },
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);

    expect(data.txID).toBe('mock-tx-id');
    expect(data.amount).toBe(0.5);
    expect(data.destinationAddress).toBe(VALID_P_ADDRESS);
    expect(data.awardedBadges).toEqual([]);
  });

  it('calls completeFaucetClaim on success', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/pchain-faucet',
      searchParams: { address: VALID_P_ADDRESS },
    });

    await callHandler(GET, req);

    expect(completeFaucetClaim).toHaveBeenCalledWith('mock-claim-id', 'mock-tx-id');
  });

  it('prevents sending to the faucet address itself', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/pchain-faucet',
      searchParams: { address: 'P-fuji1faucetaddress000000000000000000000000000' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'BAD_REQUEST');
    expect(result.body.error.message).toContain('faucet address');
  });
});
