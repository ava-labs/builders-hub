import { ArrowUpRight, UserPlus } from 'lucide-react';

const SNOWBALL_TALENT_URL = 'https://snowball-talent.netlify.app/';

// Ava Labs' recruiting service for ecosystem teams — sibling to the "Post a
// role" CTA, aimed at the hiring-company side of the careers audience.
// ponytail: single static CTA; add a variant prop only if a second placement needs it.
export function SnowballTalentCta({ className }: { className?: string }) {
  return (
    <a
      href={SNOWBALL_TALENT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        'group inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:border-red-500/60 hover:text-red-600 dark:hover:text-red-400 transition ' +
        (className ?? '')
      }
    >
      <UserPlus className="w-4 h-4" />
      Get hiring help
      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
    </a>
  );
}
