import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Events',
  description: 'Discover upcoming events, hackathons, and conferences in the Avalanche ecosystem',
  openGraph: {
    url: '/events',
    images: {
      url: '/api/og/events',
      width: 1200,
      height: 630,
      alt: 'Avalanche Events',
    },
  },
  twitter: {
    images: {
      url: '/api/og/events',
      width: 1200,
      height: 630,
      alt: 'Avalanche Events',
    },
  },
});

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 