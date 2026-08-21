import { NextResponse } from 'next/server';
import { documentation, blog, academy, integration } from '@/lib/source';
import type { DocumentRecord } from 'fumadocs-core/search/algolia';
import l1Chains from '@/constants/l1-chains.json';

export const revalidate = false;

// Static stats pages
const statsPages: DocumentRecord[] = [
  { title: 'Network Overview', url: '/explorer/mainnet', _id: '/explorer/mainnet', structured: { headings: [], contents: [] }, description: 'Avalanche network overview stats', tag: 'stats' },
  { title: 'AVAX Token', url: '/explorer/mainnet/token', _id: '/explorer/mainnet/token', structured: { headings: [], contents: [] }, description: 'AVAX token metrics', tag: 'stats' },
  { title: 'Network Metrics', url: '/stats/network-metrics', _id: '/stats/network-metrics', structured: { headings: [], contents: [] }, description: 'Network-wide metrics', tag: 'stats' },
  { title: 'C-Chain Gas Market', url: '/explorer/mainnet/c-chain/gas', _id: '/explorer/mainnet/c-chain/gas', structured: { headings: [], contents: [] }, description: 'Live gas market, fee history, and gas usage by protocol', tag: 'stats' },
  { title: 'Interchain Messaging', url: '/explorer/mainnet/icm', _id: '/explorer/mainnet/icm', structured: { headings: [], contents: [] }, description: 'ICM statistics', tag: 'stats' },
  { title: 'Chain List', url: '/explorer/mainnet/chains', _id: '/explorer/mainnet/chains', structured: { headings: [], contents: [] }, description: 'All Avalanche L1 chains', tag: 'stats' },
  { title: 'Validators', url: '/explorer/mainnet/validators', _id: '/explorer/mainnet/validators', structured: { headings: [], contents: [] }, description: 'Validator dashboard', tag: 'stats' },
];

// Generate per-L1 accounts pages from chain registry (the old per-chain
// stats sheet dissolved into the explorer's subject tabs; accounts is
// the one that exists for every catalog chain)
const l1StatsPages: DocumentRecord[] = l1Chains.map((chain: any) => ({
  title: `${chain.chainName} Accounts`,
  url: `/explorer/mainnet/${chain.slug}/accounts`,
  _id: `/explorer/mainnet/${chain.slug}/accounts`,
  structured: { headings: [], contents: [] },
  description: `Active addresses, contracts deployed, and top accounts for ${chain.chainName}${chain.category ? ` (${chain.category})` : ''}`,
  tag: 'stats',
}));

export async function GET() {
  const results: DocumentRecord[] = await Promise.all([
    ...documentation.getPages().map(async (page) => {
      const loadedData = await page.data.load()
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: loadedData.structuredData,
        description: page.data.description,
        tag: 'docs'
      }
    }),
    ...academy.getPages().map((page) => {
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: page.data.structuredData,
        description: page.data.description,
        tag: 'academy'
      }
    }),
    ...integration.getPages().map(async (page) => {
      const loadedData = await page.data.load()
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: loadedData.structuredData,
        description: page.data.description,
        tag: 'integrations'
      }
    }),
    ...blog.getPages().map((page) => {
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: page.data.structuredData,
        description: page.data.description,
        tag: 'blog'
      }
    })
  ]);

  return NextResponse.json([...results, ...statsPages, ...l1StatsPages]);
}