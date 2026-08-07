/**
 * Design tokens for the Besu connection page. SELF-CONTAINED BY DESIGN.
 *
 * These are NOT Builder Hub tokens and must not be merged into the repo's
 * Tailwind theme. The page is destined for a separate marketing site, so every
 * value it depends on lives here and nowhere else.
 *
 * They are emitted as CSS custom properties on the page wrapper (see
 * ../layout.tsx) so components reference them as `bg-[var(--besu-ink)]` rather
 * than scattering hex codes. Porting the page means copying this file and the
 * wrapper that injects it.
 *
 * Source: design handoff, "Design tokens" table.
 */
export const BESU_TOKENS = {
  "--besu-red": "#E6212F", // primary red
  "--besu-red-dark": "#B20F2A", // accents on light backgrounds
  "--besu-red-bright": "#FF394A", // accents on dark backgrounds
  "--besu-ink": "#1f1f1f", // ink / dark surface
  "--besu-navy": "#05295B", // rule base, used only via the hairline tokens
  "--besu-slate": "#3B484B", // secondary text on light
  "--besu-grey": "#A2AFB2", // text on dark
  "--besu-surface": "#EBF0FA", // light surface
  "--besu-hairline": "rgba(5,41,91,.2)", // hairline on light
  "--besu-hairline-table": "rgba(5,41,91,.16)", // hairline inside tables
  "--besu-hairline-dark": "rgba(255,255,255,.14)", // hairline on dark
  "--besu-hairline-dark-strong": "rgba(255,255,255,.2)",
  "--besu-row-rule": "rgba(255,255,255,.18)", // control-section row rules
  "--besu-highlight": "rgba(230,33,47,.06)", // highlighted table row
} as const;

/** Layout constants. Container 1200px, gutter 40px, section rhythm 90px. */
export const BESU_CONTAINER = "mx-auto max-w-[1200px] px-5 sm:px-10";

/**
 * Sticky header height: 16px padding + 22px logo + 16px padding + 1px border.
 * Anchor targets offset by this so headings are not hidden on scroll.
 */
export const BESU_SCROLL_OFFSET = "scroll-mt-[72px]";

/** Font family classes, bound to the variables set up in ./fonts.ts. */
export const FONT_DISPLAY = "font-[family-name:var(--font-besu-display)]";
export const FONT_BODY = "font-[family-name:var(--font-besu-body)]";
export const FONT_MONO = "font-[family-name:var(--font-besu-mono)]";
