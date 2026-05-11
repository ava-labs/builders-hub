// Shared text/number formatting helpers for the Insights tab.
// Lifted from components/builder-insights/BuilderInsightsDashboard.tsx so the
// new redesign component doesn't import from the legacy dashboard file.

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function flagEmoji(code: string | null | undefined): string {
  if (!code) return "";
  const trimmed = code.trim();
  if (trimmed.length !== 2 || !/^[A-Za-z]{2}$/.test(trimmed)) return "";
  return [...trimmed.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  india: "IN",
  nigeria: "NG",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  turkey: "TR",
  "türkiye": "TR",
  indonesia: "ID",
  argentina: "AR",
  china: "CN",
  philippines: "PH",
  france: "FR",
  kenya: "KE",
  vietnam: "VN",
  "viet nam": "VN",
  mexico: "MX",
  pakistan: "PK",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  brazil: "BR",
  brasil: "BR",
  peru: "PE",
  canada: "CA",
  colombia: "CO",
  rwanda: "RW",
  russia: "RU",
  "russian federation": "RU",
  japan: "JP",
  bolivia: "BO",
  "south korea": "KR",
  "korea (south)": "KR",
  "republic of korea": "KR",
  "united arab emirates": "AE",
  uae: "AE",
  bangladesh: "BD",
  spain: "ES",
  ukraine: "UA",
  germany: "DE",
  chile: "CL",
  italy: "IT",
  netherlands: "NL",
  australia: "AU",
  singapore: "SG",
  switzerland: "CH",
  belgium: "BE",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  poland: "PL",
  portugal: "PT",
  greece: "GR",
  egypt: "EG",
  "south africa": "ZA",
  israel: "IL",
  thailand: "TH",
  malaysia: "MY",
  "saudi arabia": "SA",
  iran: "IR",
  iraq: "IQ",
  "hong kong": "HK",
  taiwan: "TW",
  "new zealand": "NZ",
  ireland: "IE",
  romania: "RO",
  "czech republic": "CZ",
  czechia: "CZ",
  hungary: "HU",
  austria: "AT",
  finland: "FI",
};

export function countryNameToFlag(name: string | null | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed.length === 2 && /^[A-Za-z]{2}$/.test(trimmed)) {
    return flagEmoji(trimmed);
  }
  const code = COUNTRY_NAME_TO_ISO2[trimmed.toLowerCase()];
  return code ? flagEmoji(code) : "";
}

export function toTitleCase(input: string): string {
  if (!input) return input;
  return input
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((part) =>
      /^[a-zà-ÿñ]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part,
    )
    .join("");
}

export function initials(name: string): string {
  return toTitleCase(name)
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const MONTHS_UPPER = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** "AUG 2025" if single month, "NOV — DEC 2025" if same year,
    "FEB 2026 — MAR 2026" across years. Matches the Hackathon History card
    typography (mono uppercase). */
export function formatHackathonRange(
  startISO: string | null,
  endISO: string | null,
): string {
  const start = startISO ? new Date(startISO) : null;
  const end = endISO ? new Date(endISO) : start;
  if (!start) return "";
  if (!end || (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth())) {
    return `${MONTHS_UPPER[start.getMonth()]} ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${MONTHS_UPPER[start.getMonth()]} — ${MONTHS_UPPER[end.getMonth()]} ${start.getFullYear()}`;
  }
  return `${MONTHS_UPPER[start.getMonth()]} ${start.getFullYear()} — ${MONTHS_UPPER[end.getMonth()]} ${end.getFullYear()}`;
}
