// Escapes each character that a RegExp reads as syntax, so the pattern matches the text as it is.
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
