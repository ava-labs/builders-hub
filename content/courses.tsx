import { ArrowLeftRight, Coins, MailIcon, SquareCode, SquareIcon, SquareStackIcon, Triangle } from 'lucide-react';

export type Course = {
    name: string;
    description: string;
    slug: string;
    icon: any;
    status: "featured" | "normal" | "hidden";
    duration?: string;
    languages: string[];
    tools: string[];
    instructors: string[];
    category: "Fundamentals" | "Smart Contract Development" | "L1 Development" | "Interoperability" | "Entrepreneur";
    certificateTemplate?: string;
};

const officialCourses: Course[] = [
    {
        name: "Blockchain Fundamentals",
        description: "Gain a comprehensive understanding of fundamental blockchain concepts, including how they work, and key components",
        slug: "blockchain-fundamentals",
        icon: <SquareIcon />,
        status: "normal",
        duration: "1 hour",
        languages: [],
        tools: [],
        instructors: ["Martin Eckardt", "Ash", "Katherine Sullivan"],
        category: "Fundamentals",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Avalanche Fundamentals",
        description: "Get a high level overview of Avalanche Consensus, L1s and VMs",
        slug: "avalanche-fundamentals",
        icon: <Triangle />,
        status: "featured",
        duration: "1 hour",
        languages: [],
        tools: ["Console"],
        instructors: ["Martin Eckardt", "Ash", "Nicolas Arnedo"],
        category: "Fundamentals",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "x402 Payment Infrastructure",
        description: "Learn about the x402 protocol for instant, permissionless HTTP-native payments on Avalanche",
        slug: "x402-payment-infrastructure",
        icon: <Coins />,
        status: "featured",
        duration: "2 hours",
        languages: ["JavaScript", "Typescript"],
        tools: ["Thirdweb x402"],
        instructors: ["Federico Nardelli"],
        category: "Fundamentals",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Interchain Messaging",
        description: "Learn the fundamentals of Avalanche Interchain Messaging and set up cross-chain communication infrastructure",
        slug: "interchain-messaging",
        icon: <MailIcon />,
        status: "featured",
        duration: "2 hours",
        tools: ["Console"],
        languages: ["Solidity"],
        instructors: ["Martin Eckardt", "Andrea Vargas", "Ash", "Nicolas Arnedo"],
        category: "Interoperability",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "ERC-20 to ERC-20 Bridge",
        description: "Learn how to bridge ERC-20 tokens between Avalanche L1s using Interchain Token Transfer",
        slug: "erc20-bridge",
        icon: <ArrowLeftRight />,
        status: "featured",
        duration: "2 hours",
        tools: ["ICM", "Foundry"],
        languages: ["Solidity"],
        instructors: ["Martin Eckardt", "Andrea Vargas", "Ash", "Owen Wahlgren", "Sarp"],
        category: "Interoperability",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Native Token Bridge",
        description: "Learn how to bridge native tokens between Avalanche L1s using Interchain Token Transfer",
        slug: "native-token-bridge",
        icon: <ArrowLeftRight />,
        status: "featured",
        duration: "2 hours",
        tools: ["ICM", "Foundry"],
        languages: ["Solidity"],
        instructors: ["Nicolas Arnedo"],
        category: "Interoperability",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Customizing the EVM",
        description: "Learn how to customize the EVM and add your own custom precompiles",
        slug: "customizing-evm",
        icon: <SquareCode />,
        duration: "4 hours",
        status: "featured",
        tools: ["Remix IDE"],
        languages: ["Go"],
        instructors: ["Martin Eckardt", "Ash"],
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "L1 Native Tokenomics",
        description: "Learn how to design and deploy tokenomics for your Avalanche L1",
        slug: "l1-native-tokenomics",
        icon: <Coins />,
        duration: "2 hours",
        status: "featured",
        tools: ["ICM"],
        languages: ["Solidity"],
        instructors: ["Martin Eckardt", "Owen Wahlgren", "Sarp", "Nicolas Arnedo"],
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Permissioned L1s",
        description: "Learn how to create and manage permissioned blockchains with Proof of Authority on Avalanche",
        slug: "permissioned-l1s",
        icon: <SquareStackIcon />,
        duration: "2 hours",
        status: "featured",
        tools: ["Validator Manager", "P-Chain", "ICM"],
        languages: ["Solidity"],
        instructors: ["Martin Eckardt", "Owen Wahlgren", "Nicolas Arnedo"],
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Permissionless L1s",
        description: "Learn how to transition from permissioned blockchains with PoA to permissionless blockchains with PoS",
        slug: "permissionless-l1s",
        icon: <SquareStackIcon />,
        duration: "2 hours",
        status: "featured",
        tools: ["Validator Manager", "P-Chain", "ICM"],
        languages: ["Solidity"],
        instructors: ["Martin Eckardt", "Owen Wahlgren", "Nicolas Arnedo"],
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Access Restriction",
        description: "Control who can transact and deploy contracts on your Avalanche L1 using allowlist precompiles",
        slug: "access-restriction",
        icon: <SquareStackIcon />,
        duration: "2 hours",
        status: "featured",
        tools: ["L1 Toolbox", "Docker"],
        languages: [],
        instructors: ["Nicolas Arnedo"],
        category: "L1 Development",
    },
    {
        // Hidden entry for certificate generation — Access Restriction has two certificates
        name: "Access Restriction Fundamentals",
        description: "Fundamentals certificate for the Access Restriction course",
        slug: "access-restriction-fundamentals",
        icon: <SquareStackIcon />,
        duration: "1 hour",
        status: "hidden",
        tools: ["L1 Toolbox", "Docker"],
        languages: [],
        instructors: ["Nicolas Arnedo"],
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        // Hidden entry for certificate generation — Access Restriction has two certificates
        name: "Access Restriction Advanced",
        description: "Advanced certificate for the Access Restriction course",
        slug: "access-restriction-advanced",
        icon: <SquareStackIcon />,
        duration: "1 hour",
        status: "hidden",
        tools: ["L1 Toolbox", "Docker"],
        languages: [],
        instructors: ["Nicolas Arnedo"],
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Solidity Programming with Foundry",
        description: "Learn the basics on how to code in Solidity with Foundry",
        slug: "solidity-foundry",
        icon: <SquareCode />,
        duration: "1 hour",
        status: "featured",
        tools: ["Starter-Kit", "Foundry"],
        languages: ["Solidity"],
        instructors: ["Andrea Vargas"],
        category: "Smart Contract Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "NFT Deployment",
        description: "Learn how to create, prepare, and deploy your own NFT collection on Avalanche",
        slug: "nft-deployment",
        icon: <SquareCode />,
        duration: "1.5 hours",
        status: "featured",
        tools: ["Remix IDE", "Pinata"],
        languages: ["Solidity"],
        instructors: ["Andrea Vargas", "Ash", "Martin Eckardt"],
        category: "Smart Contract Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Encrypted ERC",
        description: "Learn the basics on what is an encrypted ERC token and how to use it",
        slug: "encrypted-erc",
        icon: <SquareCode />,
        duration: "3 hours",
        status: "featured",
        tools: [],
        languages: ["Solidity"],
        instructors: ["Alejandro Soto"],
        category: "Smart Contract Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Foundations of a Web3 Venture",
        description: "Secure, compliant and customer-driven growth made simple.",
        slug: "foundations-web3-venture",
        icon: <SquareStackIcon />,
        status: "featured",
        duration: "1 hour",
        languages: [],
        tools: ["Venture Foundations"],
        instructors: ["Michael Martin", "Doro Unger-Lee", "Nicolas Arnedo"],
        category: "Entrepreneur",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-certificates/FillableAvalanche_EntrepreneurAcademy_Certificate_FW3V_R1.pdf"
    },
    {
        name: "Go-to-Market Strategist",
        description: "Generate quality leads, craft winning sales messages, and design pricing strategies that drive growth.",
        slug: "go-to-market",
        icon: <SquareStackIcon />,
        status: "featured",
        duration: "1 hour",
        languages: [],
        tools: ["Go-To-Market"],
        instructors: ["Michael Martin", "Doro Unger-Lee", "Nicolas Arnedo"],
        category: "Entrepreneur",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-certificates/FillableAvalanche_EntrepreneurAcademy_Certificate_W3GTM_R1.pdf"
    },
    {
        name: "Web3 Community Architect",
        description: "Build engaged communities, amplify growth through media and events, and design impactful token economies.",
        slug: "web3-community-architect",
        icon: <SquareStackIcon />,
        status: "featured",
        duration: "1 hour",
        languages: [],
        tools: ["Community Building"],
        instructors: ["Michael Martin", "Doro Unger-Lee", "Nicolas Arnedo"],
        category: "Entrepreneur",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-certificates/FillableAvalanche_EntrepreneurAcademy_Certificate_W3CA_R1.pdf"
    },
    {
        name: "Fundraising & Finance Pro",
        description: "Master VC communication, secure funding through grants, and craft winning pitches.",
        slug: "fundraising-finance",
        icon: <SquareStackIcon />,
        status: "featured",
        duration: "1 hour",
        languages: [],
        tools: ["Fundraising"],
        instructors: ["Michael Martin", "Doro Unger-Lee", "Nicolas Arnedo"],
        category: "Entrepreneur",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-certificates/FillableAvalanche_EntrepreneurAcademy_Certificate_W3FFP_R1.pdf"
    },
];

const ecosystemCourses: Course[] = [];

const entrepreneurCourses = officialCourses.filter((course) => course.category === "Entrepreneur");

// Helper function to create course configuration mappings
export const getCourseConfig = () => {
    const config: Record<string, { name: string; template: string }> = {};

    officialCourses.forEach(course => {
        if (course.certificateTemplate) {
            config[course.slug] = {
                name: course.name,
                template: course.certificateTemplate
            };
        }
    });

    return config;
};

// Helper function to create course name mappings for HubSpot
export const getCourseNameMapping = () => {
    const mapping: Record<string, string> = {};

    officialCourses.forEach(course => {
        if (course.certificateTemplate) {
            mapping[course.slug] = course.name;
        }
    });

    return mapping;
};

// Helper function to get course durations by slug
export const getCourseDurations = (): Record<string, string> => {
    const durations: Record<string, string> = {};

    officialCourses.forEach(course => {
        if (course.duration) {
            durations[course.slug] = course.duration;
        }
    });

    return durations;
};

// Helper function to get course tools by slug (returns the first/main tool)
export const getCourseTools = (): Record<string, string> => {
    const tools: Record<string, string> = {};

    officialCourses.forEach(course => {
        if (course.tools && course.tools.length > 0) {
            tools[course.slug] = course.tools[0];
        }
    });

    return tools;
};

export default {
    official: officialCourses.filter((course) => ["normal", "featured"].includes(course.status) && course.category !== "Entrepreneur"),
    official_featured: officialCourses.filter((course) => course.status === "featured" && course.category !== "Entrepreneur"),
    avalancheEntrepreneur: entrepreneurCourses,
    ecosystem: ecosystemCourses,
};
