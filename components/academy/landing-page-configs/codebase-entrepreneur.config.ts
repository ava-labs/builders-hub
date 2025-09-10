import type { AcademyLandingPageConfig } from '@/components/academy/shared/types';

export const codebaseEntrepreneurLandingPageConfig: AcademyLandingPageConfig = {
    id: 'codebase-entrepreneur',
    name: 'Codebase Entrepreneur Academy',
    heroTitle: 'Codebase',
    heroAccent: 'Entrepreneur',
    heroDescription: 'Join the next generation of Web3 entrepreneurs. Learn how to build, launch, and scale your blockchain startup with guidance from industry experts and successful founders.',
    pathType: 'entrepreneur',
    showBlogs: false,
    features: {
        successStories: {
            title: 'Success Stories',
            stories: [
                {
                    id: 'gogopool',
                    company: 'GoGoPool',
                    description: 'Decentralized staking protocol that revolutionized Avalanche subnet validation',
                    founder: 'Jonny Greenwood',
                    link: 'https://www.gogopool.com/',
                },
                {
                    id: 'hubblexchange',
                    company: 'Hubble Exchange',
                    description: 'First multi-chain perpetual futures exchange built on Avalanche',
                    founder: 'Elie Le Rest',
                    link: 'https://hubble.exchange/',
                },
                {
                    id: 'trader-made',
                    company: 'Trader Made',
                    description: 'Professional trading tools and analytics platform for DeFi traders',
                    founder: 'Alex Johnson',
                    link: '#',
                },
                {
                    id: 'avalanche-bridge',
                    company: 'Web3 Gaming Studio',
                    description: 'Building the next generation of blockchain gaming experiences',
                    founder: 'Sarah Chen',
                    link: '#',
                },
            ],
        },
    },
};
