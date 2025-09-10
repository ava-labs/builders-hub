import { HeroBackground } from '@/components/landing/hero';
import { AcademyHero } from './academy-hero';
import { AcademyLearningPath } from './academy-learning-path';
import { AcademyBlogSection } from './academy-blog-section';
import type { AcademyLandingPageConfig } from './types';

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
    children?: React.ReactNode;
    afterLearningPath?: React.ReactNode;
}

export function AcademyLayout({ config, blogs = [], children, afterLearningPath }: AcademyLayoutProps) {
    return (
        <>
            <HeroBackground />
            <main className="container relative">
                <AcademyHero
                    title={config.heroTitle}
                    accent={config.heroAccent}
                    description={config.heroDescription}
                />

                <div className="pb-12 sm:pb-24">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        {/* Custom content before learning path */}
                        {children}

                        {/* Learning Tree Section */}
                        <AcademyLearningPath
                            defaultPathType={config.pathType}
                            showToggle={config.pathType === 'avalanche'}
                        />

                        {/* Custom content after learning path */}
                        {afterLearningPath}

                        {/* Blog Section - only if enabled */}
                        {config.showBlogs && blogs.length > 0 && (
                            <AcademyBlogSection blogs={blogs} />
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
