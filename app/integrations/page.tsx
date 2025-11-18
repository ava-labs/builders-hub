import { integration } from '@/lib/source';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import IntegrationsClient from './page.client';

export const metadata: Metadata = createMetadata({
  title: 'Integrations',
  description: 'Discover best-in-class integrations for your Avalanche L1',
  openGraph: {
    url: '/integrations',
    images: {
      url: '/api/og/integrations',
      width: 1200,
      height: 630,
      alt: 'Integrations with Avalanche',
    },
  },
  twitter: {
    images: {
      url: '/api/og/integrations',
      width: 1200,
      height: 630,
      alt: 'Integrations with Avalanche',
    },
  },
});

export default function Page(): React.ReactElement {
    const list = [...integration.getPages()];
    return <IntegrationsClient list={JSON.parse(JSON.stringify(list))} />;
}
