// Sets a course title the way the Entrepreneur Academy templates do (measured on FW3V and W3GTM):
// Aeonik Bold capitals at 173.4 units, -0.02em tracking, 0.807em line pitch, greedy line breaks.
// Up to two lines sit between the rules at their FW3V places; three lines push the label and the
// rules outward to their W3GTM places; a title that needs more lines is set smaller until it fits.

/** Aeonik Bold advance widths in thousandths of an em (public/fonts/Aeonik-Bold.woff2, measured in Chrome). */
const ADVANCE: Readonly<Record<string, number>> = {
  A: 698, B: 646, C: 702, D: 688, E: 571, F: 544, G: 749, H: 697, I: 269, J: 397, K: 683, L: 509, M: 892,
  N: 700, O: 757, P: 622, Q: 764, R: 642, S: 625, T: 598, U: 685, V: 654, W: 991, X: 677, Y: 664, Z: 628,
  '0': 646, '1': 369, '2': 576, '3': 610, '4': 626, '5': 597, '6': 617, '7': 546, '8': 608, '9': 617,
  ' ': 248, '-': 430, '&': 804, '(': 336, ')': 336, "'": 216, '.': 248, ':': 248, ',': 248, '/': 379,
  '!': 289, '?': 534, '+': 515,
};
const UNKNOWN_ADVANCE = 1000; // wider than every measured glyph (W is 991)
const TRACKING = -20;         // -0.02em after each glyph
const MAX_WIDTH = 1602;       // the rules' length, in viewBox units
const LINE_PITCH = 0.807;     // baseline to baseline, in em
const CAP_HEIGHT = 0.709;     // cap top to baseline, in em
const SIZES = [173.4, 156, 140, 126, 113, 102, 92, 83, 75, 68, 61] as const;
// Label baseline, the two rules' tops and the centre of the title block, in viewBox units.
const TWO_LINES = { labelY: 366, rules: [389.5, 796], centre: 593.5 } as const;   // FW3V
const THREE_LINES = { labelY: 340, rules: [363.5, 851], centre: 607 } as const;   // W3GTM

export interface CertificateLayout {
  size: number;
  lines: string[];
  baselines: number[];
  labelY: number;
  rules: readonly [number, number];
}

/** Width of a line of capitals at a font size, in viewBox units: advances plus tracking, without kerning. */
export function titleWidth(line: string, size: number): number {
  const ems = Array.from(line).reduce((sum, glyph) => sum + (ADVANCE[glyph] ?? UNKNOWN_ADVANCE) + TRACKING, 0);
  return (ems * size) / 1000;
}

function wrap(words: string[], size: number): string[] {
  return words.reduce<string[]>((lines, word) => {
    const last = lines[lines.length - 1];
    if (last !== undefined && titleWidth(`${last} ${word}`, size) <= MAX_WIDTH) return [...lines.slice(0, -1), `${last} ${word}`];
    return [...lines, word];
  }, []);
}

function place(size: number, lines: string[]): CertificateLayout {
  const frame = lines.length <= 2 ? TWO_LINES : THREE_LINES;
  const block = CAP_HEIGHT * size + (lines.length - 1) * LINE_PITCH * size;
  const first = frame.centre - block / 2 + CAP_HEIGHT * size;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { size, lines, baselines: lines.map((_, i) => round(first + i * LINE_PITCH * size)), labelY: frame.labelY, rules: frame.rules };
}

export function layoutCertificate(title: string): CertificateLayout {
  const words = title.toUpperCase().split(/\s+/).filter(Boolean);
  const fits = (size: number, lines: string[]) => lines.length <= 3 && lines.every((line) => titleWidth(line, size) <= MAX_WIDTH);
  const size = SIZES.find((s) => fits(s, wrap(words, s))) ?? SIZES[SIZES.length - 1];
  return place(size, wrap(words, size));
}
