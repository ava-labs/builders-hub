'use client';

import { useSearchContext } from 'fumadocs-ui/provider';

export function SearchTrigger() {
  const { setOpenSearch } = useSearchContext();

  return (
    <button
      type="button"
      onClick={() => setOpenSearch(true)}
      className="flex w-full items-center gap-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-3 text-left text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="flex-1">Search documentation...</span>
    </button>
  );
} 