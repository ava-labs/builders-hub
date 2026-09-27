import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { AcademyLayout } from '@/components/academy/shared/academy-layout';
import { COURSE_STATS } from '@/lib/academy/course-stats.generated';
import { entrepreneurAcademyLandingPageConfig } from './config';
import { ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

export const metadata: Metadata = createMetadata({
    title: 'Entrepreneur Academy',
    description: 'Join the next generation of Web3 entrepreneurs. Learn how to build, launch, and scale your blockchain startup.',
    openGraph: {
        url: '/academy/entrepreneur',
        images: {
            url: '/api/og/academy?v=2',
            width: 1200,
            height: 630,
            alt: 'Entrepreneur Academy',
        },
    },
    twitter: {
        images: {
            url: '/api/og/academy?v=2',
            width: 1200,
            height: 630,
            alt: 'Entrepreneur Academy',
        },
    },
});

export default function EntrepreneurAcademyPage(): React.ReactElement {
    const { features } = entrepreneurAcademyLandingPageConfig;
    const courseStats = COURSE_STATS['entrepreneur'];

    const entrepreneurHighlights = features?.highlights ? (
                        <div className="mb-16">
                            <div className="flex items-center gap-3 mb-8">
                                <h2 className="font-ac-display text-2xl font-medium tracking-[-0.015em] text-ac-ink">
                                    {features.highlights.title}
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {features.highlights.blogs.map((blog) => (
                                    <Link
                                        key={blog.id}
                                        href={blog.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative flex flex-col rounded-xl border border-ac-rule bg-ac-paper p-6 hover:border-ac-ink transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            {/* 16 px with text-lg's line height (1.5556), as the approved card */}
                                            <h3 className="font-semibold text-[16px] leading-[1.5556] text-ac-ink pr-4">
                                                {blog.title}
                                            </h3>
                                            <ExternalLink className="h-5 w-5 text-ac-ink-3 flex-shrink-0" />
                                        </div>

                                        {blog.date && (
                                            <p className="text-sm text-ac-ink-3 mb-3">
                                                {blog.date}
                                            </p>
                                        )}

                                        <p className="text-sm text-ac-ink-3 flex-grow">
                                            {blog.description}
                                        </p>

                                        <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-ac-ink">
                                            Read article
                                            <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
    ) : null;

    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-zinc-600 dark:text-zinc-400">Loading...</div></div>}>
            <AcademyLayout
                config={entrepreneurAcademyLandingPageConfig}
                courseStats={courseStats}
                afterLearningPath={entrepreneurHighlights}
            />
        </Suspense>
    );
}
