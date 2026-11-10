/**
 * Discipline hue of an Academy course. The track configs in
 * components/academy/learning-path-configs/ colour each category with a Tailwind gradient; the
 * reskin keeps colour inside the icon tile only and maps each palette family to one hue, drawn
 * from the --ac-hue-* and --ac-tint-* tokens (components/academy/theme/academy-tokens.css).
 */

export type DisciplineHue = 'blue' | 'purple' | 'emerald' | 'gold' | 'orange' | 'teal' | 'green';

// Red and yellow become gold; indigo becomes teal, so the Blockchain track does not show two blues.
const HUE_BY_FAMILY: ReadonlyMap<string, DisciplineHue> = new Map([
  ['blue', 'blue'],
  ['purple', 'purple'],
  ['emerald', 'emerald'],
  ['red', 'gold'],
  ['yellow', 'gold'],
  ['orange', 'orange'],
  ['indigo', 'teal'],
  ['green', 'green'],
]);

// The palette family of the gradient's first stop: "from-red-400 to-red-500" gives "red".
const FROM_FAMILY = /(?:^|\s)from-([a-z]+)-\d{2,3}(?=\s|$)/;

/** Maps a track config category gradient, e.g. "from-red-400 to-red-500", to its Academy hue. */
export function disciplineHue(gradient: string): DisciplineHue | null {
  const family = FROM_FAMILY.exec(gradient)?.[1];
  return family === undefined ? null : (HUE_BY_FAMILY.get(family) ?? null);
}
