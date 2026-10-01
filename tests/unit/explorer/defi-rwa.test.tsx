import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ permanentRedirect: vi.fn(), redirect: vi.fn() }));
vi.mock('@/components/explorer-v2/defi/DefiRwa', () => ({ DefiRwa: () => null }));

import { permanentRedirect, redirect } from 'next/navigation';
import { DefiSwitch } from '@/components/explorer-v2/network/defi-switch';
import RWAProjectPage from '@/app/(home)/stats/dapps/rwa/[slug]/page';
import ChainDefiRwaPage from '@/app/(home)/explorer/[network]/[chain]/defi/rwa/page';
import DAppPage from '@/app/(home)/stats/dapps/[slug]/page';
import { CapitalFlow, FacilityFigures, fenceAsOfDay } from '@/components/explorer-v2/defi/rwa-parts';
import { shownAnswer } from '@/components/explorer-v2/defi/rwa-data';
import { appendPage } from '@/components/explorer-v2/defi/RwaTransactions';
import { dayShort } from '@/components/explorer-v2/format';
import type { AllMetrics, FenceMetrics, TransactionRecord } from '@/lib/rwa/types';

const RWA = '/explorer/mainnet/c-chain/defi/rwa';

/* the pool's figures as the metrics route served them on 2026-10-01 (USDC base units) */
const METRICS: AllMetrics = {
  general: {
    transactedVolume: 124_154_992_423_166n,
    assetsFinanced: 61_542_595_899_000n,
    lenderRepayments: 58_542_596_780_686n,
    idleCapital: 881_686n,
    committedCapital: 3_000_000_000_000n,
    capitalTurnover: 20.5141,
    lifeSinceInception: 359,
    avgCapitalRecycling: 17.5,
    averageCapitalUtilization: 89.41,
  },
  oatfi: { capitalOutstanding: 2_999_999_118_314n, principalRepayments: 58_542_596_780_686n, convertedUsdc: 62_075_897_412_054n },
  lenderBreakdown: [
    { lender: 'Valinor', address: '0xe3cde6f051872e67d0a7c2124e9a024d80e2733f', amount: 1_666_667_000_000n, percentage: 55.55 },
    { lender: 'Avalanche', address: '0x7a75539cd0647625217ef93302855ddeb02f7093', amount: 1_333_333_000_000n, percentage: 44.44 },
  ],
  lastUpdated: '2026-10-01T17:13:02.292Z',
};

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

describe('the capital flow', () => {
  it('reads each lifetime amount once, with the lenders split and the pool on its address page', () => {
    const html = renderToStaticMarkup(<CapitalFlow metrics={METRICS} since="2025-10-07" />);
    for (const amount of ['$3M', '$61.5M', '$58.5M', '$62.1M']) expect(html.split(amount)).toHaveLength(2);
    expect(html).toContain('Valinor 56% · Avalanche 44%');
    expect(html).toContain('href="/explorer/mainnet/c-chain/address/0xe25cb545bdd47a8ec2d08001cb5661b00d47621a"');
    expect(html).toContain('359 days since Oct 7, 2025');
  });

  it('says the pool figures are unavailable when the read failed before anything arrived', () => {
    const html = renderToStaticMarkup(<CapitalFlow metrics={null} since={null} failed />);
    expect(html).toContain('unavailable');
    expect(html).not.toContain('…');
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

describe('the collections answer on screen', () => {
  it("is the current window's answer, or the last one, marked stale, while the new window loads", () => {
    const month = { key: '2026-09-02/2026-10-01', data: 'month' };
    expect(shownAnswer('2026-09-02/2026-10-01', month)).toEqual({ data: 'month', stale: false });
    expect(shownAnswer('2025-10-02/2026-10-01', month)).toEqual({ data: 'month', stale: true });
    expect(shownAnswer('all', null)).toEqual({ data: null, stale: false });
  });
});

describe("the ledger's next page", () => {
  const transfer = (txHash: string, from = '0xa', to = '0xb'): TransactionRecord => ({
    txHash,
    timestamp: '2026-10-01T12:00:00.000Z',
    from,
    fromLabel: from,
    to,
    toLabel: to,
    amount: 1n,
    direction: 'internal',
  });

  it('is dropped when the cut changed while it loaded', () => {
    const inbound = { cut: 'inbound:date', rows: [transfer('0x1')], total: 9, pages: 1 };
    expect(appendPage(inbound, 'all:date', { rows: [transfer('0x2')], total: 9 })).toBe(inbound);
  });

  it('skips a transfer already listed, counts the page and keeps the newest total', () => {
    const all = { cut: 'all:date', rows: [transfer('0x1'), transfer('0x2')], total: 3, pages: 1 };
    expect(appendPage(all, 'all:date', { rows: [transfer('0x2'), transfer('0x3')], total: 4 })).toEqual({
      cut: 'all:date',
      rows: [transfer('0x1'), transfer('0x2'), transfer('0x3')],
      total: 4,
      pages: 2,
    });
  });

  it('keeps two transfers of one transaction', () => {
    const all = { cut: 'all:date', rows: [transfer('0x1', '0xa', '0xb')], total: 2, pages: 1 };
    expect(appendPage(all, 'all:date', { rows: [transfer('0x1', '0xb', '0xc')], total: 2 })?.rows).toHaveLength(2);
  });
});
