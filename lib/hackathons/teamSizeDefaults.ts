import type { Hackathon } from "@/types/hackathons";

/**
 * Returns the team-size range admin configured for this hackathon.
 *
 * - `min` defaults to 1 (solo allowed) when unset.
 * - `max` returns `undefined` when admin left it blank (no cap, today's
 *   behavior for legacy hackathons).
 *
 * Mirrors the techStackDefaults shape: a per-event reader that lets the UI
 * adapt without hardcoding any hackathon-specific assumptions.
 */
export interface TeamSizeRange {
  min: number;
  max: number | undefined;
}

export function getTeamSizeRange(
  hackathon:
    | Pick<Hackathon, "team_size_min" | "team_size_max">
    | null
    | undefined,
): TeamSizeRange {
  const min = Number.isFinite(hackathon?.team_size_min)
    ? Math.max(1, Math.trunc(hackathon!.team_size_min as number))
    : 1;
  const rawMax = hackathon?.team_size_max;
  const max =
    Number.isFinite(rawMax) && (rawMax as number) >= min
      ? Math.trunc(rawMax as number)
      : undefined;
  return { min, max };
}

/** True when the UI should render a team-size picker for this hackathon. */
export function hasTeamPicker(range: TeamSizeRange): boolean {
  return range.max !== undefined && range.max > 1;
}
