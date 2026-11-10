import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ permanentRedirect: vi.fn(), redirect: vi.fn() }));
vi.mock('@/components/explorer-v2/defi/DefiRwa', () => ({ DefiRwa: () => null }));

import { permanentRedirect, redirect } from 'next/navigation';
import { DefiSwitch } from '@/components/explorer-v2/network/defi-switch';
import RWAProjectPage from '@/app/(home)/stats/dapps/rwa/[slug]/page';
import ChainDefiRwaPage from '@/app/(home)/explorer/[network]/[chain]/defi/rwa/page';
import DAppPage from '@/app/(home)/stats/dapps/[slug]/page';
import { FacilityFigures, fenceAsOfDay } from '@/components/explorer-v2/defi/rwa-parts';
import { dayShort } from '@/components/explorer-v2/format';
import type { FenceMetrics } from '@/lib/rwa/types';

const RWA = '/explorer/mainnet/c-chain/defi/rwa';

const FENCE: FenceMetrics = {
  paidTotalCollections: { value: 58_837_806.6, asOfDate: '2026-10-01T17:02:02.887574' },
  expectedTotalCollections: { value: 57_867_071.17, asOfDate: '2026-10-01T17:00:32.523531' },
  cl01Concentration: null,
  repaymentRatio: 1.0168,
  lastUpdated: '2026-10-01T17:13:04.381Z',
};

/** each link of the switch: its href and whether it marks the current page */
const links = (html: string) => [...html.matchAll(/<a([^>]*)>/g)].map(([, attrs]) => ({ href: /href="([^"]+)"/.exec(attrs)?.[1], current: attrs.includes('aria-current="page"') }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('the DeFi switch', () => {
  it('offers the RWA view after protocols, flows and stablecoins, and marks it when it is open', () => {
    const views = links(renderToStaticMarkup(<DefiSwitch on="rwa" />));
    expect(views.map((v) => v.href)).toEqual(['/explorer/mainnet/c-chain/defi', '/explorer/mainnet/c-chain/defi/flows', '/explorer/mainnet/c-chain/defi/stablecoins', RWA]);
    expect(views.filter((v) => v.current).map((v) => v.href)).toEqual([RWA]);
  });
});

describe('the old RWA dashboard links', () => {
  it('land on the RWA view for a known project', async () => {
    await RWAProjectPage({ params: Promise.resolve({ slug: 'fence' }) });
    expect(permanentRedirect).toHaveBeenCalledWith(RWA);
  });

  it('land on the DeFi tab for an unknown project', async () => {
    await RWAProjectPage({ params: Promise.resolve({ slug: 'nope' }) });
    expect(permanentRedirect).toHaveBeenCalledWith('/explorer/mainnet/c-chain/defi');
  });

  it("send an RWA project's old dApp page to the RWA view, as it once sent it to the dashboard", async () => {
    await DAppPage({ params: Promise.resolve({ slug: 'oatfi' }) });
    expect(permanentRedirect).toHaveBeenCalledWith(RWA);
  });
});

describe('the RWA view page', () => {
  it('sends any other chain or network to the DeFi tab', async () => {
    await ChainDefiRwaPage({ params: Promise.resolve({ network: 'fuji', chain: 'c-chain' }) });
    expect(redirect).toHaveBeenCalledWith('/explorer/mainnet/c-chain/defi');
  });

  it('stays on mainnet C-Chain', async () => {
    await ChainDefiRwaPage({ params: Promise.resolve({ network: 'mainnet', chain: 'c-chain' }) });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('the facility figures', () => {
  it('read n/a for a Fence metric that came back empty, not zero', () => {
    const html = renderToStaticMarkup(<FacilityFigures fence={FENCE} failed={false} />);
    expect(html).toContain('$58.8M');
    expect(html).toContain('$57.9M');
    expect(html).toContain('101.7%');
    expect(html).toContain('n/a');
    expect(html).not.toContain('0.0%');
  });

  it('say the facility is unavailable when Fence failed before anything was read', () => {
    const html = renderToStaticMarkup(<FacilityFigures fence={null} failed />);
    expect(html).toContain('unavailable');
    expect(html).not.toContain('$');
  });
});

describe("Fence's as-of day", () => {
  it('is the UTC day of the reading in any time zone the page is read in', () => {
    const zone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      // 17:02 UTC on Oct 1 is still Oct 1 in Los Angeles, and Fence sends no offset
      expect(dayShort(fenceAsOfDay(FENCE) ?? '')).toBe('Oct 1');
    } finally {
      process.env.TZ = zone;
    }
  });

  it('is absent before Fence answered', () => {
    expect(fenceAsOfDay(null)).toBeNull();
  });
});
