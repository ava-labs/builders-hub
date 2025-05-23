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
        structured: loadedData.structuredData,
        tag: 'docs'
      }
    }),
    ...academy.getPages().map((page) => {
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: page.data.structuredData,
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
        tag: 'ig'
      }
    }),
    ...guide.getPages().map((page) => {
      return {
        title: page.data.title,
        url: page.url,
        _id: page.url,
        structured: page.data.structuredData,
        tag: 'ig'
      }
    })
  ]);

  return NextResponse.json(results);
}