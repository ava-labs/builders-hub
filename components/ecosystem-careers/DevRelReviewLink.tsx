import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

interface Props {
  pendingProjects: number;
  pendingListings: number;
}

export function DevRelReviewLink({ pendingProjects, pendingListings }: Props) {
  const total = pendingProjects + pendingListings;
  return (
    <Link
      href="/admin/ecosystem-careers"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border border-red-500/45 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20 transition-colors"
    >
      <ShieldCheck className="w-3.5 h-3.5" />
      <span>Review queue</span>
      <span
        className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full font-mono text-[10px] ${
          total > 0
            ? 'bg-red-600 text-white'
            : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
        }`}
        title={`${pendingProjects} pending project${pendingProjects === 1 ? '' : 's'} · ${pendingListings} pending listing${pendingListings === 1 ? '' : 's'}`}
      >
        {total}
      </span>
    </Link>
  );
}
