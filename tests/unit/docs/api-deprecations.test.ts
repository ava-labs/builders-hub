import { describe, expect, it } from 'vitest';
import { formatDeprecationDate, getApiDeprecation } from '@/lib/api-deprecations';

describe('getApiDeprecation', () => {
  it('covers every page of the Metrics and Webhooks API references', () => {
    expect(getApiDeprecation(['api-reference', 'metrics-api'])?.name).toBe('Metrics API');
    expect(getApiDeprecation(['api-reference', 'metrics-api', 'evm-chains', 'getEvmChainMetrics'])?.name).toBe(
      'Metrics API',
    );
    expect(getApiDeprecation(['api-reference', 'webhook-api', 'webhooks', 'createWebhook'])?.name).toBe(
      'Webhooks API',
    );
  });

  it('leaves other pages alone', () => {
    expect(getApiDeprecation(['api-reference', 'data-api'])).toBeUndefined();
    expect(getApiDeprecation(['api-reference'])).toBeUndefined();
    expect(getApiDeprecation(['rpcs', 'other', 'metrics-api'])).toBeUndefined();
  });
});

describe('formatDeprecationDate', () => {
  it('shows the UTC time unless it is midnight', () => {
    expect(formatDeprecationDate('2026-11-05T00:00:00Z')).toBe('November 5, 2026');
    expect(formatDeprecationDate('2026-11-16T12:00:00Z')).toBe('November 16, 2026 12:00 UTC');
  });
});
