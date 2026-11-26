import { createHmac, timingSafeEqual } from 'crypto';

/* The key of the unsubscribe links: the alerts key, else the cron key, else the session key (set wherever a user
   can sign in to make an alert). With none set there is no fixed stand-in: a link signed with a text that is in
   the source could be made by anyone. No link is made then, and no token passes. */
function getSecret(): string | null {
  return process.env.VALIDATOR_ALERTS_API_KEY || process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || null;
}

export function generateUnsubscribeToken(alertId: string): string {
  const secret = getSecret();
  if (!secret) throw new Error('No key is set for unsubscribe links (VALIDATOR_ALERTS_API_KEY, CRON_SECRET or NEXTAUTH_SECRET)');
  return createHmac('sha256', secret).update(alertId).digest('hex');
}

export function verifyUnsubscribeToken(alertId: string, token: string): boolean {
  if (!getSecret() || typeof token !== 'string') return false;
  const expected = Buffer.from(generateUnsubscribeToken(alertId));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function getUnsubscribeUrl(alertId: string): string {
  const token = generateUnsubscribeToken(alertId);
  return `https://build.avax.network/api/validator-alerts/unsubscribe?id=${alertId}&token=${token}`;
}
