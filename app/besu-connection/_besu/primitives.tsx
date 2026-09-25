import type { ReactNode } from "react";
import { FONT_DISPLAY, FONT_MONO } from "./tokens";

/**
 * Local primitives for the Besu connection page. SELF-CONTAINED BY DESIGN.
 *
 * These deliberately do NOT reuse Builder Hub's BrandButton, section wrappers
 * or typography components. The page ships to a different site with a
 * different design system, so a dependency on the host repo's primitives would
 * have to be unpicked later. Three small components is the cheaper trade.
 *
 * Radius is 0 and shadows are none, everywhere, by design.
 */

/**
 * The 200px rail + content grid used by every light and dark section.
 * Collapses to a single column below `lg`, with the rail label above the
 * heading, per the handoff's responsive notes.
 */
export function RailHeading({
  rail,
  children,
  onDark = false,
}: {
  rail: ReactNode;
  children: ReactNode;
  onDark?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr] lg:gap-10">
      <div
        className={`${FONT_MONO} text-[10px] font-medium leading-[1.8] tracking-[0.14em] lg:pt-2 ${
          onDark
            ? "text-[var(--besu-red-bright)]"
            : "text-[var(--besu-red-dark)]"
        }`}
      >
        {rail}
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Renders a rail label from an array of lines, hard-broken as designed. */
export function railLines(lines: readonly string[]) {
  return lines.map((line, i) => (
    <span key={line}>
      {line}
      {i < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

/** Section H2. 38px at full width, fluid down to 28px. */
export function SectionHeading({
  children,
  onDark = false,
}: {
  children: ReactNode;
  onDark?: boolean;
}) {
  return (
    <h2
      className={`${FONT_DISPLAY} m-0 max-w-[760px] text-[clamp(28px,5vw,38px)] font-extrabold leading-[1.05] tracking-[-0.02em] [text-wrap:pretty] ${
        onDark ? "text-white" : "text-black"
      }`}
    >
      {children}
    </h2>
  );
}

/**
 * The filled + outlined button pair used in the hero and the closing CTA.
 * Square corners; filled darkens on hover, outlined brightens its border.
 */
export function ButtonRow({
  primary,
  secondary,
}: {
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-[14px]">
      <a
        href={primary.href}
        className={`${FONT_MONO} bg-[var(--besu-red)] px-7 py-4 text-[11px] font-medium tracking-[0.14em] text-white transition-colors duration-150 hover:bg-[var(--besu-red-dark)]`}
      >
        {primary.label}
      </a>
      <a
        href={secondary.href}
        className={`${FONT_MONO} border border-[var(--besu-hairline-dark-strong)] px-7 py-4 text-[11px] font-medium tracking-[0.14em] text-white transition-colors duration-150 hover:border-white`}
      >
        {secondary.label}
      </a>
    </div>
  );
}
