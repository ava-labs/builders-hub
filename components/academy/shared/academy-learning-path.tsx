import LearningTree from '@/components/academy/learning-tree';
import type { CourseStats } from '@/lib/academy/course-outline';
import { AcademyLandingHeader } from './academy-landing-header';
import type { AcademyPathType } from './academy-types';

interface AcademyLearningPathProps {
    pathType: AcademyPathType;
    courseStats: Record<string, CourseStats>;
}

export function AcademyLearningPath({ pathType, courseStats }: AcademyLearningPathProps) {
    return (
        <div id="learning-path-section" className="mb-14 scroll-mt-20">
            <AcademyLandingHeader pathType={pathType} />

            <div className="relative">
                <LearningTree pathType={pathType} courseStats={courseStats} />
            </div>
        </div>
    );
}
