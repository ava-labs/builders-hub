// All comments in English (as requested).

/**
 * Returns true when the runtime's Intl implementation accepts the given IANA
 * time zone. Guards against bad values (e.g. the non-existent "Asia/Mumbai") or
 * empty strings reaching Intl.DateTimeFormat, which throws a RangeError and
 * would otherwise crash hackathon create/update.
 */
function isSupportedTimeZone(timeZone: string): boolean {
    if (!timeZone) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone });
        return true;
    } catch {
        return false;
    }
}

export function getDateWithTimezone(dateStr: string, timeZone: string): Date {
    if (!dateStr) {
        throw new Error(`Invalid date string: "${dateStr}"`);
    }
    const s: string = dateStr.trim();
    const endsWithZ: boolean = /[zZ]$/.test(s);
  
    // Case 1: ends with 'Z' (UTC instant) → project to target TZ wall time
    if (endsWithZ) {
      const utcDate: Date = new Date(s);
      if (isNaN(utcDate.getTime())) throw new Error(`Invalid date string: "${dateStr}"`);

      // Fall back to UTC when the time zone is missing or unrecognised, so a bad
      // identifier can never crash event create/update.
      const safeTimeZone: string = isSupportedTimeZone(timeZone) ? timeZone : 'UTC';

      // Extract wall-clock parts in the target time zone
      const fmt: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
        timeZone: safeTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts: Intl.DateTimeFormatPart[] = fmt.formatToParts(utcDate);
      const map: Record<string, string> = Object.fromEntries(parts.map(p => [p.type, p.value]));
  
      const year: number = Number(map.year);
      const month: number = Number(map.month);
      const day: number = Number(map.day);
      const hour: number = Number(map.hour ?? '0');
      const minute: number = Number(map.minute ?? '0');
      const second: number = Number(map.second ?? '0');
      const ms: number = utcDate.getUTCMilliseconds();
  
      // Build a Date using those wall-clock numbers (this "freezes" the TZ wall time).
      return new Date(year, month - 1, day, hour, minute, second, ms);
    }
  
    // Case 2: any other format → ignore timeZone and parse as-is (preserve the instant)
    const d: Date = new Date(s);
    if (isNaN(d.getTime())) throw new Error(`Invalid date string: "${dateStr}"`);
    return d;
  }
  