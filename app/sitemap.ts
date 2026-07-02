import type { MetadataRoute } from 'next';
import { documentation, academy, integration, blog } from '@/lib/source';

const BASE = 'https://build.avax.network';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/docs`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/academy`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/integrations`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/blog`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/console`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  for (const src of [documentation, academy, integration, blog]) {
    for (const page of src.getPages()) {
      entries.push({
        url: `${BASE}${page.url}`,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  }

  return entries;
}
