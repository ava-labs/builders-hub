import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import EcosystemIndex from '@/components/landing-v2/EcosystemIndex';

const ogImage = { url: '/api/og/default', width: 1200, height: 630, alt: 'Avalanche Ecosystem' };

export const metadata: Metadata = createMetadata({
  title: 'Ecosystem | Avalanche Builder Hub',
  description:
    'Finance, gaming, payments, community: the Avalanche ecosystem and the Team1 community events, programs and grants growing it.',
  openGraph: { url: '/ecosystem', images: ogImage },
  twitter: { images: ogImage },
});

export default function EcosystemPage() {
  return <EcosystemIndex />;
}
