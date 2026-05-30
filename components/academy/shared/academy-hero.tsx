'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';

interface AcademyHeroProps {
    title: string;
    accent: string;
    accentWords?: string[];
    description: string;
}

const DISPLAY_DURATION = 3500; // Show each academy name for 4 seconds

// Complete academy titles: [prefix, prefixIsRed, suffix, suffixIsRed]
const academyTitles: [string, boolean, string, boolean][] = [
    ['Avalanche L1', true, 'Developer', false],
    ['Blockchain', true, 'Developer', false],
    ['Avalanche', false, 'Entrepreneur', true],
];

function RotatingAcademyTitle() {
    const [index, setIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        // Cycle through titles
        const timer = setInterval(() => {
            setIsAnimating(false);
            
            // Small delay before changing index to allow fade out
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % academyTitles.length);
                setIsAnimating(true);
            }, 900);
        }, DISPLAY_DURATION);

        return () => clearInterval(timer);
    }, []);

    const [prefix, prefixIsRed, suffix, suffixIsRed] = academyTitles[index];

    return (
        <div 
            className={`transition-all duration-700 text-center lg:text-right ${
                isAnimating 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 -translate-y-4'
            }`}
        >
            <div className="flex flex-col lg:flex-row lg:justify-end items-center gap-1 lg:gap-2">
                <span
                    className={`font-bold tracking-tight whitespace-nowrap ${
                        prefixIsRed
                            ? 'bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent'
                            : 'text-zinc-900 dark:text-white'
                    }`}
                >
                    {prefix}
                </span>
                <span
                    className={`font-bold tracking-tight whitespace-nowrap ${
                        suffixIsRed
                            ? 'bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent'
                            : 'text-zinc-900 dark:text-white'
                    }`}
                >
                    {suffix}
                </span>
            </div>
        </div>
    );
}

export function AcademyHero({ title, accent, accentWords, description }: AcademyHeroProps) {
    const handleScrollToLearningPath = () => {
        const learningPathSection = document.getElementById('learning-path-section');
        if (learningPathSection) {
            learningPathSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/50 via-transparent to-transparent dark:from-zinc-950/20 dark:via-transparent" />

            <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-16">
                <div className="mx-auto w-full lg:mx-0">
                    <div className="flex flex-col items-center text-center">
                        {/* Main heading with rotating academy title */}
                        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
                            <div className="flex flex-col lg:inline-flex lg:flex-row items-center justify-center lg:-ml-36">
                                <div className="inline-block text-center lg:text-right lg:mr-2 w-full lg:w-[650px] xl:w-[800px]">
                                    <RotatingAcademyTitle />
                                </div>
                                <span className="font-bold text-zinc-900 dark:text-white mt-1 lg:mt-0">
                                    Academy
                                </span>
                            </div>
                        </h1>

                        {/* Description */}
                        <p className="mt-6 text-lg lg:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                            {description}
                        </p>

                        {/* Visual separator - positioned at bottom */}
                        <button
                            onClick={handleScrollToLearningPath}
                            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors cursor-pointer group"
                            aria-label="Scroll to learning path"
                        >
                            <div className="h-px w-12 bg-gradient-to-r from-transparent to-zinc-300 dark:to-zinc-700 group-hover:to-zinc-400 dark:group-hover:to-zinc-600 transition-all" />
                            <ChevronDown className="h-5 w-5 animate-bounce" />
                            <div className="h-px w-12 bg-gradient-to-l from-transparent to-zinc-300 dark:to-zinc-700 group-hover:to-zinc-400 dark:group-hover:to-zinc-600 transition-all" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
