import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Tools',
  description: 'Discover developer tools and resources for building on Avalanche',
  openGraph: {
    url: '/tools',
    images: {
      url: '/api/og/tools',
      width: 1200,
      height: 630,
      alt: 'Avalanche Tools',
    },
  },
  twitter: {
    images: {
      url: '/api/og/tools',
      width: 1200,
      height: 630,
      alt: 'Avalanche Tools',
    },
  },
});

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 