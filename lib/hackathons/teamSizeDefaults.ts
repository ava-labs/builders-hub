import type { Hackathon } from "@/types/hackathons";

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

export function hasTeamPicker(range: TeamSizeRange): boolean {
  return range.max !== undefined && range.max > 1;
}
