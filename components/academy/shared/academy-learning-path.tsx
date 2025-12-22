'use client';

import { useState, useEffect, useMemo } from 'react';
import LearningTree, { LearningTreeLegend } from '@/components/academy/learning-tree';
import { AcademyShortcutSection } from './academy-shortcut-section';
import type { AcademyPathType } from './academy-types';

// Segment types for rich typewriter text
interface TextSegment {
    text: string;
    isHighlight?: boolean;
    isCode?: boolean;
}

// Typewriter effect component with support for highlighted segments
function TypewriterText({ 
    segments, 
    speed = 30 
}: { 
    segments: TextSegment[]; 
    speed?: number;
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    
    // Flatten all text into a single string for typing
    const fullText = useMemo(() => 
        segments.map(s => s.text).join(''), 
        [segments]
    );

    useEffect(() => {
        // Reset when segments change
        setCurrentIndex(0);
    }, [segments]);

    useEffect(() => {
        if (currentIndex < fullText.length) {
            const timeout = setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
            }, speed);
            return () => clearTimeout(timeout);
        }
    }, [currentIndex, fullText, speed]);

    // Render segments with proper styling up to currentIndex
    const renderSegments = () => {
        let charCount = 0;
        const elements: React.ReactNode[] = [];

        segments.forEach((segment, segIndex) => {
            const segmentStart = charCount;
            const segmentEnd = charCount + segment.text.length;
            
            // How much of this segment should be shown
            const visibleChars = Math.max(0, Math.min(currentIndex - segmentStart, segment.text.length));
            const visibleText = segment.text.substring(0, visibleChars);
            
            if (visibleText) {
                if (segment.isHighlight) {
                    elements.push(
                        <span key={segIndex} className="text-red-500 font-semibold">
                            {visibleText}
                        </span>
                    );
                } else if (segment.isCode) {
                    elements.push(
                        <span key={segIndex} className="text-zinc-500 dark:text-zinc-500">
                            {visibleText}
                        </span>
                    );
                } else {
                    elements.push(
                        <span key={segIndex}>{visibleText}</span>
                    );
                }
            }
            
            charCount = segmentEnd;
        });

        return elements;
    };

    return (
        <span className="font-mono">
            {renderSegments()}
            {currentIndex < fullText.length && (
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

    const descriptionSegments: TextSegment[] = pathType === 'avalanche'
        ? [
            { text: '<', isCode: true },
            { text: 'Avalanche L1', isHighlight: true },
            { text: '> ', isCode: true },
            { text: 'Deploy L1s, bridge tokens, and build cross-chain apps' },
            { text: ' </', isCode: true },
            { text: 'Avalanche L1', isHighlight: true },
            { text: '>', isCode: true },
        ]
        : pathType === 'blockchain'
        ? [
            { text: '<', isCode: true },
            { text: 'Blockchain', isHighlight: true },
            { text: '> ', isCode: true },
            { text: 'Master Solidity and deploy smart contracts' },
            { text: ' </', isCode: true },
            { text: 'Blockchain', isHighlight: true },
            { text: '>', isCode: true },
        ]
        : [
            { text: '<', isCode: true },
            { text: 'Entrepreneur', isHighlight: true },
            { text: '> ', isCode: true },
            { text: 'Build your foundation, scale your Web3 venture' },
            { text: ' </', isCode: true },
            { text: 'Entrepreneur', isHighlight: true },
            { text: '>', isCode: true },
        ];

    return (
        <div id="learning-path-section" className="mb-20 scroll-mt-20">
            <div className="text-center mb-10">
                {/* Description with typewriter effect in code notation */}
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto mb-8 whitespace-nowrap">
                    <TypewriterText segments={descriptionSegments} speed={25} />
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
