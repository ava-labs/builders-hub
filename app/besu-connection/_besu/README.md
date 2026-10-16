# Besu connection page — isolation notes

This page is a **placeholder hosted in Builder Hub for socialisation only**. It is
destined for a separate marketing site. Everything it needs is deliberately
self-contained so lifting it out is a copy, not a refactor.

## What it depends on

| Dependency | Kind | Portable? |
|---|---|---|
| `next/image` | Next.js framework | Yes, any Next app |
| `next/font/google` | Next.js framework | Yes, any Next app |
| Tailwind utility classes | CSS framework | Yes, any Tailwind v3.4+ or v4 project |
| `./_besu/*` | This folder | Moves with the page |
| `public/besu-connection/*` | Four images | Moves with the page |

**It imports nothing from Builder Hub.** No `components/`, no `lib/`, no repo
UI primitives, no repo design tokens. That is intentional. If you are tempted to
swap `ButtonRow` for the repo's `BrandButton`, do not: it creates exactly the
dependency this structure exists to avoid.

## To move it to another site

1. Copy `app/besu-connection/` (this folder plus `page.tsx` and `layout.tsx`).
2. Copy `public/besu-connection/` to the new project's public directory.
3. If the asset path changes, edit `assets.ts`. Nothing else references the files.
4. Confirm Tailwind is present and scans the new location. Everything is
   utility classes and arbitrary values, so no config beyond content globs.
5. Remove `robots: { index: false }` from `layout.tsx` when it should be
   discoverable.

Nothing else needs touching.

## File map

| File | Holds |
|---|---|
| `tokens.ts` | Colours, container, scroll offset, font-family classes. Emitted as CSS custom properties by `layout.tsx`, so no hex codes are scattered through the markup. |
| `fonts.ts` | Archivo, Inter, DM Mono via `next/font/google`, namespaced `--font-besu-*` so they cannot collide with a host app's fonts. |
| `assets.ts` | The four image paths, plus licensing and file-weight notes. |
| `content.ts` | **Every word on the page.** Copy is approved and final; do not rewrite it. |
| `primitives.tsx` | `RailHeading`, `SectionHeading`, `ButtonRow`, `railLines`. Local on purpose. |
| `sections.tsx` | The nine sections, in page order. |

`page.tsx` is a bare composition. `layout.tsx` scopes the fonts and tokens and
sets metadata.

## Why the route sits outside `(home)`

The `(home)` route group injects the Builder Hub navbar and footer. This design
carries its own. Placing the route at the app root keeps it out of both, and
out of the navigation, which is what "isolated, not findable in the navbar" means
in this codebase. It is not registered in `app/layout.config.tsx` and is not
linked from anywhere.

## Known gaps before this can ship publicly

1. **Both CTA buttons are unwired.** `REQUEST THE SESSION` and `READ THE FULL
   ANALYSIS` point at `#next`, carried over from the reference prototype. They
   need a real form and a real report.
2. **Image licensing is unconfirmed.** The hero and CTA textures come from the
   Ava Labs brand library. Approved crops and external-publication rights were
   flagged in the handoff and are not resolved.
3. **Images are heavy at source.** `cta-snow.png` is ~8.5MB, `hero-motionblur.jpg`
   ~4.3MB. `next/image` optimises delivery, but they should be compressed before
   this goes to a marketing domain.
4. **Claims on this page have not been through the maturity-tag review** that the
   business-writer office applies. Specifically, the page presents the mechanism
   without stating that the Avalanche-to-Besu deployment has not been
   demonstrated and that registry synchronisation is not yet designed. That is a
   content decision, not a front-end one, but it should be settled before the
   page is shown outside Ava Labs.
