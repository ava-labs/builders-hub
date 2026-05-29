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
  // web3.career's API ToS requires a do-follow backlink for the roles it
  // supplies (source 'external'); every other source stays nofollow so we
  // don't pass link equity to arbitrary apply URLs.
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
