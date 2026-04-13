import { withApi, successResponse } from '@/lib/api';
import { blog } from '@/lib/source';

export const dynamic = 'force-static';
export const revalidate = 3600;

export const GET = withApi(async () => {
  const blogPages = [...blog.getPages()]
    .sort(
      (a, b) =>
        new Date((b.data.date as string) ?? b.url).getTime() - new Date((a.data.date as string) ?? a.url).getTime(),
    )
    .slice(0, 2);

  const latestBlogs = blogPages.map((page) => ({
    title: page.data.title || 'Untitled',
    description: page.data.description || '',
    url: page.url,
    date: page.data.date instanceof Date ? page.data.date.toISOString() : (page.data.date as string) || '',
  }));

  return successResponse(latestBlogs);
});
