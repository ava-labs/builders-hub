'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Pencil, MoreHorizontal, Rows3 } from 'lucide-react';
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
}: HackathonsListProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse when editing starts; re-expand when editing ends.
  useEffect(() => {
    setCollapsed(forceCollapsed);
  }, [forceCollapsed]);

  const title = isDevrel
    ? language === 'en'
      ? 'All Hackathons'
      : 'Todos los Hackathons'
    : t[language].myHackathons;

  if (!loading && !myHackathons.length) return null;

  return (
    <div
      className={[
        'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden flex flex-col',
        fullHeight && !collapsed ? 'flex-1 min-h-0' : '',
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
          {!loading && myHackathons.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium w-5 h-5">
              {myHackathons.length}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        )}
      </button>

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
                'overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800',
                fullHeight ? 'flex-1 min-h-0' : '',
              ].join(' ')}
              style={!fullHeight ? { maxHeight: '320px' } : undefined}
            >
              {myHackathons.map((hackathon) => {
                const isSelected = hackathon.id === selectedId;
                return (
                  <li
                    key={hackathon.id}
                    onClick={() => onSelect(hackathon)}
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
