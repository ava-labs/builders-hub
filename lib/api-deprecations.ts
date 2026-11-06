export interface ApiDeprecation {
  name: string;
  /** Docs slugs under /docs that this deprecation covers, e.g. ['api-reference', 'metrics-api']. */
  slugPrefix: string[];
  /** ISO 8601 timestamps in UTC. */
  deprecatedAt: string;
  sunsetAt: string;
  decommissionedAt: string;
}

export const API_DEPRECATIONS: ApiDeprecation[] = [
  {
    name: 'Metrics API',
    slugPrefix: ['api-reference', 'metrics-api'],
    deprecatedAt: '2026-11-05T00:00:00Z',
    sunsetAt: '2026-11-16T12:00:00Z',
    decommissionedAt: '2026-11-30T12:00:00Z',
  },
];

export function getApiDeprecation(slugs: string[]): ApiDeprecation | undefined {
  return API_DEPRECATIONS.find(({ slugPrefix }) => slugPrefix.every((part, i) => slugs[i] === part));
}

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });

/** "November 16, 2026", or "November 16, 2026 12:00 UTC" when the time is not midnight. */
export function formatDeprecationDate(iso: string): string {
  const date = new Date(iso);
  const day = dateFormat.format(date);
  return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 ? day : `${day} ${timeFormat.format(date)} UTC`;
}
