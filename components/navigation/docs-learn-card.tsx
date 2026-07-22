import Link from 'next/link';
import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Chainlink-style dual-intent card for the Documentation mega-menu: one topic,
 * two exits — reference docs and the guided Academy track. Rendered as a
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
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  docsHref: string;
  learnHref: string;
  className?: string;
}) {
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
        <Link
          href={docsHref}
          className="text-fd-primary transition-colors hover:underline"
        >
          Docs
        </Link>
        <span aria-hidden className="h-3.5 w-px bg-fd-border" />
        <Link
          href={learnHref}
          className="text-fd-primary transition-colors hover:underline"
        >
          Learn
        </Link>
      </div>
    </div>
  );
}
