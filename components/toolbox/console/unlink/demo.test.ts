import { describe, expect, it, vi } from 'vitest';

import {
  DEMO_RECIPIENT_ADDRESS,
  FAUCET_AMOUNT,
  FUJI_CHAIN_ID,
  TRANSFER_AMOUNT,
  UNLINK_APP_ID,
  USDCM_TOKEN_ADDRESS,
  DemoPollingTimeoutError,
  type DemoTransaction,
  findMatchingTransaction,
  formatTokenAmount,
  getDemoErrorMessage,
  getWalletIdentity,
  isAbortError,
  isFailedTransaction,
  pollUntil,
  readTokenBalance,
} from './demo';

describe('Unlink demo constants', () => {
  it('locks the approved Fuji demo values', () => {
    expect(UNLINK_APP_ID).toBe('avax-builder-hub');
    expect(FUJI_CHAIN_ID).toBe(43_113);
    expect(USDCM_TOKEN_ADDRESS).toBe('0x10Da0EBc5942E12834d165C569b86Fa6635C73A0');
    expect(FAUCET_AMOUNT).toBe('10000000000000000000');
    expect(TRANSFER_AMOUNT).toBe('1000000000000000000');
    expect(DEMO_RECIPIENT_ADDRESS.startsWith('unlink1')).toBe(true);
  });
});

describe('Unlink demo amount helpers', () => {
  it('reads the selected token balance case-insensitively', () => {
    expect(
      readTokenBalance([{ token: USDCM_TOKEN_ADDRESS.toLowerCase(), amount: FAUCET_AMOUNT }], USDCM_TOKEN_ADDRESS),
    ).toBe(10_000_000_000_000_000_000n);
  });

  it('fails closed for a missing or malformed balance', () => {
    expect(readTokenBalance([], USDCM_TOKEN_ADDRESS)).toBe(0n);
    expect(readTokenBalance([{ token: USDCM_TOKEN_ADDRESS, amount: '-1' }], USDCM_TOKEN_ADDRESS)).toBe(0n);
  });

  it('formats 18-decimal demo amounts without floating-point conversion', () => {
    expect(formatTokenAmount(FAUCET_AMOUNT)).toBe('10');
    expect(formatTokenAmount(TRANSFER_AMOUNT)).toBe('1');
    expect(formatTokenAmount('1234567890123456789')).toBe('1.2345');
  });
});

describe('Unlink account activity matching', () => {
  const transfer: DemoTransaction = {
    id: 'tx-1',
    user_address: DEMO_RECIPIENT_ADDRESS,
    sender_address: DEMO_RECIPIENT_ADDRESS,
    recipient_address: DEMO_RECIPIENT_ADDRESS,
    recipient_addresses: [DEMO_RECIPIENT_ADDRESS],
    token: USDCM_TOKEN_ADDRESS,
    amount: TRANSFER_AMOUNT,
    type: 'transfer',
    status: 'processed',
    confirmation_status: 'processed',
    funds_usable: true,
    environment: 'avalanche-fuji',
    tx_hash: `0x${'1'.repeat(64)}`,
    created_at: '2026-07-18T12:00:00.000Z',
    updated_at: '2026-07-18T12:00:01.000Z',
  };

  it('returns only the matching transfer', () => {
    expect(findMatchingTransaction([transfer], 'tx-1')).toEqual(transfer);
    expect(findMatchingTransaction([{ ...transfer, type: 'deposit' }], 'tx-1')).toBeNull();
    expect(findMatchingTransaction([transfer], 'another-id')).toBeNull();
  });

  it('detects either Engine failure status so the transfer can be retried', () => {
    expect(isFailedTransaction({ ...transfer, status: 'failed' })).toBe(true);
    expect(isFailedTransaction({ ...transfer, confirmation_status: 'failed' })).toBe(true);
    expect(isFailedTransaction(transfer)).toBe(false);
    expect(isFailedTransaction(null)).toBe(false);
  });
});

describe('wallet identity changes', () => {
  it('normalizes address casing and changes for a new account or chain', () => {
    expect(getWalletIdentity('0xAbC', FUJI_CHAIN_ID)).toBe('0xabc:43113');
    expect(getWalletIdentity('0xdef', FUJI_CHAIN_ID)).not.toBe(getWalletIdentity('0xabc', FUJI_CHAIN_ID));
    expect(getWalletIdentity('0xabc', 43_114)).not.toBe(getWalletIdentity('0xabc', FUJI_CHAIN_ID));
  });
});

describe('pollUntil', () => {
  it('retries until the selector returns a value', async () => {
    let clock = 0;
    const load = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const result = await pollUntil({
      load,
      select: (value) => (value === 1 ? value : undefined),
      label: 'test',
      intervalMs: 10,
      timeoutMs: 100,
      now: () => clock,
      sleep: async (delayMs) => {
        clock += delayMs;
      },
    });

    expect(result).toBe(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('throws a typed timeout', async () => {
    let clock = 0;
    await expect(
      pollUntil({
        load: async () => 0,
        select: () => undefined,
        label: 'balance',
        intervalMs: 10,
        timeoutMs: 20,
        now: () => clock,
        sleep: async (delayMs) => {
          clock += delayMs;
        },
      }),
    ).rejects.toBeInstanceOf(DemoPollingTimeoutError);
  });

  it('stops when the wallet run is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const caught = await pollUntil({
      load: async () => 0,
      select: () => undefined,
      label: 'aborted',
      intervalMs: 10,
      timeoutMs: 20,
      signal: controller.signal,
    }).catch((error) => error);

    expect(isAbortError(caught)).toBe(true);
  });
});

describe('Unlink demo error messages', () => {
  it('gives wallet rejection and EOA-specific guidance', () => {
    expect(getDemoErrorMessage({ code: 4001 }, 'derive')).toContain('wallet request was rejected');
    expect(getDemoErrorMessage(new Error('personal_sign returned a non-standard signature'), 'derive')).toContain(
      'EOA wallets only',
    );
  });

  it('gives explicit wrong-network and faucet-failure guidance', () => {
    expect(getDemoErrorMessage(new Error('wrong network'), 'derive')).toContain('Avalanche Fuji');
    expect(getDemoErrorMessage(new Error('upstream unavailable'), 'faucet')).toContain('faucet could not fund');
  });

  it('does not mistake an Engine error mentioning Fuji for a network mismatch', () => {
    expect(getDemoErrorMessage(new Error('Avalanche Fuji faucet unavailable'), 'faucet')).toContain(
      'faucet could not fund',
    );
  });

  it('recognizes string error codes returned by the SDK', () => {
    expect(getDemoErrorMessage({ code: '429' }, 'faucet')).toContain('rate-limited');
    expect(getDemoErrorMessage({ code: '401' }, 'activity')).toContain('authorization expired');
    expect(getDemoErrorMessage({ code: '403' }, 'transfer')).toContain('authorization expired');
    expect(getDemoErrorMessage({ code: 'RATE_LIMITED' }, 'faucet')).toContain('rate-limited');
    expect(getDemoErrorMessage({ code: 'UNAUTHORIZED' }, 'activity')).toContain('authorization expired');
    expect(getDemoErrorMessage({ code: 'FORBIDDEN' }, 'transfer')).toContain('authorization expired');
  });

  it('gives an actionable message for an insufficient private balance', () => {
    expect(getDemoErrorMessage(new Error('Private balance is too low'), 'transfer')).toContain('below 1 USDCm');
  });

  it('distinguishes funding and transfer timeouts', () => {
    expect(getDemoErrorMessage(new DemoPollingTimeoutError('funding'), 'faucet')).toContain('Funding is taking longer');
    expect(getDemoErrorMessage(new DemoPollingTimeoutError('activity'), 'transfer')).toContain(
      'transfer is taking longer',
    );
  });
});
