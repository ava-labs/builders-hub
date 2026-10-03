import type { CourseNode } from '@/components/academy/learning-tree';
import { team1LearningPaths } from '@/components/academy/learning-path-configs/team1.config';
import type { AcademyPathType } from './academy-types';

export interface AcademyTrack {
    id: AcademyPathType;
    /** The url segment, also the course outline's track key. */
    segment: string;
    label: string;
    href: string;
    courses: readonly CourseNode[];
}

/** The Team1 track, the one track left with its own landing: Avalanche L1 and Blockchain merged into /academy. */
export const ACADEMY_TRACKS: readonly AcademyTrack[] = [
    { id: 'team1', segment: 'team1', label: 'Team1', href: '/academy/team1', courses: team1LearningPaths },
];

export function getAcademyTrack(id: AcademyPathType): AcademyTrack {
    const track = ACADEMY_TRACKS.find((candidate) => candidate.id === id);
    if (!track) throw new Error(`Unknown academy track: ${id}`);
    return track;
}

/** A course's landing url, resolved as the learning tree always has. */
export function courseUrl(pathType: AcademyPathType, slug: string): string {
    return `/academy/${slug}`;
}

/** Courses in mobileOrder, ties in config order; a new array, the config stays as it is. */
export function coursesInOrder(courses: readonly CourseNode[]): CourseNode[] {
    return [...courses].sort((a, b) => (a.mobileOrder || 0) - (b.mobileOrder || 0));
}

/** Course numbers on the learning tree's cards and stage numbers in the stage columns: "01", "09", "12". */
export function twoDigits(value: number): string {
    return String(value).padStart(2, '0');
}
