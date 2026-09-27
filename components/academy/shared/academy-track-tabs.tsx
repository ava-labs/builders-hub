'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { cn } from '@/utils/cn';
import { twoDigits, visibleAcademyTracks } from './academy-tracks';
import type { AcademyPathType } from './academy-types';

interface AcademyTrackTabsProps {
    active: AcademyPathType;
}

/**
 * The tab row under the landing header: each track with its course count, the active one on the red rule.
 * A div with the navigation role, not a nav element: app/global.css pads and recolours every `nav a`
 * with !important, which would move the tabs off the approved layout.
 * Below 768 px the row scrolls sideways only: with overflow-y left to auto, the tabs' -1 px margin over the
 * row's rule would give it a 1 px vertical scroll.
 * Keyboard focus draws a 2 px ink ring outside the tab, and inside it below 768 px, where the scrolling row
 * clips; 3 px in there, because the row also clips the tab's lowest pixel, which overlaps its rule.
 */
export function AcademyTrackTabs({ active }: AcademyTrackTabsProps) {
    const { data: session } = useSession();
    const tracks = visibleAcademyTracks(session?.user?.custom_attributes, active);

    return (
        <div
            role="navigation"
            aria-label="Academy tracks"
            className="mt-[30px] flex gap-7 border-b border-ac-rule max-md:gap-[22px] max-md:overflow-x-auto max-md:overflow-y-hidden"
        >
            {tracks.map((track) => {
                const isActive = track.id === active;
                return (
                    <Link
                        key={track.id}
                        href={track.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-[15px] font-medium',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink max-md:focus-visible:-outline-offset-3',
                            isActive ? 'border-ac-red text-ac-ink' : 'border-transparent text-ac-ink-3 hover:text-ac-ink',
                        )}
                    >
                        {track.label}
                        <span
                            className={cn(
                                'rounded-full bg-ac-tile px-[7px] py-[3px] font-ac-mono text-[11px] leading-none',
                                isActive ? 'text-ac-ink' : 'text-ac-ink-2',
                            )}
                        >
                            {twoDigits(track.courses.length)}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}
