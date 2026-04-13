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
vi.mock('@/lib/faucet/nonceManager');
vi.mock('@/server/services/consoleBadge/consoleBadgeService');
vi.mock('@/components/toolbox/stores/l1ListStore', () => ({
  getL1ListStore: vi.fn().mockReturnValue({
    getState: () => ({
      l1List: [
        {
          evmChainId: 43113,
          name: 'Avalanche Fuji',
          coinName: 'AVAX',
          rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
          explorerUrl: 'https://testnet.snowtrace.io',
          hasBuilderHubFaucet: true,
          faucetThresholds: { dripAmount: 2 },
        },
      ],
    }),
  }),
}));
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createWalletClient: vi.fn().mockReturnValue({
      sendTransaction: vi.fn().mockResolvedValue('0xmocktxhash1234'),
    }),
    createPublicClient: vi.fn().mockReturnValue({
      getBalance: vi.fn().mockResolvedValue(BigInt('10000000000000000000')),
      getTransactionCount: vi.fn().mockResolvedValue(42),
    }),
  };
});
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({
    address: '0x1111111111111111111111111111111111111111',
  }),
}));

import {
  checkAndReserveFaucetClaim,
  completeFaucetClaim,
  cancelFaucetClaim,
} from '@/lib/faucet/rateLimit';
import { withChainLock, withNonceRetry } from '@/lib/faucet/nonceManager';
import { checkAndAwardConsoleBadges } from '@/server/services/consoleBadge/consoleBadgeService';
import { GET } from '@/app/api/evm-chain-faucet/route';

const VALID_EVM_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const FAUCET_EVM_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('GET /api/evm-chain-faucet', () => {
  const session = createMockSession();

  beforeEach(() => {
    vi.stubEnv('FAUCET_C_CHAIN_PRIVATE_KEY', '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
    vi.stubEnv('FAUCET_C_CHAIN_ADDRESS', FAUCET_EVM_ADDRESS);

    mockAuthSession(session);

    vi.mocked(checkAndReserveFaucetClaim).mockResolvedValue({
      allowed: true,
      claimId: 'mock-claim-id',
    });
    vi.mocked(completeFaucetClaim).mockResolvedValue();
    vi.mocked(cancelFaucetClaim).mockResolvedValue();
    vi.mocked(checkAndAwardConsoleBadges).mockResolvedValue([]);
    vi.mocked(withChainLock).mockImplementation(async (_chainId, fn) => fn());
    vi.mocked(withNonceRetry).mockImplementation(async (fn) => fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    mockAuthSession(null);
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: VALID_EVM_ADDRESS, chainId: '43113' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });

  it('validates EVM address format with regex', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: 'not-an-address', chainId: '43113' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
    expect(result.body.error.message).toContain('Ethereum address');
  });

  it('validates chainId is required', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: VALID_EVM_ADDRESS },
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('validates chainId is numeric', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: VALID_EVM_ADDRESS, chainId: 'abc' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
    expect(result.body.error.message).toContain('chain ID');
  });

  it('enforces rate limiting via checkAndReserveFaucetClaim', async () => {
    vi.mocked(checkAndReserveFaucetClaim).mockResolvedValue({
      allowed: false,
      reason: 'This address has reached its daily claim limit.',
    });

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: VALID_EVM_ADDRESS, chainId: '43113' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 429, 'RATE_LIMITED');
    expect(result.body.error.message).toContain('daily claim limit');
  });

  it('does not leak private key material in error responses', async () => {
    vi.mocked(withChainLock).mockRejectedValue(
      new Error('Transaction signed with key 0xdeadbeef failed'),
    );

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: VALID_EVM_ADDRESS, chainId: '43113' },
    });

    const result = await callHandler(GET, req);

    expect(result.status).toBe(500);
    const responseText = JSON.stringify(result.body);
    expect(responseText).not.toContain('0xdeadbeef');
    expect(responseText).not.toContain('FAUCET_C_CHAIN_PRIVATE_KEY');
    expect(result.body.error.message).toContain('Faucet transaction failed');
  });

  it('cancels claim on transfer failure', async () => {
    vi.mocked(withChainLock).mockRejectedValue(new Error('RPC timeout'));

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: VALID_EVM_ADDRESS, chainId: '43113' },
    });

    await callHandler(GET, req);
    expect(cancelFaucetClaim).toHaveBeenCalledWith('mock-claim-id');
  });

  it('rejects unsupported chain IDs', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: VALID_EVM_ADDRESS, chainId: '999999' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'BAD_REQUEST');
    expect(result.body.error.message).toContain('does not support');
  });

  it('prevents sending to the faucet address itself', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: {
        address: FAUCET_EVM_ADDRESS,
        chainId: '43113',
      },
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'BAD_REQUEST');
    expect(result.body.error.message).toContain('faucet address');
  });

  it('returns success with txHash on successful transfer', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: VALID_EVM_ADDRESS, chainId: '43113' },
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);

    expect(data.txHash).toBeDefined();
    expect(data.chainId).toBe(43113);
    expect(data.destinationAddress).toBe(VALID_EVM_ADDRESS);
    expect(data.amount).toBe('2');
    expect(data.awardedBadges).toEqual([]);
  });

  it('passes chainId to checkAndReserveFaucetClaim', async () => {
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evm-chain-faucet',
      searchParams: { address: VALID_EVM_ADDRESS, chainId: '43113' },
    });

    await callHandler(GET, req);

    expect(checkAndReserveFaucetClaim).toHaveBeenCalledWith(
      session.user.id,
      'evm',
      VALID_EVM_ADDRESS,
      '2',
      '43113',
    );
  });
});
