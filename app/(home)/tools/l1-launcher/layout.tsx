import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';

export const metadata: Metadata = createMetadata({
  title: 'L1 Launcher',
  description: 'Guided deployment platform for launching self-hosted Avalanche L1s on Testnet and Mainnet',
  openGraph: {
    url: '/tools/l1-launcher',
    images: {
      url: '/api/og/tools/l1-launcher',
      width: 1200,
      height: 630,
      alt: 'Avalanche L1 Launcher',
    },
  },
  twitter: {
    images: {
      url: '/api/og/tools/l1-launcher',
      width: 1200,
      height: 630,
      alt: 'Avalanche L1 Launcher',
    },
  },
});

export default function L1LauncherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 