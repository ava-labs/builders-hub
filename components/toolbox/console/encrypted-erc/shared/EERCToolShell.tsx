'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, GraduationCap } from 'lucide-react';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';
import { EERC_COMMIT } from '@/lib/eerc/contractSources';
import { EERCStepNav } from './EERCStepNav';
import { EERCKeyframes } from './EERCKeyframes';

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
  /** Extra footer links to related docs / source files. Commit link is always rendered. */
  footerLinks?: FooterLink[];
  /** Override the fixed content height. Defaults to 540px to match the Deploy wizard steps. */
  height?: number;
  /** Academy page for the first footer link. */
  academyHref?: string;
  /** Render the Encrypted ERC tool tabs above the panes. */
  showNav?: boolean;
}

const FOOTER_LINK =
  'group/foot inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-50';

/**
 * Standard shell for any Encrypted ERC tool that reads from or writes to a
 * contract: the tool tabs, then the controls on the left and the Solidity
 * source on the right, with a footer of docs links and the pinned commit.
 */
export function EERCToolShell({
  contracts,
  children,
  footerLinks,
  height = 540,
  academyHref = '/academy/encrypted-erc',
  showNav = true,
}: EERCToolShellProps) {
  const links: FooterLink[] = [
    { label: 'Academy', href: academyHref, internal: true, icon: <GraduationCap className="h-3 w-3" /> },
    ...(footerLinks ?? []),
  ];

  return (
    <>
      <EERCKeyframes />
      {showNav && <EERCStepNav />}
      <ContractDeployViewer contracts={contracts}>
        <div
          className="flex flex-col overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          style={{ height }}
        >
          <div className="flex flex-1 flex-col gap-5 overflow-auto p-5">{children}</div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {links.map((l) =>
                l.internal ? (
                  <Link key={l.href} href={l.href} className={FOOTER_LINK}>
                    <span className="[&_svg]:h-3 [&_svg]:w-3">{l.icon ?? <BookOpen />}</span>
                    {l.label}
                  </Link>
                ) : (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
                    <span className="[&_svg]:h-3 [&_svg]:w-3">{l.icon ?? <BookOpen />}</span>
                    {l.label}
                    <ArrowUpRight className="h-3 w-3 text-zinc-400 transition-colors group-hover/foot:text-[#E6212F]" />
                  </a>
                ),
              )}
            </div>
            <a
              href={`https://github.com/ava-labs/EncryptedERC/tree/${EERC_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Pinned EncryptedERC commit"
              className="whitespace-nowrap font-mono text-[11px] text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              @{EERC_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </ContractDeployViewer>
    </>
  );
}
