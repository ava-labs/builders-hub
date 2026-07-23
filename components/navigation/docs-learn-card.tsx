import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Chainlink-style dual-intent card for the Documentation mega-menu: one topic,
 * two exits — reference docs plus the guided Academy track and/or the matching
 * console tool. Rendered as a
 * fumadocs `type: 'custom'` menu item, so the root div is a direct child of
 * the popover grid and carries its own col/row placement classes. Styling
 * mirrors fumadocs' native menu cards (fd-* tokens) so mixed rows read as one
 * system.
 */
export function DocsLearnCard({
  icon,
  title,
  description,
  docsHref,
  learnHref,
  toolsHref,
  links,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  docsHref?: string;
  /** guided Academy track; renders the "Academy" link */
  learnHref?: string;
  /** console tool; renders the "Tools" link */
  toolsHref?: string;
  /** custom labeled links; overrides the docs/learn/tools trio entirely */
  links?: { label: string; href: string }[];
  className?: string;
}) {
  const items =
    links ??
    [
      docsHref && { label: 'Docs', href: docsHref },
      learnHref && { label: 'Academy', href: learnHref },
      toolsHref && { label: 'Tools', href: toolsHref },
    ].filter((l): l is { label: string; href: string } => Boolean(l));
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-fd-card p-3 transition-colors hover:bg-fd-accent/50',
        className,
      )}
    >
      <div className="w-fit rounded-md border bg-fd-muted p-1 [&_svg]:size-4">{icon}</div>
      <p className="text-base font-medium">{title}</p>
      <p className="text-sm text-fd-muted-foreground">{description}</p>
      <div className="mt-auto flex items-center gap-3 pt-1.5 text-sm font-medium">
        {items.map((link, i) => (
          <Fragment key={link.href}>
            {i > 0 && <span aria-hidden className="h-3.5 w-px bg-fd-border" />}
            <Link
              href={link.href}
              className="text-fd-primary transition-colors hover:underline"
            >
              {link.label}
            </Link>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
