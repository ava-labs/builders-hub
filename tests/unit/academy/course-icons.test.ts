import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACADEMY_COURSES } from '@/components/academy/learning-path-configs/academy.config';
import { COURSE_ICONS } from '@/components/academy/course/course-icons';

// The Lucide name a course folder gives its icon, which lib/source.ts resolves for fumadocs.
const folderIcon = (slug: string): string =>
  JSON.parse(readFileSync(path.join(process.cwd(), 'content/academy', slug, 'meta.json'), 'utf8')).icon;

describe('COURSE_ICONS', () => {
  it.each(ACADEMY_COURSES.map((course) => [course.id, course.slug]))(
    "gives %s the icon its folder's meta.json names (content/academy/%s)",
    (id, slug) => {
      // lucide-react names each icon component after its Lucide name (createLucideIcon sets the displayName).
      expect(COURSE_ICONS[id]?.displayName).toBe(folderIcon(slug));
    },
  );

  it('maps the 13 courses and nothing else', () => {
    expect(Object.keys(COURSE_ICONS).sort()).toEqual(ACADEMY_COURSES.map((course) => course.id).sort());
  });
});
