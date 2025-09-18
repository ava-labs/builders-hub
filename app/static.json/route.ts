import { NextResponse } from 'next/server';
import { documentation, blog, academy, integration } from '@/lib/source';
import type { DocumentRecord } from 'fumadocs-core/search/algolia';

export const revalidate = false;

export async function GET() {
  const results: DocumentRecord[] = await Promise.all([
    ...documentation.getPages().map(async (page) => {
      const loadedData = await page.data.load()
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: loadedData.structuredData,
        description: page.data.description,
        tag: 'docs'
      }
    }),
    ...academy.getPages().map((page) => {
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: page.data.structuredData,
        description: page.data.description,
        tag: 'academy'
      }
    }),
    ...integration.getPages().map(async (page) => {
      const loadedData = await page.data.load()
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: loadedData.structuredData,
        description: page.data.description,
        tag: 'integrations'
      }
    }),
    ...blog.getPages().map((page) => {
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: page.data.structuredData,
        description: page.data.description,
        tag: 'blog'
      }
    })
  ]);

  return NextResponse.json(results);
}