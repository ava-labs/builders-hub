'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { JobCard } from '@/components/ecosystem-careers/JobCard';
import { HiringCta } from '@/components/ecosystem-careers/HiringCta';
import { UnlockPrompt } from '@/components/ecosystem-careers/UnlockPrompt';
import type { CompanyOption, SerializableJobCard } from '@/server/services/ecosystemCareers/queries';

interface Props {
  initialJobs: SerializableJobCard[];
  totalActive: number;
  companies: CompanyOption[];
  viewerCanViewAll: boolean;
  viewerAuthenticated: boolean;
  viewerMissingSocials: ('x' | 'linkedin')[];
  previewCount: number;
}

const REMOTE_OPTIONS = [
  { value: 'remote', label: 'Remote' },
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
];

export default function EcosystemCareersClient({
  initialJobs,
  totalActive,
  companies,
  viewerCanViewAll,
  viewerAuthenticated,
  viewerMissingSocials,
  previewCount,
}: Props) {
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [remoteType, setRemoteType] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialJobs.filter((job) => {
      if (companyId && job.company.id !== companyId) return false;
      if (remoteType && job.remoteType !== remoteType) return false;
      if (!q) return true;
      const haystack = [
        job.title,
        job.shortDescription,
        job.location ?? '',
        job.company.name,
        job.seniority ?? '',
        ...job.tags,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [initialJobs, search, companyId, remoteType]);

  const hasFilters = !!search || !!companyId || !!remoteType;

  return (
    <main className="relative">
      <section className="px-4 pt-16 pb-10">
        <div className="max-w-5xl mx-auto text-center space-y-5">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95]">
            <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-white">
              Ecosystem Careers
            </span>
          </h1>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent">
              Build on Avalanche.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Open roles from teams across the Avalanche ecosystem. Click into a listing to read more and apply on the company&apos;s site.
          </p>
          <div className="flex justify-center pt-2">
            <HiringCta variant="button" />
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search role, company, location, skill…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-10 py-3 text-sm rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={companyId ?? ''}
              onChange={(e) => setCompanyId(e.target.value || null)}
              className="lg:w-56 px-4 py-3 text-sm rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40 transition"
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.jobsCount})
                </option>
              ))}
            </select>

            <select
              value={remoteType ?? ''}
              onChange={(e) => setRemoteType(e.target.value || null)}
              className="lg:w-40 px-4 py-3 text-sm rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40 transition"
            >
              <option value="">Any location</option>
              {REMOTE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {mounted && (
            <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400" suppressHydrationWarning>
              <span>
                {hasFilters
                  ? `${filtered.length} of ${initialJobs.length} roles shown`
                  : `${initialJobs.length} open ${initialJobs.length === 1 ? 'role' : 'roles'}${totalActive > initialJobs.length ? ` (showing latest of ${totalActive})` : ''}`}
              </span>
              {hasFilters && (
                <button
                  onClick={() => {
                    setSearch('');
                    setCompanyId(null);
                    setRemoteType(null);
                  }}
                  className="text-red-600 dark:text-red-400 hover:underline"
                >
                  Reset filters
                </button>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : viewerCanViewAll ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <GatedGrid
              jobs={filtered}
              previewCount={previewCount}
              authenticated={viewerAuthenticated}
              missingSocials={viewerMissingSocials}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function GatedGrid({
  jobs,
  previewCount,
  authenticated,
  missingSocials,
}: {
  jobs: SerializableJobCard[];
  previewCount: number;
  authenticated: boolean;
  missingSocials: ('x' | 'linkedin')[];
}) {
  const visible = jobs.slice(0, previewCount);
  const blurred = jobs.slice(previewCount);
  return (
    <div className="space-y-6">
      {visible.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
      {blurred.length > 0 && (
        <div className="relative">
          <div
            aria-hidden
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pointer-events-none select-none filter blur-md saturate-75 opacity-80"
          >
            {blurred.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
          <UnlockPrompt
            authenticated={authenticated}
            missingSocials={missingSocials}
            hiddenCount={blurred.length}
          />
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="py-16 text-center">
      <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
        {hasFilters ? 'No matching roles' : 'No open roles right now'}
      </p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
        {hasFilters
          ? 'Try clearing a filter or adjusting your search.'
          : 'New listings appear here as teams across the Avalanche ecosystem post roles. Check back soon.'}
      </p>
    </div>
  );
}
