import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';

export const metadata: Metadata = createMetadata({
  title: 'University',
  description: 'Discover opportunities for students and educators to explore blockchain technology, access educational resources, and join our community of builders on Avalanche.',
  openGraph: {
    url: '/university',
    images: {
      url: '/api/og/university',
      width: 1200,
      height: 630,
      alt: 'Avalanche University Program',
    },
  },
  twitter: {
    images: {
      url: '/api/og/university',
      width: 1200,
      height: 630,
      alt: 'Avalanche University Program',
    },
  },
});

export default function UniversityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
