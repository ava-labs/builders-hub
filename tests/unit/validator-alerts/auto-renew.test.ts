import { beforeEach, describe, expect, it, vi } from 'vitest';

// Synthetic data only: example.com addresses and made-up ids.
const mail = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('@/server/services/mail', () => mail);
vi.mock('@/prisma/prisma', () => ({
  prisma: {
    validatorAlertLog: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    validatorAlert: { update: vi.fn(async () => ({})) },
  },
}));

import { parseAutoRenewPeriods, stakeEndIsFinal } from '@/server/services/validator-auto-renew';
import { checkSingleAlert } from '@/server/services/validator-alert-check';
import type { ValidatorP2P } from '@/types/validator-alerts';

const RENEWING = 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg';
const RENEWAL_OFF = 'NodeID-MFrZFVCXPv5iCn6M9K6XduxGTYp891xXZ';
const FIXED = 'NodeID-NFBbbJ4qCmNaCzeW7sxErhvWqvEQMnYcN';

const periods = parseAutoRenewPeriods({
  jsonrpc: '2.0',
  id: 1,
  result: {
    validators: [
      { nodeID: RENEWING, endTime: '1790000000', nextPeriod: '172800' },
      { nodeID: RENEWAL_OFF, endTime: '1790000000', nextPeriod: '0' },
      { nodeID: FIXED, endTime: '1790000000' },
    ],
  },
});

describe('parseAutoRenewPeriods', () => {
  it('keeps only validators with a nextPeriod, in seconds', () => {
    expect([...periods]).toEqual([
      [RENEWING, 172800],
      [RENEWAL_OFF, 0],
    ]);
  });

  it('throws on an answer without validators', () => {
    expect(() => parseAutoRenewPeriods({ error: { message: 'rate limited' } })).toThrow();
  });
});

describe('stakeEndIsFinal', () => {
  it('is false for a node that auto-renews', () => {
    expect(stakeEndIsFinal(RENEWING, periods)).toBe(false);
  });

  it('is true for a node whose renewal is off', () => {
    expect(stakeEndIsFinal(RENEWAL_OFF, periods)).toBe(true);
  });

  it('is true for a fixed-duration node', () => {
    expect(stakeEndIsFinal(FIXED, periods)).toBe(true);
  });

  it('is false when the P-Chain read failed', () => {
    expect(stakeEndIsFinal(FIXED, null)).toBe(false);
    expect(stakeEndIsFinal(RENEWING, null)).toBe(false);
  });
});

describe('checkSingleAlert expiry gate', () => {
  const alert = {
    id: 'alert-1',
    node_id: RENEWING,
    subnet_id: 'primary',
    email: 'operator@example.com',
    label: null,
    uptime_alert: false,
    uptime_threshold: 95,
    version_alert: false,
    expiry_alert: true,
    expiry_days: 7,
    balance_alert: false,
    balance_threshold: 0,
    balance_threshold_days: 30,
    security_alert: false,
    last_known_ip: null,
    last_security_check_at: null,
  };
  // The cycle ends in 30 minutes: the one-shot "within 1 hour" tier.
  const validator = {
    node_id: RENEWING,
    p50_uptime: 100,
    version: 'avalanchego/1.14.0',
    end_time: new Date(Date.now() + 30 * 60_000).toISOString(),
    days_left: 0,
    public_ip: '',
  } as ValidatorP2P;

  beforeEach(() => mail.sendMail.mockReset());

  it('sends no expiry email when the stake end is not final', async () => {
    const result = await checkSingleAlert(alert, validator, null, false);
    expect(result.sent).toBe(0);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('sends the expiry email when the stake end is final', async () => {
    const result = await checkSingleAlert(alert, validator, null, true);
    expect(result.sent).toBe(1);
    expect(mail.sendMail).toHaveBeenCalledOnce();
  });
});
