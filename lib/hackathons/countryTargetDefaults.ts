/**
 * Per-event country targeting:
 *   - `target_countries: string[]` on Hackathon.content
 *   - empty/missing  → global, no country gate at registration
 *   - non-empty      → registrants must have `User.country` in this list
 *
 * Values match the format of `User.country` (full English country names,
 * keyed off `components/profile/shell/data.ts:COUNTRIES`). This matches the
 * SPEEDRUN spec line: "some events are country-specific, so [country] can't
 * be changed later" — combined with the user-level country lock, this
 * enforces region-specific events.
 */

/**
 * Default countries an event covers when the admin doesn't override the
 * `target_countries` field. Keyed by `User.team_id` (the organizer team).
 * Leave undefined to default to "global" (no countries) for that team.
 *
 * Add entries here when a team's geographic scope is well-defined.
 */
// Values must match the curated COUNTRIES picker (`components/profile/shell/data.ts`)
// because `User.country` is constrained to those exact strings. Listing a
// country here that isn't in COUNTRIES would produce an unmatchable target.
export const TEAM_DEFAULT_COUNTRIES: Record<string, readonly string[]> = {
  "team1-india": ["India"],
  "team1-brazil": ["Brazil"],
  "team1-vietnam": ["Vietnam"],
  "team1-korea": ["South Korea"],
  "team1-china": ["China"],
  "team1-france": ["France"],
  "team1-turkey": ["Turkey"],
  "team1-philippines": ["Philippines"],
  "team1-japan": ["Japan"],
  "team1-latam": [
    "Argentina",
    "Bolivia",
    "Brazil",
    "Chile",
    "Colombia",
    "Costa Rica",
    "Cuba",
    "Dominican Republic",
    "Ecuador",
    "El Salvador",
    "Guatemala",
    "Honduras",
    "Mexico",
    "Nicaragua",
    "Panama",
    "Paraguay",
    "Peru",
    "Uruguay",
    "Venezuela",
  ],
  "team1-africa": [
    "Algeria",
    "Angola",
    "Benin",
    "Botswana",
    "Burkina Faso",
    "Burundi",
    "Cameroon",
    "Cape Verde",
    "Central African Republic",
    "Chad",
    "Comoros",
    "Democratic Republic of the Congo",
    "Djibouti",
    "Egypt",
    "Equatorial Guinea",
    "Eritrea",
    "Eswatini",
    "Ethiopia",
    "Gabon",
    "Gambia",
    "Ghana",
    "Guinea",
    "Guinea-Bissau",
    "Ivory Coast",
    "Kenya",
    "Lesotho",
    "Liberia",
    "Libya",
    "Madagascar",
    "Malawi",
    "Mali",
    "Mauritania",
    "Mauritius",
    "Morocco",
    "Mozambique",
    "Namibia",
    "Niger",
    "Nigeria",
    "Republic of the Congo",
    "Rwanda",
    "Sao Tome and Principe",
    "Senegal",
    "Seychelles",
    "Sierra Leone",
    "Somalia",
    "South Africa",
    "South Sudan",
    "Sudan",
    "Tanzania",
    "Togo",
    "Tunisia",
    "Uganda",
    "Zambia",
    "Zimbabwe",
  ],
};

/**
 * The default `target_countries` array a new hackathon should start with.
 * Returns [] (global) when there's no team default — admins opt in by adding
 * countries through the editor.
 */
export function getDefaultTargetCountries(
  teamId: string | null | undefined,
): string[] {
  if (!teamId) return [];
  const defaults = TEAM_DEFAULT_COUNTRIES[teamId];
  return defaults ? [...defaults] : [];
}

/**
 * Server-side gate for the registration upsert. When the hackathon has a
 * `target_countries` whitelist and the user's country isn't in it, reject.
 * Empty/missing list = global, accept anyone.
 */
export function isCountryAllowed(
  targetCountries: readonly string[] | null | undefined,
  userCountry: string | null | undefined,
): boolean {
  if (!Array.isArray(targetCountries) || targetCountries.length === 0) {
    return true;
  }
  if (!userCountry?.trim()) return false;
  const normalized = userCountry.trim().toLowerCase();
  return targetCountries.some(
    (c) => typeof c === "string" && c.trim().toLowerCase() === normalized,
  );
}
