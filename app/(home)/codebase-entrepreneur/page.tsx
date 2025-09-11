import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { AcademyLayout } from '@/components/academy/shared/academy-layout';
import { codebaseEntrepreneurLandingPageConfig } from '@/components/academy/landing-page-configs/codebase-entrepreneur.config';
import { CodebaseBlogs } from '@/components/academy/codebase-entrepreneur/codebase-blogs';

export const metadata: Metadata = createMetadata({
    title: 'Codebase Entrepreneur Academy',
    description: 'Join the next generation of Web3 entrepreneurs. Learn how to build, launch, and scale your blockchain startup.',
    openGraph: {
        url: '/academy/codebase-entrepreneur',
        images: {
            url: '/api/og/academy/codebase-entrepreneur',
            width: 1200,
            height: 630,
            alt: 'Codebase Entrepreneur Academy',
        },
    },
    twitter: {
        images: {
            url: '/api/og/academy/codebase-entrepreneur',
            width: 1200,
            height: 630,
            alt: 'Codebase Entrepreneur Academy',
        },
    },
});

export default function CodebaseEntrepreneurPage(): React.ReactElement {
    const { features } = codebaseEntrepreneurLandingPageConfig;

    return (
        <AcademyLayout
            config={codebaseEntrepreneurLandingPageConfig}
            afterLearningPath={
                <>
                    {/* Codebase Blogs - now appears after learning tree */}
                    {features?.codebaseBlogs && (
                        <CodebaseBlogs
                            title={features.codebaseBlogs.title}
                            blogs={features.codebaseBlogs.blogs}
                        />
                    )}
                </>
            }
        />
    );
}
