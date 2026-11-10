/**
 * Dark labels on light author fills in Mermaid charts (production's dark-mode defect).
 * The dark theme draws labels in a light grey, so a node the author filled with a light colour
 * (a `style` or `classDef` line with a light `fill:`) shows light text on a light shape.
 * Mermaid applies a `color` given on the same line to that node's label, so the chart gets one:
 * the Academy's --ac-ink-on-light token. components/content-design/mermaid.tsx renders through
 * renderWithLightFillLabels, so this runs in the dark theme inside the Academy only; anywhere else
 * Mermaid renders the chart as written.
 */

/** The label colour on light fills: the Academy token (academy-tokens.css), resolved where the chart is painted. */
export const LIGHT_FILL_LABEL = 'var(--ac-ink-on-light)';

/** Mermaid's style grammar reads no var(), so the chart source carries this word in the token's place. */
const PLACEHOLDER = 'acInkOnLight';
const ACADEMY_ROOT = '[data-academy]';
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const DIRECTIVE = /^(\s*(?:style|classDef)\s+\S+\s+)(.*?)(\s*;?\s*)$/;
const FILL = /^\s*fill\s*:\s*(\S+?)\s*$/i;
const COLOR = /^\s*color\s*:/i;

function channels(hex: string): [number, number, number] | null {
  const match = HEX.exec(hex);
  if (match === null) return null;
  const digits = match[1].length === 3 ? match[1].replace(/./g, (d) => d + d) : match[1].slice(0, 6);
  const at = (i: number) => parseInt(digits.slice(i, i + 2), 16);
  return [at(0), at(2), at(4)];
}

/** A hex fill is light when 0.2126 R + 0.7152 G + 0.0722 B, over 255, is above 0.6. Anything but hex is not light. */
export function isLightFill(color: string): boolean {
  const rgb = channels(color.trim());
  if (rgb === null) return false;
  const [r, g, b] = rgb;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

function withLabelColor(line: string, color: string): string {
  const match = DIRECTIVE.exec(line);
  if (match === null) return line;
  const [, head, props, tail] = match;
  const parts = props.split(',');
  const fill = parts.map((part) => FILL.exec(part)).find((found): found is RegExpExecArray => found !== null);
  if (fill === undefined || parts.some((part) => COLOR.test(part)) || !isLightFill(fill[1])) return line;
  return `${head}${props},color:${color}${tail}`;
}

/** The chart with `color:<color>` added to every style or classDef line that sets a light fill and no color. */
export function withDarkLabelsOnLightFills(chart: string, color: string): string {
  return chart.split('\n').map((line) => withLabelColor(line, color)).join('\n');
}

/**
 * Mermaid's svg for `chart` drawn into `container`, through `render` (chart source to svg). In the dark
 * theme inside the Academy root, light fills get the placeholder as their label colour, and the svg
 * trades it for the token, so the colour follows the stylesheet whenever it applies. Anywhere else,
 * and for a chart without light fills, `render` gets the chart as written and its svg comes back as it is.
 */
export async function renderWithLightFillLabels(
  render: (source: string) => Promise<string>,
  chart: string,
  theme: 'light' | 'dark',
  container: Element,
): Promise<string> {
  const inAcademy = theme === 'dark' && container.closest(ACADEMY_ROOT) !== null;
  const source = inAcademy ? withDarkLabelsOnLightFills(chart, PLACEHOLDER) : chart;
  const svg = await render(source);
  return source === chart ? svg : svg.split(PLACEHOLDER).join(LIGHT_FILL_LABEL);
}
