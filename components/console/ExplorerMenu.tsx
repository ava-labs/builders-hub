'use client';

import Link from 'next/link';
import { BarChart3, ChevronDown, Compass, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getExplorerOptions, type ExplorerOption } from '@/lib/explorers';

interface ExplorerMenuProps {
  evmChainId: number | null;
  isTestnet: boolean;
  customExplorerUrl?: string;
  /** Path the "Setup Explorer" fallback links to when no explorer is available. */
  setupHref?: string;
  /** Optional Lucide-style icon override for the trigger button (defaults to BarChart3). */
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Four-way explorer picker for an L1. Top option is the Builder Hub native
 * `/explorer/{slug}` route (in-app, same tab); the rest are external
 * third-party explorers (Subnets, Snowtrace, Avascan / L1 custom) that open
 * in a new tab.
 *
 * Render rules (least → most options available):
 *  - 0: a "Setup Explorer" link to /console/layer-1/explorer-setup so the
 *       user can deploy one for their managed L1.
 *  - 1: a single "Open Explorer" button (no menu) — keeps simple chains
 *       from getting a chevron they don't need.
 *  - 2-4: a dropdown with every option, descriptions inline so the user
 *       can tell Builder Hub vs Subnets vs Snowtrace vs custom at a glance.
 */
export function ExplorerMenu({
  evmChainId,
  isTestnet,
  customExplorerUrl,
  setupHref = '/console/layer-1/explorer-setup',
  icon: IconComponent = BarChart3,
}: ExplorerMenuProps) {
  const options = getExplorerOptions({ evmChainId, isTestnet, customExplorerUrl });

  if (options.length === 0) {
    return (
      <Link href={setupHref}>
        <Button variant="outline" size="sm">
          <IconComponent className="w-4 h-4 mr-2" />
          Setup Explorer
        </Button>
      </Link>
    );
  }

  if (options.length === 1) {
    const opt = options[0];
    return (
      <ExplorerOptionLink option={opt}>
        <Button variant="outline" size="sm">
          <IconComponent className="w-4 h-4 mr-2" />
          Open Explorer
        </Button>
      </ExplorerOptionLink>
    );
  }

  return (
    // `modal={false}` disables Radix's body scroll lock + scrollbar-gutter
    // adjustment. With the default (modal=true), opening the menu hides
    // the body scrollbar and adds a `padding-right` to compensate, which
    // ends up painting a second scrollbar on whichever ancestor inherits
    // the scrollable overflow. The Explorer dropdown is just an action
    // picker, not a critical dialog — non-modal is correct here, and
    // matches Radix's recommendation for menu/popover-style triggers.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <IconComponent className="w-4 h-4 mr-2" />
          Open Explorer
          <ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.id} asChild>
            <ExplorerOptionLink option={opt} className="flex items-start gap-2 cursor-pointer">
              {opt.internal ? (
                <Compass className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground truncate">{opt.description}</div>
              </div>
            </ExplorerOptionLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Internal-vs-external link wrapper. Internal options use Next's <Link> so
// the in-app /explorer route gets client-side routing (no page reload);
// external explorers open in a new tab so the dashboard stays put.
function ExplorerOptionLink({
  option,
  className,
  children,
}: {
  option: ExplorerOption;
  className?: string;
  children: React.ReactNode;
}) {
  if (option.internal) {
    return (
      <Link href={option.url} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={option.url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
