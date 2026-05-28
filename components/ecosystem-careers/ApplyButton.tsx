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
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
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
