import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import EcosystemIndex from '@/components/ecosystem/EcosystemIndex';
import { getEcosystemFigures } from '@/server/services/ecosystem';

// the event and audit figures come from the database: refresh them hourly, as /events does
export const revalidate = 3600;

const ogImage = { url: '/api/og/ecosystem', width: 1200, height: 630, alt: 'Avalanche Ecosystem' };

export const metadata: Metadata = createMetadata({
  title: 'Ecosystem',
  description: 'Events, programs, guides and tools for builders on Avalanche.',
  openGraph: { url: '/ecosystem', images: ogImage },
  twitter: { images: ogImage },
});

export default async function EcosystemPage() {
  const figures = await getEcosystemFigures();
  return <EcosystemIndex figures={figures} />;
}
