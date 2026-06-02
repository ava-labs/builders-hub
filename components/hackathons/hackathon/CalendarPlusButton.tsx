import { EventsLang, t } from '@/lib/events/i18n';

type CalendarPlusButtonProps = {
  googleCalendarId?: string | null;
  lang: EventsLang;
  variant?: 'stages' | 'schedule';
};

export default function CalendarPlusButton({
  googleCalendarId,
  lang,
  variant = 'stages',
}: CalendarPlusButtonProps) {
  if (!googleCalendarId) {
    return null;
  }

  const href = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(googleCalendarId)}`;
  const label = t(lang, 'event.addToCalendar');

  if (variant === 'schedule') {
    return (
      <a
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex w-full sm:w-auto items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800'
      >
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className='group relative inline-flex w-full sm:w-auto'
    >
      <div className='absolute -inset-1 bg-gradient-to-r from-[#d66666] via-[#f83838] to-[#d66666] rounded-lg blur-sm opacity-30 group-hover:opacity-50 transition duration-300' />
      <div className='relative flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-3 bg-[#d66666] rounded-lg font-medium text-[#152d44] group-hover:bg-[#e57f7f] transition-all duration-200 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40'>
        <span className='text-sm sm:text-[15px]'>{label}</span>
      </div>
    </a>
  );
}
