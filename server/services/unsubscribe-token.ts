import { createHmac } from 'crypto';

function getSecret(): string {
  return process.env.VALIDATOR_ALERTS_API_KEY || process.env.CRON_SECRET || 'fallback-secret';
}

export function generateUnsubscribeToken(alertId: string): string {
  return createHmac('sha256', getSecret()).update(alertId).digest('hex');
}

export function verifyUnsubscribeToken(alertId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(alertId);
  return expected === token;
}

export function getUnsubscribeUrl(alertId: string): string {
  const token = generateUnsubscribeToken(alertId);
  return `https://build.avax.network/api/validator-alerts/unsubscribe?id=${alertId}&token=${token}`;
}
