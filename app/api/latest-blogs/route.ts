import { NextResponse } from 'next/server';
import { blog } from '@/lib/source';

export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  try {
    const blogPages = [...blog.getPages()]
      .sort(
        (a, b) =>
          new Date((b.data.date as string) ?? b.url).getTime() -
          new Date((a.data.date as string) ?? a.url).getTime()
      )
      .slice(0, 2);

    const latestBlogs = blogPages.map((page) => ({
      title: page.data.title || 'Untitled',
      description: page.data.description || '',
      url: page.url,
      date:
        page.data.date instanceof Date
          ? page.data.date.toISOString()
          : (page.data.date as string) || '',
    }));

    return NextResponse.json(latestBlogs);
  } catch (error) {
    console.error('Error fetching latest blogs:', error);
    return NextResponse.json([], { status: 500 });
  }
}

