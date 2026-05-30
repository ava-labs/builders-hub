'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Pencil, MoreHorizontal, Rows3, X, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { t } from '@/app/events/edit/translations';

type HackathonsListProps = {
  myHackathons: any[];
  language: 'en' | 'es';
  onSelect: (hackathon: any) => void;
  selectedId: string | null;
  isDevrel: boolean;
  loading: boolean;
  /** When true the list collapses automatically (e.g. editing/creating a hackathon). */
  forceCollapsed?: boolean;
  /** When true the list grows to fill available vertical space instead of capping at 320px. */
  fullHeight?: boolean;
  /** Optional: filters and handlers for server-side filtering/pagination */
  filters?: {
    search?: string;
    visibility?: 'all' | 'public' | 'private';
    sort?: 'start_date_desc' | 'start_date_asc';
  };
  onFiltersChange?: (filters: {
    search?: string;
    visibility?: 'all' | 'public' | 'private';
    sort?: 'start_date_desc' | 'start_date_asc';
  }) => void;
  onSearch?: (q: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  /** Navbar height in pixels to calculate available space (default: 56px) */
  navbarHeight?: number;
};

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HackathonsList({
  myHackathons,
  language,
  onSelect,
  selectedId,
  isDevrel,
  loading,
  forceCollapsed = false,
  fullHeight = false,
  filters,
  onFiltersChange,
  onSearch,
  onLoadMore,
  hasMore,
  navbarHeight = 56,
}: HackathonsListProps) {
  const [collapsed, setCollapsed] = useState(false);

  // local debounced search state
  const [localSearch, setLocalSearch] = useState(filters?.search ?? '');

  // keep local input in sync when external filters change
  useEffect(() => {
    setLocalSearch(filters?.search ?? '');
  }, [filters?.search]);

  // Auto-collapse when editing starts; re-expand when editing ends.
  useEffect(() => {
    setCollapsed(forceCollapsed);
  }, [forceCollapsed]);

  // Debounce search input and call onSearch
  useEffect(() => {
    const t = setTimeout(() => {
      if (onSearch && localSearch !== (filters?.search ?? '')) {
        onSearch(localSearch);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  // Note: Infinite scroll disabled - all hackathons are now loaded at once with max pageSize

  const title = isDevrel
    ? language === 'en'
      ? 'All Events'
      : 'Todos los Eventos'
    : t[language].myHackathons;

  const noEventsMessage = t[language].noEventsFound;

  // Client-side filtering and sorting applied on top of whatever the server returns
  const filteredHackathons = useMemo(() => {
    let result = [...myHackathons];

    const visibility = filters?.visibility ?? 'all';
    if (visibility === 'public') {
      result = result.filter((h) => h.is_public);
    } else if (visibility === 'private') {
      result = result.filter((h) => !h.is_public);
    }

    const sort = filters?.sort ?? 'start_date_desc';
    result.sort((a, b) => {
      const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
      return sort === 'start_date_asc' ? aDate - bDate : bDate - aDate;
    });

    return result;
  }, [myHackathons, filters?.visibility, filters?.sort]);

  // Show empty state with filters visible instead of hiding component
  if (!loading && !filteredHackathons.length) {
    return (
      <div
        style={{ height: `calc(100vh - ${navbarHeight}px)` }}
        className={[
          'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col overflow-hidden',
        ].join(' ')}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700 cursor-pointer flex-shrink-0"
        >
          <div className="flex justify-center items-center gap-2">
            <Rows3 className="w-4 h-4 text-[#e84142]"/>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
          </div>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        {/* Filters: visible only when expanded */}
        {!collapsed && (
          <div
            className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex-1">
              <input
                aria-label={language === 'en' ? 'Search events' : 'Buscar eventos'}
                placeholder={language === 'en' ? 'Search...' : 'Buscar...'}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="text-sm px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-red-400 w-full"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocalSearch('');
                    if (onSearch) onSearch('');
                  }}
                  aria-label={language === 'en' ? 'Clear search' : 'Limpiar búsqueda'}
                  title={language === 'en' ? 'Clear search' : 'Limpiar búsqueda'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 bg-transparent"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              aria-label={language === 'en' ? 'Visibility filter' : 'Filtro de visibilidad'}
              value={filters?.visibility ?? 'all'}
              onChange={(e) =>
                onFiltersChange &&
                onFiltersChange({ ...(filters ?? {}), visibility: e.target.value as any })
              }
              className="text-sm px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            >
              <option value="all">{language === 'en' ? 'All' : 'Todos'}</option>
              <option value="public">{language === 'en' ? 'Public' : 'Público'}</option>
              <option value="private">{language === 'en' ? 'Private' : 'Privado'}</option>
            </select>

            <select
              aria-label={language === 'en' ? 'Sort' : 'Orden'}
              value={filters?.sort ?? 'start_date_desc'}
              onChange={(e) =>
                onFiltersChange &&
                onFiltersChange({ ...(filters ?? {}), sort: e.target.value as any })
              }
              className="text-sm px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            >
              <option value="start_date_desc">{language === 'en' ? 'Newest' : 'Más recientes'}</option>
              <option value="start_date_asc">{language === 'en' ? 'Oldest' : 'Más antiguos'}</option>
            </select>
          </div>
        )}

        {/* Empty state message */}
        {!collapsed && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Search className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {noEventsMessage}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{ height: collapsed ? 'auto' : `calc(100vh - ${navbarHeight}px)` }}
      className={[
        'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col overflow-hidden',
      ].join(' ')}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="w-full rounded-xl flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700 cursor-pointer flex-shrink-0"
      >
        <div className="flex justify-center items-center gap-2">
          <Rows3 className="w-4 h-4 text-[#e84142]"/>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
          {!loading && filteredHackathons.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium w-5 h-5">
              {filteredHackathons.length}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {/* Filters: visible only when expanded */}
      {!collapsed && (
        <div
          className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex-1">
            <input
              aria-label={language === 'en' ? 'Search events' : 'Buscar eventos'}
              placeholder={language === 'en' ? 'Search...' : 'Buscar...'}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="text-sm px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-red-400 w-full"
            />
            {localSearch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocalSearch('');
                  if (onSearch) onSearch('');
                }}
                aria-label={language === 'en' ? 'Clear search' : 'Limpiar búsqueda'}
                title={language === 'en' ? 'Clear search' : 'Limpiar búsqueda'}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 bg-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            aria-label={language === 'en' ? 'Visibility filter' : 'Filtro de visibilidad'}
            value={filters?.visibility ?? 'all'}
            onChange={(e) => {
              // Apply any pending search changes first
              if (localSearch !== (filters?.search ?? '') && onSearch) {
                onSearch(localSearch);
              }
              // Then apply the visibility filter with current search
              onFiltersChange &&
                onFiltersChange({
                  ...(filters ?? {}),
                  visibility: e.target.value as any,
                  // Ensure current search is preserved
                  search: localSearch || filters?.search || '',
                });
            }}
            className="text-sm px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          >
            <option value="all">{language === 'en' ? 'All' : 'Todos'}</option>
            <option value="public">{language === 'en' ? 'Public' : 'Público'}</option>
            <option value="private">{language === 'en' ? 'Private' : 'Privado'}</option>
          </select>

          <select
            aria-label={language === 'en' ? 'Sort' : 'Orden'}
            value={filters?.sort ?? 'start_date_desc'}
            onChange={(e) => {
              // Apply any pending search changes first
              if (localSearch !== (filters?.search ?? '') && onSearch) {
                onSearch(localSearch);
              }
              // Then apply the sort with current search
              onFiltersChange &&
                onFiltersChange({
                  ...(filters ?? {}),
                  sort: e.target.value as any,
                  // Ensure current search is preserved
                  search: localSearch || filters?.search || '',
                });
            }}
            className="text-sm px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          >
            <option value="start_date_desc">{language === 'en' ? 'Newest' : 'Más recientes'}</option>
            <option value="start_date_asc">{language === 'en' ? 'Oldest' : 'Más antiguos'}</option>
          </select>
        </div>
      )}
      {/* Body */}
      {!collapsed && (
        <>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <svg
                className="animate-spin h-7 w-7 text-red-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
            </div>
          ) : (
            <ul
              className={[
                'overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 flex-1',
              ].join(' ')}
            >
              {filteredHackathons.map((hackathon) => {
                const isSelected = hackathon.id === selectedId;
                return (
                  <li
                    key={hackathon.id}
                    onClick={() => {
                      onSelect(hackathon);
                      setCollapsed(true);
                    }}
                    className={[
                      'flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors group',
                      isSelected
                        ? 'bg-red-50 dark:bg-red-950/30 border-l-2 border-l-red-500'
                        : 'border-l-2 border-l-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                    ].join(' ')}
                  >
                    {/* Left: status dot + info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          hackathon.is_public ? 'bg-green-500' : 'bg-zinc-400 dark:bg-zinc-500'
                        }`}
                        title={hackathon.is_public ? 'Public' : 'Private'}
                      />
                      <div className="min-w-0">
                        <p
                          className={[
                            'text-sm font-semibold truncate max-w-[220px]',
                            isSelected
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-zinc-900 dark:text-zinc-100',
                          ].join(' ')}
                          title={hackathon.title}
                        >
                          {hackathon.title}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[220px]">
                          {hackathon.created_by_name
                            ? `by ${hackathon.created_by_name}`
                            : '\u00A0'}
                        </p>
                      </div>
                    </div>

                    {/* Right: date + 3-dot menu */}
                    {/* test */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 hidden sm:block">
                        {formatDate(hackathon.start_date)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                            title="Actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[140px]">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/events/${hackathon.id}`, '_blank');
                            }}
                            className="cursor-pointer flex items-center gap-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {language === 'en' ? 'Go to Site' : 'Ver Sitio'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(hackathon);
                              setCollapsed(true);
                            }}
                            className="cursor-pointer flex items-center gap-2"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {language === 'en' ? 'Edit' : 'Editar'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
