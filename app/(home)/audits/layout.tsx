import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Security Audits',
  description:
    'Request audit quotes from every vetted security firm on the Ava Labs whitelist. Free, private, subsidized up to 75%.',
  openGraph: {
    url: '/audits',
  },
});

export default function AuditsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
