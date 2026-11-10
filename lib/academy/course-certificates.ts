import { ACADEMY_COURSES, type AcademyCourse } from '@/components/academy/learning-path-configs/academy.config';
import { courseFolder } from '@/lib/academy/academy-programme';

/*
 * The certificates of the Academy courses, as badge requirements and getCompletedCourseSlugs name them: the course
 * folder ("solidity-foundry" for Intro to Solidity), or the two halves of Access Restriction. A course is complete when
 * the user has all of its certificates. Pure, so the profile's server and client parts share it.
 */

const SPLIT_CERTIFICATES: Readonly<Record<string, readonly string[]>> = {
  'access-restriction': ['access-restriction-fundamentals', 'access-restriction-advanced'],
};

/** The certificate slugs of a course. */
export function certificatesOf(course: AcademyCourse): readonly string[] {
  return SPLIT_CERTIFICATES[course.id] ?? [courseFolder(course)];
}

const BY_SLUG: ReadonlyMap<string, AcademyCourse> = new Map(
  ACADEMY_COURSES.flatMap((course) => [course.id, ...certificatesOf(course)].map((slug) => [slug, course] as const)),
);

/** The course a requirement's course_id names (the course id, its folder or a certificate half); null outside the 13. */
export function courseOfCertificate(slug: string | undefined): AcademyCourse | null {
  return (slug && BY_SLUG.get(slug)) || null;
}
