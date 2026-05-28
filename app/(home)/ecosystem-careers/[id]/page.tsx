import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, MapPin } from 'lucide-react';
import { createMetadata } from '@/utils/metadata';
import { prisma } from '@/prisma/prisma';
import {
  getJobById,
  getListingForEdit,
  listMoreJobsFromSameCompany,
} from '@/server/services/ecosystemCareers/queries';
import {
  formatPostedAt,
  prettyRemoteType,
  prettySeniority,
} from '@/components/ecosystem-careers/labels';
import {
  getViewerAccess,
  missingSocialsFor,
} from '@/lib/ecosystem-careers/viewerAccess';
import { UnlockPrompt } from '@/components/ecosystem-careers/UnlockPrompt';

// Auth-conditional + hits Postgres → don't pre-render.
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobById(id);
  if (!job) return createMetadata({ title: 'Job not found' });
  return createMetadata({
    title: `${job.title} · ${job.company.name}`,
    description: job.shortDescription,
    openGraph: { url: `/ecosystem-careers/${job.id}` },
  });
}

export default async function EcosystemCareerDetailPage({ params }: Params) {
  const { id } = await params;
  const [job, access] = await Promise.all([
    getJobById(id),
    getViewerAccess(),
  ]);
  if (!job) notFound();

  // Resolve siblings: community → same project_id, external/legacy → same company_name.
  const sourceContext = await prisma.jobListing.findUnique({
    where: { id: job.id },
    select: { source: true, project_id: true, company_name: true },
  });

  const [moreJobs, editable] = await Promise.all([
    access.canViewAll && sourceContext
      ? listMoreJobsFromSameCompany(
          {
            id: job.id,
            source: sourceContext.source as 'community' | 'external' | 'legacy',
            project_id: sourceContext.project_id,
            company_name: sourceContext.company_name,
          },
          5,
        )
      : Promise.resolve([]),
    job.source === 'community' && access.userId
      ? getListingForEdit(job.id, access.userId)
      : Promise.resolve(null),
  ]);

  return (
    <main className="relative">
      <div className="max-w-5xl mx-auto px-4 py-10 lg:py-16 space-y-10">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/ecosystem-careers"
            className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All ecosystem careers
          </Link>
          {editable && (
            <Link
              href={`/ecosystem-careers/${job.id}/edit`}
              className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Edit listing
            </Link>
          )}
        </div>

        <header className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-6">
          {job.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.company.logoUrl}
              alt={job.company.name}
              className="w-16 h-16 rounded-xl object-contain bg-zinc-100 dark:bg-zinc-800 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-xl font-semibold text-zinc-500">
              {job.company.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {job.company.name}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {job.title}
            </h1>
            <div className="flex flex-wrap gap-2 pt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {job.location && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80">
                  <MapPin className="w-3.5 h-3.5" />
                  {job.location}
                </span>
              )}
              {job.remoteType && (
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80">
                  {prettyRemoteType(job.remoteType)}
                </span>
              )}
              {job.seniority && (
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80">
                  {prettySeniority(job.seniority)}
                </span>
              )}
              {job.postedAt && (
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80">
                  Posted {formatPostedAt(job.postedAt)}
                </span>
              )}
            </div>
          </div>
          {access.canViewAll && (
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:scale-[1.02] transition-all duration-200 shrink-0"
            >
              Apply on company site
              <ArrowUpRight className="w-4 h-4" />
            </a>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
          <article className="space-y-6">
            {job.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {job.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {access.canViewAll ? (
              <>
                {job.description ? (
                  <div
                    className="prose prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-semibold prose-li:my-1 prose-a:text-red-600 dark:prose-a:text-red-400"
                    dangerouslySetInnerHTML={{ __html: job.description }}
                  />
                ) : (
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {job.shortDescription}
                  </p>
                )}
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-200"
                  >
                    Apply on company site
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Builders Hub does not host or process applications, and per our{' '}
                    <a
                      href="https://www.avax.network/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      privacy policy
                    </a>{' '}
                    we don&apos;t track or monitor what happens once you click. You&apos;ll land directly on {job.company.name}&apos;s career portal.
                  </p>
                </div>
              </>
            ) : (
              <div className="relative min-h-[320px]">
                <div
                  aria-hidden
                  className="space-y-4 pointer-events-none select-none filter blur-md opacity-80"
                >
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {job.shortDescription}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {'█'.repeat(220).match(/.{1,40}/g)?.join(' ')}
                  </p>
                </div>
                <UnlockPrompt
                  authenticated={access.authenticated}
                  missingSocials={missingSocialsFor(access)}
                  returnTo={`/ecosystem-careers/${job.id}`}
                  variant="panel"
                />
              </div>
            )}
          </article>

          <aside className="space-y-6">
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white/60 dark:bg-zinc-900/40">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">About {job.company.name}</h2>
              {job.company.description && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{job.company.description}</p>
              )}
              {job.company.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {job.company.tags.slice(0, 4).map((t) => (
                    <span key={t} className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {job.company.website && (
                <a
                  href={job.company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Visit website
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
            </section>

            {moreJobs.length > 0 && (
              <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white/60 dark:bg-zinc-900/40">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">More roles at {job.company.name}</h2>
                <ul className="mt-3 space-y-3">
                  {moreJobs.map((m) => (
                    <li key={m.id}>
                      <Link href={`/ecosystem-careers/${m.id}`} className="group block">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {m.title}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {[m.location, prettyRemoteType(m.remoteType)].filter(Boolean).join(' · ')}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
