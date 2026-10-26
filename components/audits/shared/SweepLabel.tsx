import type { ReactNode } from "react";

/**
 * The label of an audits red CTA, then an aria-hidden copy of it: app/global.css (.sweep-copy, site-cta-synced-sweep)
 * lays the copy over the control in brand light and ink and reveals it left to right on hover and keyboard focus, so
 * the label changes colour exactly where the fill passes. The copy is inert too, so screen readers, role queries and
 * find in page meet the label once (a plain text query, such as Playwright's getByText, still finds both). Put it
 * directly inside the control, which carries the sweep class.
 */
export function SweepLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <span aria-hidden inert className="sweep-copy">
        {children}
      </span>
    </>
  );
}
