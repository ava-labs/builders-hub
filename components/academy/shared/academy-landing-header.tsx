import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AcademyTrackTabs } from './academy-track-tabs';
import { coursesInOrder, courseUrl, getAcademyTrack } from './academy-tracks';
import type { AcademyPathType } from './academy-types';

/** Each track's title and the line under it: the landing's existing copy, now static. */
const TRACK_HEADINGS: Record<AcademyPathType, { title: string; line: string }> = {
    avalanche: { title: 'Avalanche L1 Learning Tree', line: 'Deploy L1s, bridge tokens, run and customize your own infrastructure' },
    blockchain: { title: 'Blockchain Learning Tree', line: 'Master Solidity and deploy smart contracts' },
    entrepreneur: { title: 'Entrepreneur Learning Tree', line: 'Build your foundation, scale your Web3 venture' },
    team1: { title: 'Team1 Learning Tree', line: 'From fundamentals to advanced technical leadership and event organizing' },
};

interface AcademyLandingHeaderProps {
    pathType: AcademyPathType;
}

/** The landing header: title, line, the button to card 01's course, then the track tabs. */
export function AcademyLandingHeader({ pathType }: AcademyLandingHeaderProps) {
    const heading = TRACK_HEADINGS[pathType];
    const [firstCourse] = coursesInOrder(getAcademyTrack(pathType).courses);

    return (
        <div className="mb-6 pt-7 max-md:pt-[26px]">
            <h1 className="font-ac-display text-[44px] font-medium leading-[1.05] tracking-[-0.022em] text-ac-ink max-md:text-[34px]">
                {heading.title}
            </h1>
            <p className="mt-3 max-w-[52ch] text-[17px] leading-[1.55] text-ac-ink-2 max-md:text-[16px]">{heading.line}</p>
            {firstCourse ? (
                <div className="mt-[22px] flex flex-wrap items-center gap-x-5 gap-y-3 max-md:mt-5">
                    <Link
                        href={courseUrl(pathType, firstCourse.slug)}
                        className="inline-flex items-center gap-2 rounded-lg bg-ac-ink py-3 pl-[18px] pr-4 text-[14.5px] font-medium leading-none text-ac-paper hover:bg-ac-paper hover:text-ac-ink hover:inset-ring hover:inset-ring-ac-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink"
                    >
                        {`Start with ${firstCourse.name}`}
                        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                    </Link>
                </div>
            ) : null}
            <AcademyTrackTabs active={pathType} />
        </div>
    );
}
