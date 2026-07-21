'use client';

import Link from 'next/link';
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

export function JobCardLink({
  href,
  className,
  listingId,
  listingSource,
  companyName,
  children,
}: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        posthog?.capture?.('careers_listing_opened', {
          listing_id: listingId,
          listing_source: listingSource,
          company_name: companyName,
        });
      }}
    >
      {children}
    </Link>
  );
}
