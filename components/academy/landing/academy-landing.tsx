import '@/components/academy/theme/academy-tokens.css';
import { ACADEMY_COURSES } from '@/components/academy/learning-path-configs/academy.config';
import { getCourseDurations } from '@/content/courses';
import { groupFacts, programmeLine } from '@/lib/academy/academy-programme';
import type { AcademyView, LandingViewProps } from './academy-views';
import { LandingHero } from './landing-hero';
import { QuickAccess } from './quick-access';
import { SpotlightView } from './spotlight-view';
import { StagesView } from './stages-view';
import { TreeView } from './tree-view';

interface AcademyLandingProps extends LandingViewProps {
  view: AcademyView;
}

function LandingView({ view, courseStats }: AcademyLandingProps) {
  if (view === 'tree') return <TreeView courseStats={courseStats} />;
  if (view === 'stages') return <StagesView courseStats={courseStats} />;
  return <SpotlightView courseStats={courseStats} />;
}

/**
 * The single Academy landing (FDE-155): hero, one of the three views, Quick Access. The root and the ground layer
 * are the track landing's (components/academy/shared/academy-layout.tsx:16-18).
 */
export function AcademyLanding({ view, courseStats }: AcademyLandingProps) {
  const facts = programmeLine(groupFacts(ACADEMY_COURSES, courseStats, getCourseDurations()));
  return (
    <main className="relative w-full" data-academy="landing">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-ac-ground" />
      <div className="mx-auto max-w-7xl px-6 pb-32 sm:pb-36 lg:px-8">
        <LandingHero view={view} facts={facts} />
        <div className={view === 'overview' ? 'pt-1' : 'pt-[22px]'}>
          <LandingView view={view} courseStats={courseStats} />
        </div>
        <QuickAccess />
      </div>
    </main>
  );
}
