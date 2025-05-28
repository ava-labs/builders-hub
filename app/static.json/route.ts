import { NextResponse } from 'next/server';
import { documentation, guide, academy, integration } from '@/lib/source';
import { type TrieveDocument } from 'trieve-fumadocs-adapter/search/sync';

export const revalidate = false;

export async function GET() {
  const results: TrieveDocument[] = await Promise.all([
    ...documentation.getPages().map(async (page) => {
      const loadedData = await page.data.load()
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: loadedData.structuredData
      }
    }),
    ...academy.getPages().map((page) => {
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: page.data.structuredData
      }
    }),
    ...integration.getPages().map(async (page) => {
      const loadedData = await page.data.load()
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: loadedData.structuredData
      }
    }),
    ...guide.getPages().map((page) => {
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: page.data.structuredData
      }
    })
  ]);

  return NextResponse.json(results);
}