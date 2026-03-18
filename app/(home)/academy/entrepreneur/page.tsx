import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { AcademyLayout } from '@/components/academy/shared/academy-layout';
import { entrepreneurAcademyLandingPageConfig } from './config';
import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { blog } from '@/lib/source';
import { Suspense } from 'react';

export const metadata: Metadata = createMetadata({
    title: 'Entrepreneur Academy',
    description: 'Join the next generation of Web3 entrepreneurs. Learn how to build, launch, and scale your blockchain startup.',
    openGraph: {
        url: '/academy/entrepreneur',
        images: {
            url: '/api/og/academy',
            width: 1200,
            height: 630,
            alt: 'Entrepreneur Academy',
        },
    },
    twitter: {
        images: {
            url: '/api/og/academy',
            width: 1200,
            height: 630,
            alt: 'Entrepreneur Academy',
        },
    },
});

export default function EntrepreneurAcademyPage(): React.ReactElement {
    const { features } = entrepreneurAcademyLandingPageConfig;

    const blogPages = [...blog.getPages()]
        .sort(
            (a, b) =>
                new Date((b.data.date as string) ?? b.url).getTime() -
                new Date((a.data.date as string) ?? a.url).getTime()
        )
        .slice(0, 9);

    const blogs = blogPages.map((page) => ({
        url: page.url,
        data: {
            title: page.data.title || "Untitled",
            description: page.data.description || "",
            topics: (page.data.topics as string[]) || [],
            date:
                page.data.date instanceof Date
                    ? page.data.date.toISOString()
                    : (page.data.date as string) || "",
        },
        file: {
            name: page.url,
        },
    }));

    const entrepreneurBlogsFromConfig = (features?.highlights?.blogs ?? []).map((blogEntry) => ({
        url: blogEntry.link,
        data: {
            title: blogEntry.title,
            description: blogEntry.description,
            topics: ['Entrepreneur'],
            date: blogEntry.date || '',
        },
        file: {
            name: blogEntry.id,
        },
    }));

    const entrepreneurHighlights = features?.highlights ? (
                        <div className="mb-16">
                            <div className="flex items-center gap-3 mb-8">
                                <BookOpen className="h-6 w-6 text-red-600" />
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
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
                                        className="group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <h3 className="font-semibold text-lg text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors pr-4">
                                                {blog.title}
                                            </h3>
                                            <ExternalLink className="h-5 w-5 text-zinc-400 group-hover:text-red-600 transition-colors flex-shrink-0" />
                                        </div>

                                        {blog.date && (
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                                                {blog.date}
                                            </p>
                                        )}

                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 flex-grow">
                                            {blog.description}
                                        </p>

                                        <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-red-600 group-hover:text-red-700 dark:text-red-500 dark:hover:text-red-400">
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
                blogs={blogs}
                blogsByPath={{
                    avalanche: blogs,
                    blockchain: blogs,
                    entrepreneur: entrepreneurBlogsFromConfig.length > 0 ? entrepreneurBlogsFromConfig : blogs,
                }}
                afterLearningPathByPath={{
                    entrepreneur: entrepreneurHighlights,
                }}
            />
        </Suspense>
    );
}
