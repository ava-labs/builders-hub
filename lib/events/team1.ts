/**
 * Detects whether an event is organized or co-hosted by Team1.
 *
 * Matches "team1", "team 1", "Team1", "TEAM1", etc. against the hackathon's
 * `organizers` string and any entry in `cohosts`. Used to make the Team1
 * outreach consent (`User.consent_sharing`) mandatory at registration time.
 */
const TEAM1_PATTERN = /team\s*1/i;

export function isTeam1Event(input: {
  organizers?: string | null;
  cohosts?: string[] | null;
}): boolean {
  if (input.organizers && TEAM1_PATTERN.test(input.organizers)) return true;
  if (input.cohosts && input.cohosts.some((c) => TEAM1_PATTERN.test(c))) {
    return true;
  }
  return false;
}
