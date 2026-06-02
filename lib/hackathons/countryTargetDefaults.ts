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

// A country can be spelled several ways across our sources: the profile picker
// (constants/countries.ts) carries duplicates like "Côte d'Ivoire" AND "Ivory
// Coast", "South Korea" AND "Korea (South)", "Democratic Republic of the Congo"
// AND "Congo (Kinshasa)", "São Tomé and Príncipe" AND "Sao Tome & Principe";
// the team target lists use yet another spelling. Map every known variant to a
// single canonical token so comparison doesn't reject a user who is in fact in
// a targeted country.
const COUNTRY_CANONICAL: Record<string, string> = {
  "ivory coast": "ci",
  "cote d ivoire": "ci",
  "south korea": "kr",
  "korea south": "kr",
  "korea republic of": "kr",
  "north korea": "kp",
  "korea north": "kp",
  "democratic republic of the congo": "cd",
  "congo kinshasa": "cd",
  "dr congo": "cd",
  "republic of the congo": "cg",
  "congo brazzaville": "cg",
  "congo": "cg",
  "sao tome and principe": "st",
  "sao tome principe": "st",
};

// Lowercase, strip diacritics and punctuation, collapse whitespace, then fold
// known synonyms to a canonical token.
function normalizeCountry(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return COUNTRY_CANONICAL[base] ?? base;
}

export function isCountryAllowed(
  targetCountries: readonly string[] | null | undefined,
  userCountry: string | null | undefined,
): boolean {
  if (!Array.isArray(targetCountries) || targetCountries.length === 0) {
    return true;
  }
  if (!userCountry?.trim()) return false;
  const normalizedUser = normalizeCountry(userCountry);
  return targetCountries.some(
    (c) =>
      typeof c === "string" &&
      c.trim().length > 0 &&
      normalizeCountry(c) === normalizedUser,
  );
}
