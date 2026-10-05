/**
 * Image assets for the Besu connection page. SELF-CONTAINED BY DESIGN.
 *
 * All four files live under `public/besu-connection/` and are used by no other
 * page. Moving the page means moving that one directory and repointing these
 * constants; nothing else references them.
 *
 * Originals: design handoff, `design-references/uploads/`. Sourced from the
 * Ava Labs visual system.
 *
 * NOTE ON LICENSING: the two textures are brand-library imagery. Approved crops
 * and external-publication rights need confirming before this page goes public
 * on a marketing domain. Flagged in the handoff, not yet resolved.
 *
 * NOTE ON WEIGHT: cta-snow.png is ~8.5MB and hero-motionblur.jpg ~4.3MB as
 * delivered. next/image optimises them on the way out, but they should be
 * compressed at source before this ships anywhere real.
 */

export const BESU_ASSETS = {
  /** Official horizontal logo, white variant, for the dark sticky header.
   *  Never rebuild the mark in CSS or SVG. */
  logoWhite: "/besu-connection/avalanche-logo-white.png",
  /** Full-colour variant, for light backgrounds. Unused by the current
   *  composition; kept so a light header variant needs no re-sourcing. */
  logoPrimary: "/besu-connection/avalanche-logo-primary.png",
  /** Hero right-side texture, sits behind a left-to-right scrim. */
  heroTexture: "/besu-connection/hero-motionblur.jpg",
  /** CTA bottom band, screen-blended at 50% opacity. */
  ctaTexture: "/besu-connection/cta-snow.png",
} as const;

/** Intrinsic display size of the logo in the header. */
export const BESU_LOGO_SIZE = { width: 132, height: 22 } as const;
