import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Security Audits',
  description:
    'Request audit quotes from every vetted security firm on the Ava Labs whitelist. Free, private, subsidized up to 75%.',
  openGraph: {
    url: '/audits',
    images: {
      url: '/api/og/audits',
      width: 1200,
      height: 630,
      alt: 'Avalanche Security Audits',
    },
  },
  twitter: {
    images: {
      url: '/api/og/audits',
      width: 1200,
      height: 630,
      alt: 'Avalanche Security Audits',
    },
  },
});

export default function AuditsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
