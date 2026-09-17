import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import SolutionsIndex from '@/components/landing-v2/SolutionsIndex';

const ogImage = { url: '/api/og/solutions', width: 1200, height: 630, alt: 'Avalanche Solutions' };

export const metadata: Metadata = createMetadata({
  title: 'Solutions | Avalanche Builder Hub',
  description:
    'Performance, interoperability, privacy, and compliance: the four guarantees enterprise chains on Avalanche are built on.',
  openGraph: { url: '/solutions', images: ogImage },
  twitter: { images: ogImage },
});

export default function SolutionsPage() {
  return <SolutionsIndex />;
}
