import Link from 'next/link';
import { blog } from '@/lib/source';
import { HeroBackground } from '@/components/landing/hero';
import { ArrowRight, X } from 'lucide-react';
import { createMetadata } from '@/utils/metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = createMetadata({
    title: 'Blog',
    description: 'Takeaways and tutorials from building a network of fast, efficient, highly-optimized chains.',
    openGraph: {
        images: '/api/og/blog',
    },
    X: {
        images: '/api/og/blog',
    },
});

export default function Page(): React.ReactElement {
    const blogs = [...blog.getPages()].sort(
        (a, b) =>
            new Date(b.data.date ?? b.file.name).getTime() -
            new Date(a.data.date ?? a.file.name).getTime(),
    );

    const [featured, ...others] = blogs;

    return (
        <>
            <HeroBackground />
            <main className="py-12 sm:py-20">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    {/* Header */}
                    <section className="mx-auto w-full lg:mx-0 text-center">
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter">
                            <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-slate-200 dark:to-white">
                                Avalanche Builder Blog
                            </span>
                        </h1>
                        <p className="mt-6 text-base sm:text-lg leading-7 text-muted-foreground">
                            Takeaways and tutorials from building a network of fast, efficient, highly-optimized chains.
                        </p>
                    </section>

                    {/* Featured Post */}
                    {featured && (
                        <section className="mt-12 sm:mt-16">
                            <Link
                                href={featured.url}
                                className="group block overflow-hidden rounded-xl border border-white/20 bg-card/80 p-6 sm:p-8 shadow-sm transition duration-300 hover:border-[#E84142]/60 hover:shadow-[0_0_0_1px_rgba(232,65,66,0.6),0_0_30px_6px_rgba(232,65,66,0.35)] dark:bg-card-dark/80"
                            >
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(featured.data.date ?? featured.file.name).toDateString()}
                                        </p>
                                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                            Featured
                                        </span>
                                    </div>

                                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                                        {featured.data.title}
                                    </h2>

                                    <p className="text-sm sm:text-base text-muted-foreground max-w-3xl">
                                        {featured.data.description}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                                        {featured.data.topics.map((topic: string) => (
                                            <span
                                                key={topic}
                                                className="rounded-full bg-fd-accent px-3 py-1.5 font-medium text-muted-foreground"
                                            >
                                                {topic}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                        {featured.data.authors.map((author: string) => (
                                            <span key={author} className="inline-flex items-center gap-2">
                                                <X size={12} />
                                                <span className="truncate">{author}</span>
                                            </span>
                                        ))}
                                        <span className="ml-auto inline-flex items-center gap-1 text-primary">
                                            Read article <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </section>
                    )}

                    {/* All Posts */}
                    {others.length > 0 && (
                        <section className="mt-12 sm:mt-16">
                            <h3 className="mb-6 text-lg font-semibold tracking-tight text-foreground/90">
                                Latest posts
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {others.map((g) => (
                                    <Link
                                        key={g.url}
                                        href={g.url}
                                        className="flex flex-col gap-2 rounded-lg border border-white/20 bg-card p-4 shadow-sm transition duration-300 hover:border-[#E84142]/60 hover:shadow-[0_0_0_1px_rgba(232,65,66,0.6),0_0_24px_5px_rgba(232,65,66,0.3)] dark:bg-card-dark"
                                    >
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(g.data.date ?? g.file.name).toDateString()}
                                        </p>
                                        <h4 className="text-xl font-semibold tracking-tight">{g.data.title}</h4>
                                        <p className="text-sm text-muted-foreground line-clamp-3">
                                            {g.data.description}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                            {g.data.topics.map((topic: string) => (
                                                <span
                                                    key={topic}
                                                    className="rounded-full bg-fd-accent px-3 py-1.5 font-medium text-muted-foreground"
                                                >
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                            {g.data.authors.map((author: string) => (
                                                <span key={author} className="inline-flex items-center gap-2">
                                                    <X size={12} />
                                                    <span className="truncate">{author}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </>
    );
}