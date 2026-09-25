/** Minimal CSV writer for the admin exports. Dates render as ISO days. */

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  // Formula-injection guard: a cell a spreadsheet would evaluate is prefixed
  // so it renders as text (S-15; the whitelist export now carries firm-set
  // team_emails).
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) || text.startsWith("'") ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return `${[header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}
