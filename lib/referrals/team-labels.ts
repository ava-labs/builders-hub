export const REFERRAL_TEAM_LABELS: Record<string, string> = {
  devrel: "DevRel",
  marketing: "Marketing",
  bd: "Business Development",
  foundation: "Foundation",
  "team1-india": "Team1 India",
  "team1-latam": "Team1 LatAm",
  "team1-brazil": "Team1 Brazil",
  "team1-vietnam": "Team1 Vietnam",
  "team1-korea": "Team1 Korea",
  "team1-china": "Team1 China",
  "team1-france": "Team1 France",
  "team1-turkey": "Team1 Turkey",
  "team1-africa": "Team1 Africa",
  "team1-philippines": "Team1 Philippines",
  "team1-japan": "Team1 Japan",
};

// UI label for the free-text fallback option in the referral picker.
export const OTHER_TEAM_LABEL = "Other";

// DB sentinel persisted in ReferralAttribution.team_id_referrer when the
// visitor selects "Other". The free-text label they typed lives in
// team_id_referrer_other. Kept distinct from "other" so the UI value and
// stored value cannot be confused; client emits "other" on submit and the
// server normalizes to "none" before storage.
export const OTHER_TEAM_SENTINEL = "none";

// Client-facing token emitted by the picker when "Other" is selected.
export const OTHER_TEAM_CLIENT_VALUE = "other";

export function isReferralTeamId(value: unknown): value is string {
  return typeof value === "string" && value in REFERRAL_TEAM_LABELS;
}

export function isOtherTeam(value: unknown): boolean {
  return value === OTHER_TEAM_SENTINEL || value === OTHER_TEAM_CLIENT_VALUE;
}

export function isReferralTeamIdOrOther(value: unknown): value is string {
  return isReferralTeamId(value) || isOtherTeam(value);
}

export function formatTeamLabel(
  teamId: string | null | undefined,
  otherText?: string | null,
): string | null {
  if (!teamId) return null;
  if (isOtherTeam(teamId)) {
    const trimmed = otherText?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : OTHER_TEAM_LABEL;
  }
  return REFERRAL_TEAM_LABELS[teamId] ?? teamId;
}
