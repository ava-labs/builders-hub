import { useCallback, useState } from 'react';
import axios from 'axios';

type Filters = {
  search?: string;
  visibility?: 'all' | 'public' | 'private';
  sort?: 'start_date_desc' | 'start_date_asc';
};

export default function useHackathonsFilters(userId?: string, pageSize = 20) {
  // Initialize with explicit defaults
  const [filters, setFiltersState] = useState<Filters>({
    search: '',
    visibility: 'all',
    sort: 'start_date_desc'
  });
  const [page, setPage] = useState<number>(1);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const buildUrl = useCallback((pageNum: number, f: Filters) => {
    const parts: string[] = [];
    parts.push(`managed=true`);
    parts.push(`page=${pageNum}`);
    parts.push(`pageSize=${pageSize}`);
    
    // Always send search (even if empty) to ensure consistency
    // Empty search should be treated as no search filter
    if (f.search !== undefined && f.search !== '') {
      parts.push(`search=${encodeURIComponent(f.search)}`);
    }
    
    // Always send visibility to be explicit about the filter
    const visibility = f.visibility ?? 'all';
    parts.push(`visibility=${visibility}`);
    
    // Always send sort to maintain ordering
    if (f.sort) {
      parts.push(`sort=${f.sort}`);
    }
    
    return `/api/events?${parts.join('&')}`;
  }, [pageSize]);

  const loadPage = useCallback(
    async (pageNum: number, opts?: { append?: boolean; filters?: Filters }) => {
      const usedFilters = opts?.filters ?? filters;
      if (!opts?.append) setLoading(true);
      try {
        const url = buildUrl(pageNum, usedFilters);
        const response = await axios.get(url, { headers: { id: userId } });
        const hackathons = response.data?.hackathons ?? [];
        // Server already filters by visibility, no need for client-side filtering
        if (opts?.append) {
          setItems((prev) => [...prev, ...hackathons]);
        } else {
          setItems(hackathons);
        }
        setPage(pageNum);
        setHasMore(hackathons.length >= pageSize);
      } catch (error) {
        console.error('Error loading hackathons:', error);
      } finally {
        setLoading(false);
      }
    },
    [buildUrl, filters, pageSize, userId],
  );

  const setFilters = useCallback((next: Filters) => {
    setFiltersState(next);
    void loadPage(1, { append: false, filters: next });
  }, [loadPage]);

  const setFiltersPartial = useCallback((partial: Partial<Filters>) => {
    // Create merged filters ensuring all existing filters are preserved
    const merged: Filters = {
      search: filters.search ?? '',
      visibility: filters.visibility ?? 'all',
      sort: filters.sort ?? 'start_date_desc',
      ...partial, // Override with the new partial values
    };
    setFiltersState(merged);
    void loadPage(1, { append: false, filters: merged });
  }, [filters, loadPage]);

  const search = useCallback((q: string) => {
    const next = { ...filters, search: q };
    setFilters(next);
  }, [filters, setFilters]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    void loadPage(page + 1, { append: true });
  }, [loading, hasMore, page, loadPage]);

  const refresh = useCallback(() => {
    void loadPage(1, { append: false });
  }, [loadPage]);

  return {
    items,
    setItems,
    loading,
    filters,
    setFilters,
    setFiltersPartial,
    search,
    loadMore,
    hasMore,
    refresh,
    loadPage,
  } as const;
}
