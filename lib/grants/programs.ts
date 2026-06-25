export interface GrantProgram { key: string; title: string; slug: string; hackathonId: string; }

export const MINI_GRANT_KEY = "grant_minigrant";
export const MINI_GRANT_SLUG = "team1-mini-grants";
export const MINI_GRANT_HACKATHON_ID = "00000000-0000-4000-8000-000000000002";

export const GRANT_PROGRAMS: Record<string, GrantProgram> = {
  [MINI_GRANT_KEY]: { key: MINI_GRANT_KEY, title: "Team1 Mini Grants", slug: MINI_GRANT_SLUG, hackathonId: MINI_GRANT_HACKATHON_ID },
};

export function isKnownGrantProgram(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(GRANT_PROGRAMS, key);
}
