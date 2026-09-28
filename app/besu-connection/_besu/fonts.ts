import { Archivo, Inter, DM_Mono } from "next/font/google";

/**
 * Typefaces for the Besu connection page. SELF-CONTAINED BY DESIGN.
 *
 * Builder Hub runs on Geist. These three belong to this page only and are
 * scoped to its wrapper rather than the root layout, so nothing else on the
 * site pays for them and lifting the page out takes nothing with it.
 *
 * The CSS variable names are deliberately namespaced (`--font-besu-*`) so they
 * cannot collide with the host application's font variables.
 *
 * Source: design handoff, "Typography".
 */

/** Display and headings. H1 72/.94/-.03em, section H2 38/1.05/-.02em. */
export const besuDisplay = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-besu-display",
  display: "swap",
});

/** Body copy. 19px hero deck down to 13px table cells. */
export const besuBody = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-besu-body",
  display: "swap",
});

/** Every eyebrow, label, nav item and button. 10-11px, uppercase, tracked. */
export const besuMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-besu-mono",
  display: "swap",
});

export const BESU_FONT_VARS = [
  besuDisplay.variable,
  besuBody.variable,
  besuMono.variable,
].join(" ");
