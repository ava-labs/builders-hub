import { NextResponse } from 'next/server';
import { documentation, blog, academy, integration } from '@/lib/source';
import type { DocumentRecord } from 'fumadocs-core/search/algolia';
import l1Chains from '@/constants/l1-chains.json';

export const revalidate = false;

// Static stats pages
const statsPages: DocumentRecord[] = [
  { title: 'Network Overview', url: '/stats/overview', _id: '/stats/overview', structured: { headings: [], contents: [] }, description: 'Avalanche network overview stats', tag: 'stats' },
  { title: 'AVAX Token', url: '/stats/avax-token', _id: '/stats/avax-token', structured: { headings: [], contents: [] }, description: 'AVAX token metrics', tag: 'stats' },
  { title: 'Network Metrics', url: '/stats/network-metrics', _id: '/stats/network-metrics', structured: { headings: [], contents: [] }, description: 'Network-wide metrics', tag: 'stats' },
  { title: 'DApp Gas Usage', url: '/stats/dapps/treemap', _id: '/stats/dapps/treemap', structured: { headings: [], contents: [] }, description: 'DApp gas usage treemap', tag: 'stats' },
  { title: 'Interchain Messaging', url: '/stats/interchain-messaging', _id: '/stats/interchain-messaging', structured: { headings: [], contents: [] }, description: 'ICM statistics', tag: 'stats' },
  { title: 'Chain List', url: '/stats/chain-list', _id: '/stats/chain-list', structured: { headings: [], contents: [] }, description: 'All Avalanche L1 chains', tag: 'stats' },
  { title: 'Validators', url: '/stats/validators', _id: '/stats/validators', structured: { headings: [], contents: [] }, description: 'Validator dashboard', tag: 'stats' },
];

// Generate per-L1 stats pages from chain registry
const l1StatsPages: DocumentRecord[] = l1Chains.map((chain: any) => ({
  title: `${chain.chainName} Stats`,
  url: `/stats/l1/${chain.slug}`,
  _id: `/stats/l1/${chain.slug}`,
  structured: { headings: [], contents: [] },
  description: `Real-time metrics for ${chain.chainName}${chain.category ? ` (${chain.category})` : ''}`,
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