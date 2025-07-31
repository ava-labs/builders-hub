import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: 'Console',
  description: 'Avalanche Console',
  openGraph: {
    url: '/console',
    images: {
      url: '/api/og/console',
      width: 1200,
      height: 630,
      alt: 'Avalanche Console',
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

export default function ConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
} 