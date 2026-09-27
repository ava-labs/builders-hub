/**
 * Academy callout marks (spec 4.3): the kind picks the icon's hue and the label shown above the
 * text; a callout whose own text opens with a label word, or a quote, gets no label.
 * Kinds follow fumadocs-ui's Callout (node_modules/fumadocs-ui/dist/components/callout.js:8-14):
 * no type is "info", "warn" is "warning", "tip" is "info".
 */

export type CalloutKind = 'info' | 'warning' | 'error' | 'success' | 'idea' | 'quote';

export type CalloutLabel = 'Note' | 'Caution' | 'Important' | 'Tip';

export interface CalloutMarks {
  kind: CalloutKind;
  label: CalloutLabel | null;
}

const KINDS: ReadonlySet<string> = new Set(['info', 'warning', 'error', 'success', 'idea', 'quote']);

/** One label per kind (spec 7); "idea" shares warning's label, as the prototype's colour rule did. */
const LABELS: Readonly<Record<Exclude<CalloutKind, 'quote'>, CalloutLabel>> = {
  info: 'Note',
  warning: 'Caution',
  idea: 'Caution',
  error: 'Important',
  success: 'Tip',
};

/** The words that make a callout label itself when its text opens with one. */
const LABEL_WORD = /^(note|important|warning|caution|tip|remember)\b/i;

/** The kind fumadocs renders for a Callout's `type`, or null for a type it has no style for. */
export function resolveCalloutKind(type: string | undefined): CalloutKind | null {
  const aliases: Readonly<Record<string, string>> = { warn: 'warning', tip: 'info' };
  const resolved = type === undefined ? 'info' : (aliases[type] ?? type);
  return KINDS.has(resolved) ? (resolved as CalloutKind) : null;
}

/** True when the opening text (the title, then the body) starts with a label word. */
export function opensWithLabelWord(opening: string): boolean {
  return LABEL_WORD.test(opening.trim());
}

/** The marks of one callout, or null when fumadocs has no style for its type. */
export function calloutMarks(type: string | undefined, opening: string): CalloutMarks | null {
  const kind = resolveCalloutKind(type);
  if (kind === null) return null;
  if (kind === 'quote' || opensWithLabelWord(opening)) return { kind, label: null };
  return { kind, label: LABELS[kind] };
}
