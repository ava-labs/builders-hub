"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import LearningTree from '@/components/academy/learning-tree';
import { cn } from '@/utils/cn';

interface BlogPage {
    url: string;
    data: {
        title: string;
        description: string;
        topics?: string[];
        date?: string;
    };
    file: {
        name: string;
    };
}

interface AcademyContentProps {
    blogs: BlogPage[];
}

export function AcademyContent({ blogs }: AcademyContentProps) {
    const [pathType, setPathType] = useState<'avalanche' | 'entrepreneur'>('avalanche');

    // Topic color mapping function
    const getTopicColor = (topic: string): string => {
        const topicLower = topic.toLowerCase();

        // Network/Infrastructure topics
        if (topicLower.includes('network') || topicLower.includes('upgrade') || topicLower.includes('etna')) {
            return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
        }

        // Blockchain/L1/Layer topics
        if (topicLower.includes('layer') || topicLower.includes('l1') || topicLower.includes('blockchain')) {
            return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";
        }

        // Development/Programming topics
        if (topicLower.includes('solidity') || topicLower.includes('foundry') || topicLower.includes('smart contract')) {
            return "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300";
        }

        // Validator/Staking topics
        if (topicLower.includes('validator') || topicLower.includes('staking') || topicLower.includes('stake')) {
            return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
        }

        // DeFi/Token topics
        if (topicLower.includes('token') || topicLower.includes('defi') || topicLower.includes('economics')) {
            return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
        }

        // Tools/Kits topics
        if (topicLower.includes('kit') || topicLower.includes('tool') || topicLower.includes('cli')) {
            return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
        }

        // Cross-chain/Interoperability topics
        if (topicLower.includes('cross') || topicLower.includes('bridge') || topicLower.includes('interop')) {
            return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300";
        }

        // Default fallback
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300";
    };

    return (
        <div className="pb-12 sm:pb-24">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                {/* Learning Tree Section */}
                <div className="mb-20">
                    <div className="text-center mb-12">
                        <div className="flex justify-center mb-6">
                            <div className="inline-flex items-center gap-0 p-1 rounded-full bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-950/20 dark:to-zinc-950/30 border border-zinc-200 dark:border-zinc-800/30">
                                <button
                                    onClick={() => setPathType('avalanche')}
                                    className={cn(
                                        "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                        pathType === 'avalanche'
                                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                    )}
                                >
                                    Developer
                                </button>
                                <button
                                    onClick={() => setPathType('entrepreneur')}
                                    className={cn(
                                        "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                        pathType === 'entrepreneur'
                                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                    )}
                                >
                                    Entrepreneur
                                </button>
                            </div>
                        </div>

                        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-8">
                            Learning Path for{" "}
                            <span className="text-red-600">
                                {pathType === 'avalanche' ? 'Avalanche Developer Academy' : 'Codebase Entrepreneur Academy'}
                            </span>
                        </h2>

                        {/* Visual hint */}
                        <div className="flex items-center justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                            <div className="h-px w-16 bg-gradient-to-r from-transparent to-zinc-300 dark:to-zinc-700" />
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                Start with fundamentals, progress to advanced
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

                {/* Quick Start Guides - QuickLinks Style */}
                <div className="mb-20">
                    <div className="flex items-center gap-3 mb-8">
                        <h2 className="text-xl font-bold tracking-wide text-zinc-700 dark:text-zinc-300 uppercase">
                            Join The Discussion
                        </h2>
                        <Link
                            href="/blog"
                            className="ml-auto text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium transition-colors flex items-center gap-1"
                        >
                            View all guides
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {blogs.map((blog) => (
                            <Link
                                key={blog.url}
                                href={blog.url}
                                className={cn(
                                    "group block p-6 rounded-2xl transition-all duration-200",
                                    "bg-white dark:bg-zinc-900/50",
                                    "border border-zinc-200/80 dark:border-zinc-800/80",
                                    "shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                                    "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                                    "hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
                                )}
                            >
                                <div className="h-full flex flex-col">
                                    {/* Category Pills */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {blog.data.topics && blog.data.topics.length > 0 ? (
                                            blog.data.topics.slice(0, 3).map((topic: string) => {
                                                const colorClass = getTopicColor(topic);

                                                return (
                                                    <span
                                                        key={topic}
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
                                                    >
                                                        {topic}
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
                                                Guide
                                            </span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-white line-clamp-2 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
                                            {blog.data.title}
                                        </h3>

                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                                            {blog.data.description}
                                        </p>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                                            <Clock className="w-3 h-3" />
                                            <span>5-10 min read</span>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
