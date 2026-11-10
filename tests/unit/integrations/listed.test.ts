import { describe, expect, it } from 'vitest';
import { integrationCategoryCount, listedIntegrations } from '@/lib/integrations/listed';

// The filter behind the /integrations header counts, which other pages quote.
describe('listed integrations', () => {
  const listed = (title: unknown, extra: Record<string, unknown> = {}) => ({
    url: `/integrations/${String(title)}`,
    data: { title, category: 'Wallets', logo: '/images/x.png', description: 'd', ...extra },
  });

  it('leaves out README entries and entries without a title, category, logo, description or url', () => {
    const pages = [
      listed('Core'),
      listed('README'),
      listed(undefined),
      listed('No category', { category: undefined }),
      listed('No logo', { logo: undefined }),
      listed('No description', { description: undefined }),
      { ...listed('No url'), url: undefined },
    ];
    expect(listedIntegrations(pages).map((p) => p.data.title)).toEqual(['Core']);
  });

  it('counts distinct categories', () => {
    const pages = [listed('A'), listed('B'), listed('C', { category: 'Oracles' })];
    expect(integrationCategoryCount(listedIntegrations(pages))).toBe(2);
  });
});
