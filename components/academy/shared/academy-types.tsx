import type { ReactNode } from 'react';

export interface AcademyLandingPageConfig {
    id: string;
    name: string;
    heroTitle: string;
    heroAccent: string;
    heroDescription: string;
    pathType: 'avalanche' | 'entrepreneur' | 'blockchain';
    customContent?: ReactNode;
    showBlogs?: boolean;
    features?: {
        codebaseBlogs?: {
            title: string;
            blogs: Array<{
                id: string;
                title: string;
                description: string;
                date?: string;
                link: string;
            }>;
        };
    };
}