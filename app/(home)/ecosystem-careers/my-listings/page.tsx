import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { getAuthSession } from '@/lib/auth/authSession';
import { listListingsForUser } from '@/server/services/ecosystemCareers/queries';
import { formatPostedAt, prettyRemoteType } from '@/components/ecosystem-careers/labels';
import { DeactivateListingButton } from '@/components/ecosystem-careers/DeactivateListingButton';

export const metadata: Metadata = createMetadata({
  title: 'My listings · Ecosystem Careers',
});

export default async function MyListingsPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/ecosystem-careers/my-listings');
  }

  const { ownProjects, listings } = await listListingsForUser(session.user.id);

  return (
    <main className="max-w-5xl mx-auto px-4 py-12 lg:py-16 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
            My listings
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Manage every Ecosystem Careers role you or a teammate has posted for your projects.
          </p>
        </div>
        <Link
          href="/ecosystem-careers/submit"
          className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20"
        >
          Post a new role
        </Link>
      </header>

      {listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center text-zinc-600 dark:text-zinc-300 space-y-3">
          <p className="font-medium text-zinc-900 dark:text-white">No listings yet</p>
          {ownProjects.length === 0 ? (
            <p>
              You need a project first.{' '}
              <Link href="/projects/new" className="text-red-600 dark:text-red-400 hover:underline">
                Create one →
              </Link>
            </p>
          ) : (
            <p>
              <Link
                href="/ecosystem-careers/submit"
                className="text-red-600 dark:text-red-400 hover:underline"
              >
                Post your first role →
              </Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 overflow-hidden">
          {listings.map((row) => (
            <li key={row.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/ecosystem-careers/${row.id}`}
                    className="text-base font-semibold text-zinc-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 truncate"
                  >
                    {row.title}
                  </Link>
                  {!row.isActive && (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                  {row.company.name}
                  {row.location ? ` · ${row.location}` : ''}
                  {row.remoteType ? ` · ${prettyRemoteType(row.remoteType)}` : ''}
                  {row.postedAt ? ` · ${formatPostedAt(row.postedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/ecosystem-careers/${row.id}/edit`}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Edit
                </Link>
                {row.isActive && <DeactivateListingButton listingId={row.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
