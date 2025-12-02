import { documentation, academy, integration, blog } from '@/lib/source';
import { createSearchAPI } from 'fumadocs-core/search/server';

export const revalidate = false;

export const { GET } = createSearchAPI('advanced', {
  indexes: async () => {
    const indexes = [];

    // Docs (async)
    for (const page of documentation.getPages()) {
      const loaded = await page.data.load();
      if (loaded.structuredData) {
        indexes.push({
          id: page.url,
          title: page.data.title,
          url: page.url,
          structuredData: loaded.structuredData,
        });
      }
    }

    // Academy
    for (const page of academy.getPages()) {
      if (page.data.structuredData) {
        indexes.push({
          id: page.url,
          title: page.data.title,
          url: page.url,
          structuredData: page.data.structuredData,
        });
      }
    }

    // Integrations (async)
    for (const page of integration.getPages()) {
      const loaded = await page.data.load();
      if (loaded.structuredData) {
        indexes.push({
          id: page.url,
          title: page.data.title,
          url: page.url,
          structuredData: loaded.structuredData,
        });
      }
    }

    // Blog
    for (const page of blog.getPages()) {
      if (page.data.structuredData) {
        indexes.push({
          id: page.url,
          title: page.data.title,
          url: page.url,
          structuredData: page.data.structuredData,
        });
      }
    }

    return indexes;
  },
});
