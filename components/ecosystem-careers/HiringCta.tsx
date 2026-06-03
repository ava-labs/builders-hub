import Link from 'next/link';
import { ArrowUpRight, Briefcase } from 'lucide-react';

interface Props {
  variant?: 'button' | 'inline' | 'banner';
  className?: string;
}

export function HiringCta({ variant = 'button', className }: Props) {
  if (variant === 'button') {
    return (
      <Link
        href="/ecosystem-careers/submit"
        className={
          'group inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:border-red-500/60 hover:text-red-600 dark:hover:text-red-400 transition ' +
          (className ?? '')
        }
      >
        <Briefcase className="w-4 h-4" />
        Hiring? Post a role
        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={
          'flex items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 px-5 py-3 ' +
          (className ?? '')
        }
      >
        <div className="text-sm text-zinc-700 dark:text-zinc-200">
          <span className="font-semibold">Building on Avalanche and hiring?</span>{' '}
          <span className="text-zinc-500 dark:text-zinc-400">
            Post your role on Ecosystem Careers.
          </span>
        </div>
        <Link
          href="/ecosystem-careers/submit"
          className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:underline shrink-0"
        >
          Post a role
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={
        'relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-red-500 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl shadow-red-500/20 ' +
        (className ?? '')
      }
    >
      <div className="space-y-1.5">
        <h3 className="text-xl sm:text-2xl font-bold leading-tight">Hiring on Avalanche?</h3>
        <p className="text-sm text-white/80 max-w-xl">
          Post your open roles on Ecosystem Careers — they go live across Builders Hub and link out to your career page.
        </p>
      </div>
      <Link
        href="/ecosystem-careers/submit"
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-white text-red-600 hover:bg-zinc-100 transition shrink-0"
      >
        Post a role
        <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
