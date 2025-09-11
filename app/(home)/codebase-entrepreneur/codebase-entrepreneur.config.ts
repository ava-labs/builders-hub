import type { AcademyLandingPageConfig } from '@/components/academy/shared/academy-types';

export const codebaseEntrepreneurLandingPageConfig: AcademyLandingPageConfig = {
    id: 'codebase-entrepreneur',
    name: 'Codebase Entrepreneur Academy',
    heroTitle: 'Codebase',
    heroAccent: 'Entrepreneur',
    heroDescription: 'Join the next generation of Web3 entrepreneurs. Learn how to build, launch, and scale your blockchain startup with guidance from industry experts and successful founders.',
    pathType: 'entrepreneur',
    showBlogs: false,
    features: {
        codebaseBlogs: {
            title: 'Codebase Blogs',
            blogs: [
                {
                    id: 'gogopool-success',
                    title: 'GoGoPool: Revolutionizing Avalanche Validation',
                    description: 'How GoGoPool created a decentralized staking protocol that transformed subnet validation on Avalanche',
                    date: '2024-03-15',
                    link: 'https://www.gogopool.com/blog/success-story',
                },
                {
                    id: 'hubble-exchange',
                    title: 'Building the First Multi-Chain Perpetual Futures Exchange',
                    description: 'Hubble Exchange\'s journey to creating a cross-chain perpetual futures platform on Avalanche',
                    date: '2024-02-28',
                    link: 'https://hubble.exchange/blog/our-story',
                },
                {
                    id: 'trader-made-analytics',
                    title: 'From Idea to Impact: Trader Made\'s DeFi Analytics Platform',
                    description: 'Professional trading tools and analytics platform serving thousands of DeFi traders',
                    date: '2024-01-20',
                    link: '#',
                },
                {
                    id: 'web3-gaming-revolution',
                    title: 'The Future of Web3 Gaming on Avalanche',
                    description: 'Building the next generation of blockchain gaming experiences with fast, scalable infrastructure',
                    date: '2024-01-10',
                    link: '#',
                },
            ],
        },
    },
};
