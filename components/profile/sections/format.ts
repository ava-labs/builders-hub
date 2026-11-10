/* One voice for dates across the profile sections: "Oct 3, 2026" for a day,
   "Oct 3, 2026, 8:00 AM" for a moment, in the viewer's time zone. A bad date
   gives an empty string, so a row leaves its <time> out. */

const DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const MOMENT: Intl.DateTimeFormatOptions = { ...DAY, hour: "numeric", minute: "2-digit" };

function format(iso: string, options: Intl.DateTimeFormatOptions, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(date);
}

export const formatDay = (iso: string, timeZone?: string) => format(iso, DAY, timeZone);
export const formatMoment = (iso: string, timeZone?: string) => format(iso, MOMENT, timeZone);
