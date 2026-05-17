import type { Metadata } from 'next/types';

export function createMetadata(override: Metadata): Metadata {
  return {
    ...override,
    openGraph: {
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      url: 'https://build.avax.network',
      images: '/logo.png',
      siteName: 'Avalanche Builder Hub',
      ...override.openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      images: '/logo.png',
      ...override.twitter,
    },
  };
}

export const baseUrl = (() => {
  switch (process.env.VERCEL_ENV) {
    case 'production':
      return new URL('https://build.avax.network'); // hardcodeado, no hay otra forma confiable
    case 'preview':
      return new URL(`https://${process.env.VERCEL_URL}`);
    default:
      return new URL('http://localhost:3000');
  }
})();
