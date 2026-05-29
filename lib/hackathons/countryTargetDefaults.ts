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

export function getDefaultTargetCountries(
  teamId: string | null | undefined,
): string[] {
  if (!teamId) return [];
  const defaults = TEAM_DEFAULT_COUNTRIES[teamId];
  return defaults ? [...defaults] : [];
}

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
