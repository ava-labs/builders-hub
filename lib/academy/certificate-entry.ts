import { getCourseConfig } from '@/content/courses';
import type { CourseOutline } from '@/lib/academy/course-outline';

/**
 * The content/courses.tsx entry a certificate page issues: the course slug, or "<slug>-<part>" for a
 * course with several certificates (access-restriction/certificate-fundamentals issues
 * access-restriction-fundamentals). It equals the page's <CertificatePage courseId>.
 */
export function certificateEntryId(courseSlug: string, certificateUrl: string): string {
  const part = /\/certificate-([a-z0-9-]+)$/.exec(certificateUrl)?.[1];
  return part ? `${courseSlug}-${part}` : courseSlug;
}

/** The course name the certificate PDF prints (the entry's name in content/courses.tsx); null without a certificate entry. */
export function certificateCourseName(outline: CourseOutline): string | null {
  if (!outline.certificateUrl) return null;
  return getCourseConfig()[certificateEntryId(outline.slug, outline.certificateUrl)]?.name ?? null;
}
