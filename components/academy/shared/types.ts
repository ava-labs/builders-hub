import type { ReactNode } from 'react';

export interface AcademyLandingPageConfig {
    id: string;
    name: string;
    heroTitle: string;
    heroAccent: string;
    heroDescription: string;
    pathType: 'avalanche' | 'entrepreneur';
    customContent?: ReactNode;
    showBlogs?: boolean;
    features?: {
        successStories?: {
            title: string;
            stories: Array<{
                id: string;
                company: string;
                description: string;
                founder?: string;
                imageUrl?: string;
                link?: string;
            }>;
        };
    };
}
