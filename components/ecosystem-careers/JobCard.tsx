import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { JobCard as JobCardData } from '@/server/services/ecosystemCareers/queries';
import { formatPostedAt, prettyRemoteType, prettySeniority } from './labels';

interface Props {
  job: JobCardData;
}

export function JobCard({ job }: Props) {
  return (
    <Link
      href={`/ecosystem-careers/${job.id}`}
      className="group relative flex flex-col h-full min-h-[210px] gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
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
        <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-white opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all" />
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
    </Link>
  );
}
