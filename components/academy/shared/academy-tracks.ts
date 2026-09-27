import type { CourseNode } from '@/components/academy/learning-tree';
import { avalancheLearningPaths } from '@/components/academy/learning-path-configs/avalanche.config';
import { blockchainLearningPaths } from '@/components/academy/learning-path-configs/blockchain.config';
import { entrepreneurLearningPaths } from '@/components/academy/learning-path-configs/entrepreneur.config';
import { team1LearningPaths } from '@/components/academy/learning-path-configs/team1.config';
import { hasTeam1AcademyAccess } from '@/lib/auth/roles';
import type { AcademyPathType } from './academy-types';

export interface AcademyTrack {
    id: AcademyPathType;
    /** The url segment, also the course outline's track key (index C5). */
    segment: string;
    label: string;
    href: string;
    courses: readonly CourseNode[];
}

/** The four tracks, in the order of the track rail the tabs replace. */
export const ACADEMY_TRACKS: readonly AcademyTrack[] = [
    { id: 'avalanche', segment: 'avalanche-l1', label: 'Avalanche L1', href: '/academy/avalanche-l1', courses: avalancheLearningPaths },
    { id: 'blockchain', segment: 'blockchain', label: 'Blockchain', href: '/academy/blockchain', courses: blockchainLearningPaths },
    { id: 'entrepreneur', segment: 'entrepreneur', label: 'Entrepreneur', href: '/academy/entrepreneur', courses: entrepreneurLearningPaths },
    { id: 'team1', segment: 'team1', label: 'Team1', href: '/academy/team1', courses: team1LearningPaths },
];

export function getAcademyTrack(id: AcademyPathType): AcademyTrack {
    const track = ACADEMY_TRACKS.find((candidate) => candidate.id === id);
    if (!track) throw new Error(`Unknown academy track: ${id}`);
    return track;
}

/**
 * Team1 shows for team1 tags and devrel (lib/auth/roles.ts), and always on the Team1 landing,
 * which the server already gates (app/(home)/academy/team1/page.tsx), so the tab is there at first paint.
 */
export function visibleAcademyTracks(
    customAttributes: readonly string[] | null | undefined,
    active: AcademyPathType,
): readonly AcademyTrack[] {
    // With active 'team1' the Team1 tab always shows: the Team1 landing's server gate enforces access, the tab only mirrors it.
    if (active === 'team1' || hasTeam1AcademyAccess(customAttributes)) return ACADEMY_TRACKS;
    return ACADEMY_TRACKS.filter((track) => track.id !== 'team1');
}

/** A course's landing url, resolved as the learning tree always has (index C8). */
export function courseUrl(pathType: AcademyPathType, slug: string): string {
    if (pathType === 'entrepreneur') return `/academy/entrepreneur/${slug.replace(/^entrepreneur\//, '')}`;
    return `/academy/${slug}`;
}

/** Courses in mobileOrder, ties in config order; a new array, the config stays as it is. */
export function coursesInOrder(courses: readonly CourseNode[]): CourseNode[] {
    return [...courses].sort((a, b) => (a.mobileOrder || 0) - (b.mobileOrder || 0));
}

/** Card numbers, tab counts and shortcut numbers: "01", "09", "12". */
export function twoDigits(value: number): string {
    return String(value).padStart(2, '0');
}
