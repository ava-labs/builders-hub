'use client';

import { HeroBackground } from '@/components/landing/hero';
import { AcademyHero } from './academy-hero';
import { AcademyLearningPath } from './academy-learning-path';
import { AcademyBlogSection } from './academy-blog-section';
import type { AcademyLandingPageConfig, AcademyPathType } from './academy-types';
import { AcademyBubbleNav } from './academy-bubble.config';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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

interface AcademyLayoutProps {
    config: AcademyLandingPageConfig;
    blogs?: BlogPage[];
    blogsByPath?: Partial<Record<AcademyPathType, BlogPage[]>>;
    children?: ReactNode;
    afterLearningPath?: ReactNode;
    afterLearningPathByPath?: Partial<Record<AcademyPathType, ReactNode>>;
    initialPathType?: AcademyPathType | null;
}

export function AcademyLayout({
    config,
    blogs = [],
    blogsByPath,
    children,
    afterLearningPath,
    afterLearningPathByPath,
    initialPathType = null,
}: AcademyLayoutProps) {
    const [activePath, setActivePath] = useState<AcademyPathType>(initialPathType ?? config.pathType);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isAcademyRoot = pathname === '/academy';

    const normalizePathType = (value: string | null): AcademyPathType | null => {
        if (!value) return null;
        if (value === 'avalanche' || value === 'avalanche-l1') return 'avalanche';
        if (value === 'blockchain' || value === 'entrepreneur') return value;
        return null;
    };

    useEffect(() => {
        if (!isAcademyRoot) {
            setActivePath(initialPathType ?? config.pathType);
            return;
        }

        const rawParam = searchParams?.get('path');
        const paramPath = normalizePathType(rawParam);

        if (paramPath && paramPath !== activePath) {
            setActivePath(paramPath);
        } else if (!paramPath && initialPathType && initialPathType !== activePath) {
            setActivePath(initialPathType);
        }

        if (rawParam) {
            router.replace('/academy', { scroll: false });
        }
    }, [config.pathType, initialPathType, isAcademyRoot, searchParams, activePath, router]);

    const resolvedBlogs = useMemo(() => {
        if (blogsByPath) {
            const blogsForPath = blogsByPath[activePath];
            if (blogsForPath && blogsForPath.length > 0) {
                return blogsForPath;
            }
        }
        return blogs;
    }, [blogsByPath, blogs, activePath]);

    const resolvedAfterLearningPath = useMemo(() => {
        if (afterLearningPathByPath) {
            return afterLearningPathByPath[activePath] ?? null;
        }
        return afterLearningPath ?? null;
    }, [afterLearningPath, afterLearningPathByPath, activePath]);

    const shouldShowBlogs = config.showBlogs && resolvedBlogs.length > 0;

    return (
        <>
            <HeroBackground />
            <main className="container relative">
                <AcademyHero
                    title={config.heroTitle}
                    accent={config.heroAccent}
                    accentWords={config.heroAccentWords}
                    description={config.heroDescription}
                />

                <div className="pb-32 sm:pb-36">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        {children}

                        <AcademyLearningPath
                            pathType={activePath}
                        />

                        {resolvedAfterLearningPath}

                        {shouldShowBlogs && (
                            <AcademyBlogSection blogs={resolvedBlogs} />
                        )}
                    </div>
                </div>
            </main>

            <AcademyBubbleNav
                activePath={activePath}
                onChange={(nextPath) => {
                    setActivePath(nextPath);
                }}
            />
        </>
    );
}
