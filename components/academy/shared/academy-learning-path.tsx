'use client';

import { useState } from 'react';
import LearningTree, { LearningTreeLegend } from '@/components/academy/learning-tree';
import type { AcademyPathType } from './academy-types';

interface AcademyLearningPathProps {
    pathType: AcademyPathType;
}

export function AcademyLearningPath({ pathType }: AcademyLearningPathProps) {
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

    const description = pathType === 'avalanche'
        ? 'Learn about Avalanche infrastructure, how it works and how to deploy L1s and cross-chain bridges'
        : pathType === 'blockchain'
        ? 'Master blockchain basics and smart contracts'
        : 'Build your foundation, scale your venture';

    return (
        <div id="learning-path-section" className="mb-20 scroll-mt-20">
            <div className="text-center mb-10">
                <h1 className="text-5xl sm:text-6xl font-bold mb-4">
                    <span className="text-red-600">
                        {pathType === 'avalanche' ? 'Avalanche L1' : pathType === 'blockchain' ? 'Blockchain' : 'Entrepreneur'}
                    </span>{' '}
                    <span className="text-zinc-900 dark:text-white">Academy</span>
                </h1>

                {/* Description between title and topics */}
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
                    {description}
                </p>

                {/* Category legend under description */}
                <div>
                    {/* Desktop legend */}
                    <div className="hidden sm:block">
                        <LearningTreeLegend 
                            pathType={pathType} 
                            isMobile={false} 
                            activeCategory={hoveredCategory}
                            onCategoryHover={setHoveredCategory}
                        />
                    </div>
                    {/* Mobile legend */}
                    <div className="block sm:hidden">
                        <LearningTreeLegend 
                            pathType={pathType} 
                            isMobile={true}
                            activeCategory={hoveredCategory}
                            onCategoryHover={setHoveredCategory}
                        />
                    </div>
                </div>
            </div>

            {/* Background decoration */}
            <div className="relative">
                <div className="absolute inset-0 -top-20 bg-gradient-to-b from-transparent via-zinc-50/20 to-transparent dark:via-zinc-950/10 pointer-events-none" />
                <LearningTree 
                    pathType={pathType}
                    externalHoveredCategory={hoveredCategory}
                    onCategoryHover={setHoveredCategory}
                />
            </div>
        </div>
    );
}
