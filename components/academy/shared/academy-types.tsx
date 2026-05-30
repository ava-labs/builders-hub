export type AcademyPathType = 'avalanche' | 'entrepreneur' | 'blockchain';

type BlogFeature = {
    title: string;
    blogs: Array<{
        id: string;
        title: string;
        description: string;
        date?: string;
        link: string;
    }>;
};

export interface AcademyLandingPageConfig {
    id: string;
    name: string;
    heroTitle: string;
    heroAccent: string;
    heroAccentWords?: string[];
    heroDescription: string;
    pathType: AcademyPathType;
    features?: {
        highlights?: BlogFeature;
    };
}