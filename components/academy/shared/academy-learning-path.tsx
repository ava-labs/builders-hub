"use client";

import { useState, useEffect } from 'react';
import LearningTree from '@/components/academy/learning-tree';
import { cn } from '@/utils/cn';

interface AcademyLearningPathProps {
    defaultPathType: 'avalanche' | 'entrepreneur';
    showToggle?: boolean;
}

const ACADEMY_PATH_KEY = 'academy-selected-path';

export function AcademyLearningPath({ defaultPathType, showToggle = true }: AcademyLearningPathProps) {
    const [pathType, setPathType] = useState<'avalanche' | 'entrepreneur'>(defaultPathType);

    // Load saved preference on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedPath = localStorage.getItem(ACADEMY_PATH_KEY) as 'avalanche' | 'entrepreneur' | null;
            if (savedPath && (savedPath === 'avalanche' || savedPath === 'entrepreneur')) {
                setPathType(savedPath);
            }
        }
    }, []);

    // Save preference when it changes
    const handlePathChange = (newPath: 'avalanche' | 'entrepreneur') => {
        setPathType(newPath);
        if (typeof window !== 'undefined') {
            localStorage.setItem(ACADEMY_PATH_KEY, newPath);
        }
    };

    return (
        <div className="mb-20">
            <div className="text-center mb-12">
                {showToggle && (
                    <div className="flex justify-center mb-6">
                        <div className="inline-flex items-center gap-0 p-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg">
                            <button
                                onClick={() => handlePathChange('avalanche')}
                                className={cn(
                                    "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                    pathType === 'avalanche'
                                        ? "bg-red-500 text-white shadow-sm"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                                )}
                            >
                                Developer
                            </button>
                            <button
                                onClick={() => handlePathChange('entrepreneur')}
                                className={cn(
                                    "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                    pathType === 'entrepreneur'
                                        ? "bg-red-500 text-white shadow-sm"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                                )}
                            >
                                Entrepreneur
                            </button>
                        </div>
                    </div>
                )}

                <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-8">
                    Learning Paths for{" "}
                    {pathType === 'avalanche' ? (
                        <>
                            Avalanche 
                            <span className="text-red-600"> Developer </span>
                            Academy
                        </>
                    ) : (
                        <>Codebase 
                        <span className="text-red-600"> Entrepreneur </span>
                        Academy</>
                    )}
                </h2>

                {/* Visual hint */}
                <div className="flex items-center justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                    <div className="h-px w-16 bg-gradient-to-r from-transparent to-zinc-300 dark:to-zinc-700" />
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        {pathType === 'avalanche'
                            ? 'Start with fundamentals, progress to advanced'
                            : 'Build your foundation, scale your venture'
                        }
                    </span>
                    <div className="h-px w-16 bg-gradient-to-l from-transparent to-zinc-300 dark:to-zinc-700" />
                </div>
            </div>

            {/* Background decoration */}
            <div className="relative">
                <div className="absolute inset-0 -top-20 bg-gradient-to-b from-transparent via-zinc-50/20 to-transparent dark:via-zinc-950/10 pointer-events-none" />
                <LearningTree pathType={pathType} />
            </div>
        </div>
    );
}
