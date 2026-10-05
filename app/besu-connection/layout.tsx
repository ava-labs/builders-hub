import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { BESU_FONT_VARS } from "./_besu/fonts";
import { BESU_TOKENS, FONT_BODY } from "./_besu/tokens";
import { PAGE_META } from "./_besu/content";

/* ------------------------------------------------------------------ */
/* Besu connection landing page — ISOLATED placeholder.                */
/*                                                                     */
/* This route deliberately sits OUTSIDE the (home) route group, so it   */
/* inherits neither the Builder Hub navbar nor the Builder Hub footer.  */
/* The design carries its own sticky header and footer, and the page    */
/* is ultimately destined for a separate marketing site. It lives here  */
/* only so the work can be socialised on a real URL.                    */
/*                                                                     */
/* It is not linked from anywhere and is marked noindex. Adding it to   */
/* layout.config.tsx or any nav would defeat the point — if it should   */
/* become discoverable, that is a decision to take explicitly.          */
/*                                                                     */
/* Everything the page depends on lives in ./_besu and                  */
/* public/besu-connection. See ./_besu/README.md before moving it.      */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: PAGE_META.title,
  description: PAGE_META.description,
  robots: { index: false, follow: false },
};

export default function BesuConnectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={`${BESU_FONT_VARS} ${FONT_BODY} scroll-smooth bg-[var(--besu-surface)] antialiased`}
      style={BESU_TOKENS as CSSProperties}
    >
      {children}
    </div>
  );
}
