'use client';

import { HeroBackground } from '@/components/landing/hero';
import { AcademyLearningPath } from './academy-learning-path';
import { AcademyBubbleNav } from './academy-bubble-nav';
import type { AcademyLandingPageConfig, AcademyPathType } from './academy-types';
import type { ReactNode } from 'react';

interface AcademyLayoutProps {
    config: AcademyLandingPageConfig;
    children?: ReactNode;
    afterLearningPath?: ReactNode;
}

export function AcademyLayout({
    config,
    children,
    afterLearningPath,
}: AcademyLayoutProps) {
    const pathType: AcademyPathType = config.pathType;

    return (
        <>
            <HeroBackground />
            <main className="relative pt-8 w-full">
                <div className="pb-32 sm:pb-36">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        {children}

                        <AcademyLearningPath pathType={pathType} />

                        {afterLearningPath}
                    </div>
                </div>
            </main>
            <AcademyBubbleNav />
        </>
    );
}
