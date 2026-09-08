/** Minimal CSV writer for the admin exports. Dates render as ISO days. */

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return `${[header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}
