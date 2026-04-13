import type { NextRequest } from 'next/server';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/api/constants';

/** Extract and clamp pagination params from the request URL. */
export function parsePagination(
  req: NextRequest,
  options?: { defaultPageSize?: number; maxPageSize?: number }
): { page: number; pageSize: number; skip: number } {
  const defaultSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxSize = options?.maxPageSize ?? MAX_PAGE_SIZE;

  const rawPage = req.nextUrl.searchParams.get('page');
  const rawPageSize = req.nextUrl.searchParams.get('pageSize');

  const page = Math.max(1, rawPage ? parseInt(rawPage, 10) || 1 : 1);
  const pageSize = Math.min(maxSize, Math.max(1, rawPageSize ? parseInt(rawPageSize, 10) || defaultSize : defaultSize));
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}
