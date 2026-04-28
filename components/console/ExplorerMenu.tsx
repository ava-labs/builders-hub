'use client';

import Link from 'next/link';
import { BarChart3, ChevronDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getExplorerOptions } from '@/lib/explorers';

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
 * Three-way explorer picker for an L1. Mirrors the UX from PR #4093's
 * transaction explorer dropdown, applied at the chain level instead of
 * per-tx.
 *
 * Render rules (least → most options available):
 *  - 0: a "Setup Explorer" link to /console/layer-1/explorer-setup so the
 *       user can deploy one for their managed L1.
 *  - 1: a single "Open Explorer" button (no menu) — keeps simple chains
 *       from getting a chevron they don't need.
 *  - 2-3: a dropdown with every option, descriptions inline so the user
 *       can tell Subnets vs Snowtrace vs custom at a glance.
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
      <a href={opt.url} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm">
          <IconComponent className="w-4 h-4 mr-2" />
          Open Explorer
        </Button>
      </a>
    );
  }

  return (
    <DropdownMenu>
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
            <a
              href={opt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {opt.description}
                </div>
              </div>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
