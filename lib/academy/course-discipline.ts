import { AppWindow, ArrowLeftRight, BookOpen, Code, Layers, type LucideIcon } from 'lucide-react';
import type { AcademyPartId } from '@/components/academy/learning-path-configs/academy.config';
import { team1CategoryStyles, team1LearningPaths } from '@/components/academy/learning-path-configs/team1.config';
import { academyCourseBySlug, academyPart } from '@/lib/academy/academy-programme';
import { disciplineHue, type DisciplineHue } from '@/lib/academy/discipline';

export interface CourseDiscipline {
  label: string;
  Icon: LucideIcon;
  hue: DisciplineHue | null;
}

interface CategoryStyle { gradient: string; icon: LucideIcon; label: string }

// The overview tile's icon per part: the parts carry none (academy.config.ts).
const PART_ICONS: Record<AcademyPartId, LucideIcon> = {
  fundamentals: BookOpen,
  'l1-development': Layers,
  interoperability: ArrowLeftRight,
  'vm-customization': Code,
  applications: AppWindow,
};

const TEAM1_STYLES: Record<string, CategoryStyle> = team1CategoryStyles;

/**
 * The discipline of a course: its part for the 13 courses of the single landing (academy.config.ts), its category
 * for a Team1 course (team1.config.ts); null when neither lists it. The category in content/courses.tsx is a
 * different taxonomy.
 */
export function courseDiscipline(track: string, slug: string): CourseDiscipline | null {
  if (track === 'team1') {
    const node = team1LearningPaths.find((n) => n.slug === `team1/${slug}`);
    const style = node ? TEAM1_STYLES[node.category] : undefined;
    return style ? { label: style.label, Icon: style.icon, hue: disciplineHue(style.gradient) } : null;
  }
  const course = academyCourseBySlug(`${track}/${slug}`);
  if (!course) return null;
  const part = academyPart(course.part);
  return { label: part.name, Icon: PART_ICONS[part.id], hue: part.hue };
}
