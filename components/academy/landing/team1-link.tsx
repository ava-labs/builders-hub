'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { hasTeam1AcademyAccess } from '@/lib/auth/roles';
import { cn } from '@/utils/cn';
import { FOCUS_RING } from './course-marks';

/**
 * The Team1 line, for team1 tags and devrel only (lib/auth/roles.ts:97-104): under the newcomer line in J, at the
 * end of the hero row in the tree and stages views. It takes the newcomer line's type and underlined link; the caller
 * places it. Nothing renders before the session loads or for anyone without access, so nothing shifts for them. The
 * Team1 pages gate on the server (app/(home)/academy/team1/page.tsx:41-49); this line only mirrors the gate.
 */
export function Team1Line({ className }: { className?: string }) {
  const { data: session } = useSession();
  if (!hasTeam1AcademyAccess(session?.user?.custom_attributes)) return null;
  return (
    <p className={cn('text-[13.5px] text-ac-ink-3', className)}>
      {'Team1 member? '}
      <Link href="/academy/team1" className={cn('border-b border-ac-rule-2 text-ac-ink-2 hover:border-ac-ink hover:text-ac-ink', FOCUS_RING)}>
        Open the Team1 Academy
      </Link>
    </p>
  );
}
