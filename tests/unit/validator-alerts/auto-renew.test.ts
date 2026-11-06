import { beforeEach, describe, expect, it, vi } from 'vitest';

// Synthetic data only: example.com addresses and made-up ids.
const mail = vi.hoisted(() => ({ sendMail: vi.fn() }));
const rpc = vi.hoisted(() => ({ pchainPost: vi.fn() }));
vi.mock('@/server/services/mail', () => mail);
vi.mock('@/lib/pchain-rpc', () => rpc);
vi.mock('@/prisma/prisma', () => ({
  prisma: {
    validatorAlertLog: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    validatorAlert: { update: vi.fn(async () => ({})) },
  },
}));

import { cycleUptime, parseAutoRenewPeriods, stakeEndFor, stakeRenews } from '@/server/services/validator-auto-renew';
import { stakeEnd } from '@/lib/validator-stake-end';
import { expiryReading, expiryWarning } from '@/components/validator-alerts/expiry';
import { checkSingleAlert } from '@/server/services/validator-alert-check';
import type { ValidatorP2P } from '@/types/validator-alerts';

const RENEWING = 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg';
const RENEWAL_OFF = 'NodeID-MFrZFVCXPv5iCn6M9K6XduxGTYp891xXZ';
const FIXED = 'NodeID-NFBbbJ4qCmNaCzeW7sxErhvWqvEQMnYcN';
const ABSENT = 'NodeID-GWPcbFJZFfZreETSoWjPimr846mXEKCtu';

const ANSWER = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    validators: [
      { nodeID: RENEWING, endTime: '1790000000', nextPeriod: '172800', uptime: '82.5000' },
      { nodeID: RENEWAL_OFF, endTime: '1790000000', nextPeriod: '0' },
      { nodeID: FIXED, endTime: '1790000000' },
    ],
  },
};
const periods = parseAutoRenewPeriods(ANSWER);
const ok = () => new Response(JSON.stringify(ANSWER), { status: 200 });

describe('parseAutoRenewPeriods', () => {
  it('lists every node and keeps nextPeriod in seconds where present', () => {
    expect([...periods.listed]).toEqual([RENEWING, RENEWAL_OFF, FIXED]);
    expect([...periods.nextPeriod]).toEqual([
      [RENEWING, 172800],
      [RENEWAL_OFF, 0],
    ]);
  });

  it('keeps the cycle uptime where present', () => {
    expect(cycleUptime(RENEWING, periods)).toBe(82.5);
    expect(cycleUptime(FIXED, periods)).toBeNull();
    expect(cycleUptime(RENEWING, null)).toBeNull();
  });

  it('throws on an answer without validators', () => {
    expect(() => parseAutoRenewPeriods({ error: { message: 'rate limited' } })).toThrow();
  });
});

describe('stakeRenews', () => {
  it('is true only for a node that auto-renews', () => {
    expect(stakeRenews(RENEWING, periods)).toBe(true);
    expect(stakeRenews(RENEWAL_OFF, periods)).toBe(false);
    expect(stakeRenews(FIXED, periods)).toBe(false);
  });

  it('is null for a node that is not in the answer', () => {
    expect(stakeRenews(ABSENT, periods)).toBeNull();
  });

  it('is null when the P-Chain read failed', () => {
    expect(stakeRenews(RENEWING, null)).toBeNull();
  });
});

describe('stakeEnd', () => {
  it('renews with uptime at or above 90%, at risk below', () => {
    expect(stakeEnd(true, 90)).toBe('renews');
    expect(stakeEnd(true, 89.9)).toBe('at_risk');
  });

  it('is final when renewal is off or the duration is fixed, whatever the uptime', () => {
    expect(stakeEnd(false, 50)).toBe('final');
    expect(stakeEnd(false, 100)).toBe('final');
  });

  it('is unknown when the renewal state is unknown', () => {
    expect(stakeEnd(null, 100)).toBe('unknown');
    expect(stakeEnd(undefined, 100)).toBe('unknown');
  });
});

describe('stakeEndFor', () => {
  it('judges renewal on the cycle uptime, not the fallback', () => {
    expect(stakeEndFor(RENEWING, periods, 99)).toBe('at_risk');
  });

  it('uses the fallback uptime when the cycle uptime is missing', () => {
    const noUptime = parseAutoRenewPeriods({
      result: { validators: [{ nodeID: RENEWING, nextPeriod: '172800' }] },
    });
    expect(stakeEndFor(RENEWING, noUptime, 99)).toBe('renews');
    expect(stakeEndFor(RENEWING, noUptime, 80)).toBe('at_risk');
  });

  it('is final or unknown regardless of uptime', () => {
    expect(stakeEndFor(RENEWAL_OFF, periods, 99)).toBe('final');
    expect(stakeEndFor(ABSENT, periods, 99)).toBe('unknown');
    expect(stakeEndFor(RENEWING, null, 99)).toBe('unknown');
  });
});

describe('getAutoRenewPeriods', () => {
  beforeEach(() => {
    vi.resetModules();
    rpc.pchainPost.mockReset();
  });
  const load = async () => (await import('@/server/services/validator-auto-renew')).getAutoRenewPeriods;

  it('retries a failed read once when asked for two attempts', async () => {
    rpc.pchainPost.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(ok());
    const get = await load();
    const result = await get({ maxAgeMs: 0, attempts: 2 });
    expect(rpc.pchainPost).toHaveBeenCalledTimes(2);
    expect(stakeRenews(RENEWING, result)).toBe(true);
  });

  it('throws after the last attempt fails', async () => {
    rpc.pchainPost.mockRejectedValue(new Error('timeout'));
    const get = await load();
    await expect(get({ maxAgeMs: 0, attempts: 2 })).rejects.toThrow('timeout');
    expect(rpc.pchainPost).toHaveBeenCalledTimes(2);
  });

  it('shares one read inside the cache age and reads again with maxAgeMs 0', async () => {
    rpc.pchainPost.mockImplementation(async () => ok());
    const get = await load();
    await Promise.all([get(), get(), get()]);
    expect(rpc.pchainPost).toHaveBeenCalledTimes(1);
    await get({ maxAgeMs: 0 });
    expect(rpc.pchainPost).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed read', async () => {
    rpc.pchainPost.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(ok());
    const get = await load();
    await expect(get()).rejects.toThrow('timeout');
    await expect(get()).resolves.toBeTruthy();
    expect(rpc.pchainPost).toHaveBeenCalledTimes(2);
  });
});

describe('dashboard expiry reading', () => {
  it('reads "Renews in Nd" with no tone for a renewing stake with good uptime', () => {
    expect(expiryReading(1, true, 99)).toEqual({ text: 'Renews in 1d', tone: null });
  });

  it('warns when a renewing stake has uptime below 90%', () => {
    expect(expiryReading(1, true, 80)).toEqual({ text: 'Renews in 1d', tone: 'warning' });
  });

  it('keeps days left and the tone when renewal is off or unknown', () => {
    expect(expiryReading(1, false, 99)).toEqual({ text: '1d', tone: 'alerting' });
    expect(expiryReading(20, null, 99)).toEqual({ text: '20d', tone: 'warning' });
    expect(expiryReading(90, undefined, 99)).toEqual({ text: '90d', tone: null });
  });

  it('never warns "Stake expiring soon" for a stake that auto-renews', () => {
    const alert = { expiry_alert: true, expiry_days: 7 };
    expect(expiryWarning({ ...alert, stake_renews: true }, 1, 99)).toBeNull();
    expect(expiryWarning({ ...alert, stake_renews: true }, 1, 80)).toBe('Renewal at risk');
    expect(expiryWarning({ ...alert, stake_renews: false }, 1, 99)).toBe('Stake expiring soon');
    expect(expiryWarning({ ...alert, stake_renews: null }, 1, 99)).toBe('Stake expiring soon');
    expect(expiryWarning(alert, 30, 99)).toBeNull();
    expect(expiryWarning({ ...alert, expiry_alert: false }, 1, 99)).toBeNull();
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

  it('sends no expiry email when the stake renews', async () => {
    const result = await checkSingleAlert(alert, validator, null, 'renews');
    expect(result.sent).toBe(0);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('sends the 1-hour expiry email when the stake end is unknown', async () => {
    const result = await checkSingleAlert(alert, validator, null, 'unknown');
    expect(result.sent).toBe(1);
    expect(mail.sendMail.mock.calls[0][2]).toMatch(/^🚨 Stake Expires Within 1 Hour/);
  });

  it('sends no day-tier expiry email when the stake end is unknown', async () => {
    const inThreeDays = {
      ...validator,
      end_time: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      days_left: 3,
    } as ValidatorP2P;
    const result = await checkSingleAlert(alert, inThreeDays, null, 'unknown');
    expect(result.sent).toBe(0);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('sends the day-tier expiry email when the stake end is final', async () => {
    const inThreeDays = {
      ...validator,
      end_time: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      days_left: 3,
    } as ValidatorP2P;
    const result = await checkSingleAlert(alert, inThreeDays, null, 'final');
    expect(result.sent).toBe(1);
    expect(mail.sendMail.mock.calls[0][2]).toMatch(/^Stake Expiry Alert/);
  });

  it('sends the expiry email when the stake end is final', async () => {
    const result = await checkSingleAlert(alert, validator, null, 'final');
    expect(result.sent).toBe(1);
    expect(mail.sendMail.mock.calls[0][2]).toMatch(/^🚨 Stake Expires Within 1 Hour/);
  });

  it('sends the renewal-at-risk email when the uptime is below the threshold', async () => {
    const result = await checkSingleAlert(alert, validator, null, 'at_risk');
    expect(result.sent).toBe(1);
    expect(mail.sendMail.mock.calls[0][2]).toMatch(/Renewal At Risk/);
    expect(mail.sendMail.mock.calls[0][3]).toMatch(/below 90%/);
  });
});
