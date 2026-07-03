// All comments in English (as requested).

function isSupportedTimeZone(timeZone: string): boolean {
    if (!timeZone) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone });
        return true;
    } catch {
        return false;
    }
}

/**
 * Offset (in ms) of `timeZone` at the given absolute `instant`.
 *
 * Computed as (the instant's wall clock in `timeZone`, read as if it were UTC)
 * minus the instant itself. Positive east of UTC. Relies only on `Intl` and
 * `Date.UTC`, so the result does NOT depend on the timezone of the host
 * process — critical, since this runs on servers configured to UTC while
 * clients pick arbitrary event timezones.
 */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const map: Record<string, string> = Object.fromEntries(
        fmt.formatToParts(instant).map(p => [p.type, p.value])
    );
    let hour = Number(map.hour);
    if (hour === 24) hour = 0; // Intl can emit "24" at midnight in some engines
    const asUTC = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        hour,
        Number(map.minute),
        Number(map.second)
    );
    return asUTC - instant.getTime();
}

/**
 * Convert a naive wall-clock (Y-M-D H:M:S with no zone) that is understood to
 * be in `timeZone` into the corresponding absolute UTC instant.
 *
 * Uses one refinement pass so DST transitions resolve correctly (the offset at
 * the naive time differs from the offset at the resulting instant near a DST
 * boundary).
 */
function zonedWallClockToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timeZone: string
): Date {
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
    let offset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
    // Refine using the offset at the first approximation of the true instant.
    offset = timeZoneOffsetMs(new Date(utcGuess - offset), timeZone);
    return new Date(utcGuess - offset);
}

export function getDateWithTimezone(dateStr: string, timeZone: string): Date {
    if (!dateStr) {
        throw new Error(`Invalid date string: "${dateStr}"`);
    }
    const s: string = dateStr.trim();
    const endsWithZ: boolean = /[zZ]$/.test(s);

    // Case 1: ends with 'Z' (UTC instant) → project to target TZ wall time.
    //
    // LEGACY PATH: the event schedule still submits browser-converted 'Z'
    // strings through this branch. Its behavior is intentionally preserved as-is
    // — do NOT "simplify" it to a pass-through without also migrating the
    // schedule load/save code, or existing schedule times will shift.
    if (endsWithZ) {
      const utcDate: Date = new Date(s);
      if (isNaN(utcDate.getTime())) throw new Error(`Invalid date string: "${dateStr}"`);

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

    // Case 2: a naive wall-clock ("YYYY-MM-DDTHH:MM[:SS]") with no zone info is
    // interpreted as a wall-clock time in `timeZone` and converted to the true
    // absolute UTC instant. This is the path used by the event start/end
    // date pickers: e.g. "11:00" in "UTC" → 11:00Z, "11:00" in "Europe/Moscow"
    // (UTC+3) → 08:00Z. It is independent of the host process timezone.
    const naive = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (naive) {
      const safeTimeZone: string = isSupportedTimeZone(timeZone) ? timeZone : 'UTC';
      return zonedWallClockToUtc(
        Number(naive[1]),
        Number(naive[2]),
        Number(naive[3]),
        Number(naive[4]),
        Number(naive[5]),
        Number(naive[6] ?? '0'),
        safeTimeZone
      );
    }

    // Case 3: any other format (e.g. an explicit numeric offset like
    // "…+03:00") already denotes an absolute instant → parse as-is.
    const d: Date = new Date(s);
    if (isNaN(d.getTime())) throw new Error(`Invalid date string: "${dateStr}"`);
    return d;
  }
