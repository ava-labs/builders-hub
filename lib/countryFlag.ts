import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

// Turn an ISO 3166-1 alpha-2 code (e.g. "US") into the matching flag emoji
// (e.g. "🇺🇸"). Returns null if the code is invalid. Uses regional indicator
// symbols, so modern OS font stacks render these as real country flags.
export function flagEmojiFromAlpha2(code: string | undefined | null): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  const codePoints = [
    0x1f1e6 + (trimmed.charCodeAt(0) - 65),
    0x1f1e6 + (trimmed.charCodeAt(1) - 65),
  ];
  return String.fromCodePoint(...codePoints);
}

// Resolve a flag emoji from a country label (e.g. "United States" -> "🇺🇸").
// Returns null if the label can't be matched. Falls back to trying the raw
// label through i18n-iso-countries' name lookup.
export function flagForCountryName(name: string | undefined | null): string | null {
  if (!name) return null;
  const alpha2 = countries.getAlpha2Code(name, 'en');
  return flagEmojiFromAlpha2(alpha2 ?? null);
}
