import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
    ],
    sitemap: 'https://build.avax.network/sitemap.xml',
    host: 'https://build.avax.network',
  };
}
