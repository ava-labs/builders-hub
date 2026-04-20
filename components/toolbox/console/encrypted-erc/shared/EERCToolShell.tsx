'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, GraduationCap } from 'lucide-react';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';
import { EERC_COMMIT } from '@/lib/eerc/contractSources';

interface FooterLink {
  label: string;
  href: string;
  /** Uses <Link> for internal /console or /academy/..., <a target="_blank"> for external. */
  internal?: boolean;
  icon?: React.ReactNode;
}

interface EERCToolShellProps {
  /** Solidity sources rendered in the right pane (syntax-highlighted via Shiki). */
  contracts: ContractSource[];
  /** Left-pane body. Should be tall enough to fill the height — use scroll below 540px. */
  children: React.ReactNode;
  /** Extra footer pills to link related docs / source files. Commit badge is always rendered. */
  footerLinks?: FooterLink[];
  /** Override the fixed content height. Defaults to 540px to match the Deploy wizard steps. */
  height?: number;
}

/**
 * Standard shell for any Encrypted ERC tool that reads from or writes to a
 * contract. Mirrors the DeployValidatorManager pattern exactly so tools feel
 * cohesive with the rest of the console.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  scrollable left pane (your `children`)      │  right pane:
 *   │                                              │  syntax-highlighted
 *   │                                              │  Solidity source,
 *   │                                              │  tabs per contract
 *   │                                              │
 *   ├──────────────────────────────────────────────┤
 *   │ [Academy] [source 1] [source 2]    @commit7  │  footer strip
 *   └──────────────────────────────────────────────┘
 */
export function EERCToolShell({ contracts, children, footerLinks, height = 540 }: EERCToolShellProps) {
  const defaultAcademyLink: FooterLink = {
    label: 'Academy',
    href: '/academy/encrypted-erc',
    internal: true,
    icon: <GraduationCap className="w-3.5 h-3.5" />,
  };
  const links = [defaultAcademyLink, ...(footerLinks ?? [])];

  return (
    <ContractDeployViewer contracts={contracts}>
      <div
        className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
        style={{ height }}
      >
        <div className="flex-1 overflow-auto p-5 space-y-4">{children}</div>

        <div className="shrink-0 px-5 py-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {links.map((l) =>
                l.internal ? (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {l.icon ?? <BookOpen className="w-3.5 h-3.5" />}
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {l.icon ?? <BookOpen className="w-3.5 h-3.5" />}
                    {l.label}
                  </a>
                ),
              )}
            </div>
            <a
              href={`https://github.com/ava-labs/EncryptedERC/tree/${EERC_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors whitespace-nowrap"
            >
              @{EERC_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </div>
    </ContractDeployViewer>
  );
}
