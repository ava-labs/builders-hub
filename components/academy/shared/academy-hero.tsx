'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

interface AcademyHeroProps {
    title: string;
    accent: string;
    accentWords?: string[];
    description: string;
}

const ROTATION_INTERVAL = 2600;
const TRANSITION_DURATION = 600;

function RotatingAccent({ words }: { words: string[] }) {
    const uniqueWords = useMemo(
        () =>
            [...new Set(words.map((word) => word.trim()).filter((word) => word.length > 0))],
        [words],
    );

    const displayWords = useMemo(() => {
        if (uniqueWords.length <= 1) {
            return uniqueWords;
        }

        return [...uniqueWords, uniqueWords[0]];
    }, [uniqueWords]);

    const [index, setIndex] = useState(0);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        setIndex(0);
    }, [uniqueWords.length]);

    useEffect(() => {
        if (displayWords.length <= 1) return;

        const timer = setInterval(() => {
            setIndex((prev) => prev + 1);
        }, ROTATION_INTERVAL);

        return () => clearInterval(timer);
    }, [displayWords.length]);

    useEffect(() => {
        if (displayWords.length <= 1) return;

        if (index === displayWords.length - 1) {
            const timeout = setTimeout(() => {
                setIsResetting(true);
                setIndex(0);
            }, TRANSITION_DURATION);

            return () => clearTimeout(timeout);
        }
    }, [index, displayWords.length]);

    useEffect(() => {
        if (!isResetting) return;

        const frame = requestAnimationFrame(() => {
            setIsResetting(false);
        });

        return () => cancelAnimationFrame(frame);
    }, [isResetting]);

    if (uniqueWords.length === 0) {
        return null;
    }

    if (uniqueWords.length === 1) {
        return (
            <span className="bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent font-semibold">
                {uniqueWords[0]}
            </span>
        );
    }

    const transformStyle: CSSProperties = {
        transform: `translateY(-${index * 100}%)`,
        transition: isResetting ? 'none' : 'transform 600ms cubic-bezier(0.76, 0, 0.24, 1)',
    };

    return (
        <span className="inline-block h-[1.3em] min-w-[8.5rem] overflow-hidden align-middle">
            <span className="flex flex-col" style={transformStyle}>
                {displayWords.map((word, idx) => (
                    <span
                        key={`${word}-${idx}`}
                        className="h-[1.3em] flex items-center justify-center bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent font-semibold tracking-tight"
                    >
                        {word}
                    </span>
                ))}
            </span>
        </span>
    );
}

export function AcademyHero({ title, accent, accentWords, description }: AcademyHeroProps) {
    const handleScrollToLearningPath = () => {
        const learningPathSection = document.getElementById('learning-path-section');
        if (learningPathSection) {
            learningPathSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const rotatingAccentWords = accentWords && accentWords.length > 0
        ? accentWords
        : [accent];

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/50 via-transparent to-transparent dark:from-zinc-950/20 dark:via-transparent" />

            <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-16">
                <div className="mx-auto w-full lg:mx-0">
                    <div className="flex flex-col items-center text-center">
                        {/* Main heading */}
                        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
                            <span className="text-zinc-900 dark:text-white">
                                {title}{" "}
                            </span>
                            <RotatingAccent words={rotatingAccentWords} />
                            <span className="text-zinc-900 dark:text-white">
                                {" "}Academy
                            </span>
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
