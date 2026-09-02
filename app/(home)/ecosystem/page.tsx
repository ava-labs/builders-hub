import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import EcosystemIndex from '@/components/landing-v2/EcosystemIndex';
import { getFilteredHackathons } from '@/server/services/hackathons';
import type { HackathonHeader } from '@/types/hackathons';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://build.avax.network';
const EVENT_CARD_LIMIT = 4;

const ogImage = { url: '/api/og/default', width: 1200, height: 630, alt: 'Avalanche Ecosystem' };

export const metadata: Metadata = createMetadata({
  title: 'Ecosystem | Avalanche Builder Hub',
  description:
    'Finance, gaming, payments, community: the Avalanche ecosystem and the Team1 community events, programs and grants growing it.',
  openGraph: { url: '/ecosystem', images: ogImage },
  twitter: { images: ogImage },
});

// Same source as /events: ongoing first, then upcoming, then the most recent
// past events fill the remaining slots. The page must render without the
// events store, so failures degrade to an empty list.
async function getEvents(): Promise<HackathonHeader[]> {
  try {
    const [ongoing, upcoming, ended] = await Promise.all([
      getFilteredHackathons({ page: 1, pageSize: EVENT_CARD_LIMIT, status: 'ONGOING' }),
      getFilteredHackathons({ page: 1, pageSize: EVENT_CARD_LIMIT, status: 'UPCOMING' }),
      getFilteredHackathons({ page: 1, pageSize: EVENT_CARD_LIMIT, status: 'ENDED' }),
    ]);
    return [...ongoing.hackathons, ...upcoming.hackathons, ...ended.hackathons].slice(
      0,
      EVENT_CARD_LIMIT,
    );
  } catch (error) {
    console.error('Failed to load ecosystem events:', error);
    return [];
  }
}

// Live L1 count, the same P-Chain registry query the homepage ledger uses.
async function getL1Count(): Promise<number | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/validator-stats?network=mainnet`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const subnets: { isL1?: boolean }[] = await res.json();
    const count = subnets.filter((s) => s.isL1).length;
    return count > 0 ? count : null;
  } catch (error) {
    console.error('Failed to fetch L1 count:', error);
    return null;
  }
}

export default async function EcosystemPage() {
  const [events, l1Count] = await Promise.all([getEvents(), getL1Count()]);
  return <EcosystemIndex events={events} l1Count={l1Count} />;
}
