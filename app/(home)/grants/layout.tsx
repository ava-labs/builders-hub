import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Grants',
  description: 'Explore grants and other funding opportunities for builders in the Avalanche ecosystem',
  openGraph: {
    url: '/grants',
    images: {
      url: '/api/og/grants',
      width: 1200,
      height: 630,
      alt: 'Avalanche Grants',
    },
  },
  twitter: {
    images: {
      url: '/api/og/grants',
      width: 1200,
      height: 630,
      alt: 'Avalanche Grants',
    },
  },
});

export default function GrantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 