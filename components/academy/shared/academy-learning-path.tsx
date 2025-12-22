'use client';

import { useState, useEffect } from 'react';
import LearningTree, { LearningTreeLegend } from '@/components/academy/learning-tree';
import { AcademyShortcutSection } from './academy-shortcut-section';
import type { AcademyPathType } from './academy-types';

// Typewriter effect component
function TypewriterText({ text, speed = 30 }: { text: string; speed?: number }) {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        // Reset when text changes
        setDisplayedText('');
        setCurrentIndex(0);
    }, [text]);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, speed);
            return () => clearTimeout(timeout);
        }
    }, [currentIndex, text, speed]);

    return (
        <span>
            {displayedText}
            {currentIndex < text.length && (
                <span className="inline-block w-0.5 h-5 bg-zinc-400 dark:bg-zinc-500 ml-0.5 animate-pulse" />
            )}
        </span>
    );
}

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
                {/* Description with typewriter effect */}
                <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
                    <TypewriterText text={description} speed={25} />
                </p>

                {/* Category legend */}
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

            {/* Shortcut section for Avalanche and Blockchain academies */}
            {(pathType === 'avalanche' || pathType === 'blockchain') && (
                <div className="mt-16">
                    <AcademyShortcutSection pathType={pathType} />
                </div>
            )}
        </div>
    );
}
