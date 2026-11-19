import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ permanentRedirect: vi.fn(), redirect: vi.fn() }));
vi.mock('@/components/explorer-v2/defi/DefiRwa', () => ({ DefiRwa: () => null }));
// the RWA view's frame, dashboard and reads, so a render of the view shows which facility each read names
vi.mock('@/components/explorer-v2/EvmShell', () => ({ EvmShell: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/explorer-v2/defi/RwaDashboard', () => ({ RwaDashboard: vi.fn(() => null) }));
vi.mock('@/lib/rwa/hooks/useMetrics', () => ({ useMetrics: vi.fn(() => ({ metrics: null, error: null, refresh: async () => undefined })) }));
vi.mock('@/lib/rwa/hooks/useHistorical', () => ({ useHistorical: vi.fn(() => ({ historical: null, error: null, refresh: async () => undefined })) }));
vi.mock('@/lib/rwa/hooks/useFenceMetrics', () => ({ useFenceMetrics: vi.fn(() => ({ fenceMetrics: null, error: null, refresh: async () => undefined })) }));
vi.mock('@/lib/rwa/hooks/useFenceHistorical', () => ({ useFenceHistorical: vi.fn(() => ({ fenceHistorical: null, error: null, refresh: async () => undefined })) }));

import { permanentRedirect, redirect } from 'next/navigation';
import { DefiSwitch } from '@/components/explorer-v2/network/defi-switch';
import RWAProjectPage from '@/app/(home)/stats/dapps/rwa/[slug]/page';
import ChainDefiRwaPage from '@/app/(home)/explorer/[network]/[chain]/defi/rwa/page';
import ChainDefiRwaRainPage, { metadata as rainMetadata } from '@/app/(home)/explorer/[network]/[chain]/defi/rwa/rain/page';
import DAppPage from '@/app/(home)/stats/dapps/[slug]/page';
import { FacilitySwitch } from '@/components/explorer-v2/defi/facility-switch';
import { RwaDashboard } from '@/components/explorer-v2/defi/RwaDashboard';
import { RWA_VIEWS } from '@/components/explorer-v2/defi/rwa-views';
import { FacilityFigures, fenceAsOfDay } from '@/components/explorer-v2/defi/rwa-parts';
import { dayShort } from '@/components/explorer-v2/format';
import { useFenceHistorical } from '@/lib/rwa/hooks/useFenceHistorical';
import { useFenceMetrics } from '@/lib/rwa/hooks/useFenceMetrics';
import { useHistorical } from '@/lib/rwa/hooks/useHistorical';
import { useMetrics } from '@/lib/rwa/hooks/useMetrics';
import type { FenceMetrics } from '@/lib/rwa/types';

/** the RWA view itself: the pages above render a stand-in for it */
const { DefiRwa } = await vi.importActual<typeof import('@/components/explorer-v2/defi/DefiRwa')>('@/components/explorer-v2/defi/DefiRwa');

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

describe('the RWA facilities', () => {
  it('the facility switch offers OatFi then Rain, each at its own URL, and marks the open one', () => {
    const html = renderToStaticMarkup(<FacilitySwitch on="rain" />);
    expect(html).toContain('aria-label="RWA facility"');
    expect(links(html).map((v) => v.href)).toEqual([RWA, `${RWA}/rain`]);
    expect(links(html).filter((v) => v.current).map((v) => v.href)).toEqual([`${RWA}/rain`]);
    expect([...html.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map(([, label]) => label)).toEqual(['OatFi', 'Rain']);
  });

  it("Rain's page sends any other chain or network to the DeFi tab", async () => {
    await ChainDefiRwaRainPage({ params: Promise.resolve({ network: 'fuji', chain: 'c-chain' }) });
    await ChainDefiRwaRainPage({ params: Promise.resolve({ network: 'mainnet', chain: 'beam' }) });
    expect(vi.mocked(redirect).mock.calls).toEqual([['/explorer/mainnet/c-chain/defi'], ['/explorer/mainnet/c-chain/defi']]);
  });

  it("Rain's page opens Rain's facility on mainnet C-Chain", async () => {
    const page = await ChainDefiRwaRainPage({ params: Promise.resolve({ network: 'mainnet', chain: 'c-chain' }) });
    expect(redirect).not.toHaveBeenCalled();
    expect(page.props).toEqual({ slug: 'rain' });
  });

  it("Rain's page names Rain in its title and its link preview", () => {
    expect(rainMetadata.title).toBe('C-Chain DeFi: RWA, Rain | Avalanche Explorer');
    expect(rainMetadata.openGraph?.title).toBe('C-Chain DeFi: RWA, Rain');
    expect(rainMetadata.openGraph?.url).toBe('/explorer/mainnet/c-chain/defi/rwa/rain');
  });

  it("OatFi's page still opens OatFi's facility", async () => {
    const page = await ChainDefiRwaPage({ params: Promise.resolve({ network: 'mainnet', chain: 'c-chain' }) });
    expect(page.props).toEqual({ slug: 'oatfi' });
  });

  it.each([
    ['oatfi', true],
    ['rain', false],
  ] as const)("%s's view reads only its own facility, and asks Fence only for a facility that has it", (slug, fence) => {
    const html = renderToStaticMarkup(<DefiRwa slug={slug} />);
    expect(vi.mocked(useMetrics).mock.calls).toEqual([[{ slug }]]);
    expect(vi.mocked(useHistorical).mock.calls).toEqual([[{ slug }]]);
    expect(vi.mocked(useFenceMetrics).mock.calls).toEqual([[{ slug, enabled: fence }]]);
    expect(vi.mocked(useFenceHistorical).mock.calls).toEqual([[{ slug, enabled: fence }]]);
    expect(vi.mocked(RwaDashboard).mock.calls[0][0].view).toBe(RWA_VIEWS[slug]);
    // the DeFi switch marks the RWA view, and the facility switch beside it the open facility
    expect(links(html).filter((v) => v.current).map((v) => v.href)).toEqual([RWA, RWA_VIEWS[slug].href]);
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
