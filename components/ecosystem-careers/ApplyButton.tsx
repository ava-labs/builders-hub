'use client';

import posthog from 'posthog-js';
import type { ReactNode } from 'react';
import type { ListingSource } from '@/server/services/ecosystemCareers/queries';

interface Props {
  href: string;
  className: string;
  listingId: string;
  listingSource: ListingSource;
  companyName: string;
  children: ReactNode;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

export function ApplyButton({
  href,
  className,
  listingId,
  listingSource,
  companyName,
  children,
}: Props) {
  // web3.career's API ToS requires the apply link to be a follow link
  // (no rel="nofollow") — failing to do so gets API access suspended. So
  // web3.career-sourced roles (source 'external') omit nofollow. Every other
  // source keeps nofollow; we don't vouch for arbitrary employer portals.
  const rel =
    listingSource === 'external'
      ? 'noopener noreferrer'
      : 'noopener noreferrer nofollow';
  return (
    <a
      href={href}
      target="_blank"
      rel={rel}
      className={className}
      onClick={() => {
        posthog?.capture?.('careers_apply_clicked', {
          listing_id: listingId,
          listing_source: listingSource,
          company_name: companyName,
          apply_url_host: safeHost(href),
        });
      }}
    >
      {children}
    </a>
  );
}
