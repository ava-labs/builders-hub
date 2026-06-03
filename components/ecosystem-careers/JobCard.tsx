import { Banknote, Lock, MapPin } from 'lucide-react';
import type {
  ListingSource,
  SerializableJobCard,
} from '@/server/services/ecosystemCareers/queries';
import { formatPostedAt, prettyRemoteType, prettySeniority } from './labels';
import { DevRelEditButton } from './DevRelEditButton';
import { JobCardLink } from './JobCardLink';

interface Props {
  job: SerializableJobCard;
  viewerIsDevRel?: boolean;
  // When false, salary is shown as a locked teaser instead of the figure.
  // Unlocked once the viewer connects both X and LinkedIn.
  showSalary?: boolean;
}

// Salary is gated: connected viewers see the figure, everyone else sees a lock
// that hints there's pay info worth unlocking. Renders nothing when the listing
// has no salary at all.
function SalaryPill({ salary, showSalary }: { salary: string | null; showSalary: boolean }) {
  if (!salary) return null;
  if (!showSalary) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80">
        <Lock className="w-3 h-3" />
        Salary
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-500/20">
      <Banknote className="w-3 h-3" />
      {salary}
    </span>
  );
}

// Neon-tinted provenance pill: yellow for fresh Getro weekly ingest,
// purple for external (web3.career ingest), green for community (project
// owner submission via Builders Hub OR the original frozen jobs.avax.network
// seed — both are ecosystem-curated and read the same to a browser).
function SourceBadge({ source }: { source: ListingSource }) {
  const community = {
    label: 'Community',
    classes:
      'bg-emerald-300 text-emerald-950 ring-1 ring-emerald-400/70 shadow-[0_0_10px_rgba(52,211,153,0.45)]',
  };
  const map: Record<ListingSource, { label: string; classes: string }> = {
    // Legacy rows render with the community badge — the jobs.avax.network
    // seed predates the new ingest pipeline but is still curated by us.
    legacy: community,
    getro: {
      label: 'Getro',
      classes:
        'bg-yellow-300 text-yellow-950 ring-1 ring-yellow-400/70 shadow-[0_0_10px_rgba(250,204,21,0.45)]',
    },
    external: {
      label: 'External',
      classes:
        'bg-fuchsia-300 text-fuchsia-950 ring-1 ring-fuchsia-400/70 shadow-[0_0_10px_rgba(217,70,239,0.45)]',
    },
    community,
  };
  const entry = map[source] ?? community;
  const { label, classes } = entry;
  return (
    <span
      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${classes}`}
    >
      {label}
    </span>
  );
}

export function JobCard({ job, viewerIsDevRel = false, showSalary = false }: Props) {
  return (
    <div className="group relative h-full">
      {viewerIsDevRel && (
        <DevRelEditButton
          listingId={job.id}
          currentTitle={job.title}
          currentLogoUrl={job.company.logoUrl}
        />
      )}
    <JobCardLink
      href={`/ecosystem-careers/${job.id}`}
      className="relative flex flex-col h-full min-h-[210px] gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
      listingId={job.id}
      listingSource={job.source}
      companyName={job.company.name}
    >
      <div className="flex items-start gap-3">
        {job.company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.company.logoUrl}
            alt={job.company.name}
            className="w-10 h-10 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800 shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-xs font-semibold text-zinc-500">
            {job.company.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
            {job.company.name}
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
            {job.title}
          </h3>
        </div>
        <SourceBadge source={job.source} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {job.location && (
          <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80">
            <MapPin className="w-3 h-3" />
            {job.location}
          </span>
        )}
        {job.remoteType && (
          <span className="text-xs text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80">
            {prettyRemoteType(job.remoteType)}
          </span>
        )}
        {job.seniority && (
          <span className="text-xs text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80">
            {prettySeniority(job.seniority)}
          </span>
        )}
        <SalaryPill salary={job.salary} showSalary={showSalary} />
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2">
        {job.shortDescription}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {job.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700"
            >
              {tag}
            </span>
          ))}
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
          {formatPostedAt(job.postedAt)}
        </span>
      </div>
    </JobCardLink>
    </div>
  );
}
