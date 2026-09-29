import type { LucideIcon } from 'lucide-react';
import { avalancheCategoryStyles, avalancheLearningPaths } from '@/components/academy/learning-path-configs/avalanche.config';
import { blockchainCategoryStyles, blockchainLearningPaths } from '@/components/academy/learning-path-configs/blockchain.config';
import { team1CategoryStyles, team1LearningPaths } from '@/components/academy/learning-path-configs/team1.config';
import { disciplineHue, type DisciplineHue } from '@/lib/academy/discipline';

export interface CourseDiscipline {
  label: string;
  Icon: LucideIcon;
  hue: DisciplineHue | null;
}

interface CategoryStyle { gradient: string; icon: LucideIcon; label: string }
interface TrackConfig { nodes: { slug: string; category: string }[]; styles: Record<string, CategoryStyle> }

// The discipline of a course lives only in the track configs; the category in content/courses.tsx
// is a different taxonomy.
const TRACKS: Record<string, TrackConfig> = {
  'avalanche-l1': { nodes: avalancheLearningPaths, styles: avalancheCategoryStyles },
  blockchain: { nodes: blockchainLearningPaths, styles: blockchainCategoryStyles },
  team1: { nodes: team1LearningPaths, styles: team1CategoryStyles },
};

/** The discipline label, icon and hue of a course, from its track config; null when the config does not list it. */
export function courseDiscipline(track: string, slug: string): CourseDiscipline | null {
  const config = TRACKS[track];
  const node = config?.nodes.find((n) => n.slug === `${track}/${slug}`);
  const style = node ? config.styles[node.category] : undefined;
  return style ? { label: style.label, Icon: style.icon, hue: disciplineHue(style.gradient) } : null;
}
