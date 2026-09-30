'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { hasTeam1AcademyAccess } from '@/lib/auth/roles';
import { cn } from '@/utils/cn';
import { FOCUS_RING } from './course-marks';

/**
 * The Team1 track, for team1 tags and devrel only (lib/auth/roles.ts:97-104), at the end of the hero row. Nothing
 * renders before the session loads or for a visitor, so the row never shifts for them. The Team1 pages gate on the
 * server (app/(home)/academy/team1/page.tsx:41-49); this link only mirrors the gate.
 */
export function Team1Link() {
  const { data: session } = useSession();
  if (!hasTeam1AcademyAccess(session?.user?.custom_attributes)) return null;
  return (
    <Link
      href="/academy/team1"
      className={cn('ml-auto border-b border-ac-rule-2 pb-px text-[13px] font-medium text-ac-ink-2 hover:border-ac-ink hover:text-ac-ink max-md:ml-0', FOCUS_RING)}
    >
      Team1 track
    </Link>
  );
}
