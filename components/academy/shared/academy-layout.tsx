import type { ReactNode } from 'react';
import '@/components/academy/theme/academy-tokens.css';
import type { CourseStats } from '@/lib/academy/course-outline';
import { AcademyLearningPath } from './academy-learning-path';
import type { AcademyLandingPageConfig } from './academy-types';

interface AcademyLayoutProps {
    config: AcademyLandingPageConfig;
    /** Lessons and modules per course url, from the page tree: the track page reads them from lib/academy/course-stats.generated.ts. */
    courseStats: Record<string, CourseStats>;
    afterLearningPath?: ReactNode;
}

export function AcademyLayout({ config, courseStats, afterLearningPath }: AcademyLayoutProps) {
    return (
        <main className="relative w-full" data-academy="landing">
            {/* The hub's ground; HeroBackground stays on the other pages that use it. */}
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-ac-ground" />
            <div className="pb-32 sm:pb-36">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <AcademyLearningPath pathType={config.pathType} courseStats={courseStats} />

                    {afterLearningPath}
                </div>
            </div>
        </main>
    );
}
