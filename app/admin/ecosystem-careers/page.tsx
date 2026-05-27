import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { createMetadata } from '@/utils/metadata';
import { getAuthSession } from '@/lib/auth/authSession';
import {
  listIngestedListingsUnderReview,
  listProjectsUnderReview,
} from '@/server/services/ecosystemCareers/adminQueries';
import { ReviewActions } from '@/components/ecosystem-careers/ReviewActions';
import { ApproveListingButton } from '@/components/ecosystem-careers/ApproveListingButton';

export const metadata: Metadata = createMetadata({
  title: 'Ecosystem Careers · Review queue',
});

export const dynamic = 'force-dynamic';

export default async function EcosystemCareersAdminPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/admin/ecosystem-careers');
  }
  if (!session.user.custom_attributes?.includes('devrel')) {
    return (
      <main className="container relative max-w-3xl pt-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong className="font-semibold">Access denied</strong>
            <p className="mt-1 text-sm">
              The Ecosystem Careers review queue is restricted to users with the
              <code className="mx-1">devrel</code>role.
            </p>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const [queue, ingestedQueue] = await Promise.all([
    listProjectsUnderReview(),
    listIngestedListingsUnderReview(),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-12 lg:py-16 space-y-12">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Review queue
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Teams whose first listing is waiting for a sign-off. Approving the company auto-publishes every queued listing under it. Ingested listings from Getro and web3.career are reviewed per-row below.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Community projects · {queue.length}
        </h2>
      {queue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-600 dark:text-zinc-300">
          Nothing pending. ✨
        </div>
      ) : (
        <ul className="space-y-6">
          {queue.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-6 space-y-5"
            >
              <div className="flex items-start gap-4">
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logoUrl}
                    alt={c.name}
                    className="w-12 h-12 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-500 shrink-0">
                    {c.name.slice(0, 1)}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {c.name}
                  </h2>
                  {c.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{c.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.tags.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 pt-1 space-x-2">
                    {c.website && (
                      <a href={c.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        Website
                      </a>
                    )}
                    {c.githubRepository && (
                      <a
                        href={c.githubRepository}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        GitHub
                      </a>
                    )}
                    {c.demoLink && (
                      <a
                        href={c.demoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        Demo
                      </a>
                    )}
                  </div>
                </div>
                <ReviewActions projectId={c.id} />
              </div>

              {c.pendingListings.length > 0 && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
                  <h3 className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {c.pendingListings.length} queued listing{c.pendingListings.length === 1 ? '' : 's'}
                  </h3>
                  <ul className="space-y-3">
                    {c.pendingListings.map((j) => (
                      <li
                        key={j.id}
                        className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 p-4"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <Link
                            href={`/ecosystem-careers/${j.id}`}
                            className="text-sm font-semibold text-zinc-900 dark:text-white hover:text-red-600 dark:hover:text-red-400"
                          >
                            {j.title}
                          </Link>
                          <a
                            href={j.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-xs text-zinc-500 dark:text-zinc-400 hover:underline truncate"
                          >
                            {j.applyUrl}
                          </a>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                          {j.shortDescription}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                          {j.location ?? 'No location'} ·{' '}
                          {j.postedBy?.name ?? j.postedBy?.email ?? 'unknown poster'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Ingested listings · {ingestedQueue.length}
        </h2>
        {ingestedQueue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-600 dark:text-zinc-300 text-sm">
            No ingested listings waiting on review.
          </div>
        ) : (
          <ul className="space-y-3">
            {ingestedQueue.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-4 flex items-start gap-4"
              >
                {row.companyLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.companyLogo}
                    alt={row.companyName ?? row.title}
                    className="w-10 h-10 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-500 shrink-0">
                    {(row.companyName ?? row.title).slice(0, 1)}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        row.source === 'getro'
                          ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
                          : 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300'
                      }`}
                    >
                      {row.source}
                    </span>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {row.title}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {row.companyName ?? 'Unknown company'}
                    {row.location ? ` · ${row.location}` : ''}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {row.shortDescription}
                  </p>
                  <a
                    href={row.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:underline truncate inline-block"
                  >
                    {row.applyUrl}
                  </a>
                </div>
                <ApproveListingButton listingId={row.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
