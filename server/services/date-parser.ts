// All comments in English (as requested).
export function getDateWithTimezone(dateStr: string, timeZone: string): Date {
    const s: string = dateStr.trim();
    const endsWithZ: boolean = /[zZ]$/.test(s);
  
    // Case 1: ends with 'Z' (UTC instant) → project to target TZ wall time
    if (endsWithZ) {
      const utcDate: Date = new Date(s);
      if (isNaN(utcDate.getTime())) throw new Error(`Invalid date string: "${dateStr}"`);
  
      // Extract wall-clock parts in the target time zone
      const fmt: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
        timeZone,
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
  