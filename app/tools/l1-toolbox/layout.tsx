import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';

export const metadata: Metadata = createMetadata({
  title: 'L1 Toolbox | Avalanche Builder Hub',
  description: 'Manage your L1 with a highly granular set of tools for the Avalanche ecosystem',
  openGraph: {
    url: '/tools/l1-toolbox',
    images: {
      url: '/api/og/tools/l1-toolbox',
      width: 1200,
      height: 630,
      alt: 'Avalanche L1 Toolbox',
    },
  },
  twitter: {
    images: {
      url: '/api/og/tools/l1-toolbox',
      width: 1200,
      height: 630,
      alt: 'Avalanche L1 Toolbox',
    },
  },
});

export default function L1ToolboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 