import { ArrowLeftRight, Coins, MailIcon, SquareCode, SquareIcon, SquareStackIcon, TerminalIcon, Triangle, HexagonIcon, UserPen } from 'lucide-react';

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
    category: "Fundamentals" | "Smart Contract Development" | "L1 Development" | "Interoperability" | "Codebase";
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
        instructors: ["Martin Eckardt", "Ash"],
        category: "Fundamentals"
    },
    {
        name: "Avalanche Fundamentals",
        description: "Get a high level overview of Avalanche Consensus, L1s and VMs",
        slug: "avalanche-fundamentals",
        icon: <Triangle />,
        status: "featured",
        duration: "1 hour",
        languages: [],
        tools: ["L1 Toolbox"],
        instructors: ["Martin Eckardt", "Ash", "Nicolas Arnedo"],
        category: "Fundamentals",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Interchain Messaging",
        description: "Utilize Avalanche Interchain Messaging to build cross-chain dApps in the Avalanche network",
        slug: "interchain-messaging",
        icon: <MailIcon />,
        status: "featured",
        duration: "3 hours",
        tools: ["L1 Toolbox", "Docker"],
        languages: ["Solidity"],
        instructors: ["Martin Eckardt", "Andrea Vargas", "Ash", "Nicolas Arnedo"], // + Usman
        category: "Interoperability",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Interchain Token Transfer",
        description: "Deploy Avalanche Interchain Token Transfer to transfer assets between Avalanche blockchains",
        slug: "interchain-token-transfer",
        icon: <ArrowLeftRight />,
        status: "featured",
        duration: "2.5 hours",
        tools: ["ICM", "Foundry"],
        languages: ["Solidity"],
        instructors: ["Martin Eckardt", "Andrea Vargas", "Ash", "Owen Wahlgren", "Sarp"],
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
        tools: ["Avalanche CLI"],
        languages: ["Go"],
        instructors: ["Martin Eckardt", "Ash"], // + Usman
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Layer 1 Tokenomics",
        description: "Learn how to design and deploy tokenomics for your Avalanche L1",
        slug: "l1-tokenomics",
        icon: <Coins />,
        duration: "2 hours",
        status: "featured",
        tools: ["Avalanche CLI", "ICM"],
        languages: ["Solidity"],
        instructors: ["Sarp", "Owen Wahlgren"],
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "L1 Native Tokenomics",
        description: "Learn how to design and deploy tokenomics for your Avalanche L1",
        slug: "l1-tokenomics",
        icon: <Coins />,
        duration: "2 hours",
        status: "featured",
        tools: ["Avalanche CLI", "ICM"],
        languages: ["Solidity"],
        instructors: ["Martin Eckardt", "Owen Wahlgren", "Sarp", "Nicolas Arnedo"],
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "L1 Validator Management",
        description: "Learn how to manage your Avalanche L1 Validators",
        slug: "l1-validator-management",
        icon: <UserPen />,
        duration: "1 hour",
        status: "normal",
        tools: ["Warp"],
        languages: ["Solidity"],
        instructors: ["Owen Wahlgren", "Martin Eckardt"],
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
        name: "AvaCloud APIs",
        description: "Learn how to leverage AvaCloud APIs to build web apps on Avalanche",
        slug: "avacloudapis",
        icon: <SquareCode />,
        duration: "1 hour",
        status: "featured",
        tools: ["AvaCloudSDK", "AvaCloud API"],
        languages: ["Typescript"],
        instructors: ["Owen Wahlgren"],
        category: "Smart Contract Development",
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
        name: "HyperSDK",
        description: "Learn how to build a high-performance blockchain using HyperSDK",
        slug: "hypersdk",
        icon: <TerminalIcon />,
        duration: "1 hour",
        status: "hidden",
        tools: ["HyperSDK"],
        languages: ["Go", "Typescript"],
        instructors: ["Aaron Buchwald", "Ilya", "Rodrigo Villar", "Martin Eckardt", "Owen Wahlgren"],
        category: "L1 Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    {
        name: "Chainlink on your L1 via ICM",
        description: "Utilize Interchain Messaging to make Chainlink services available on any blockchain in the Avalanche Network",
        slug: "icm-chainlink",
        icon: <HexagonIcon />,
        status: "featured",
        duration: "2.5 hours",
        tools: ["ICM", "Chainlink VRF"],
        languages: ["Solidity"],
        instructors: ["Martin Eckardt", "Andrea Vargas", "Ash"],
        category: "Interoperability",
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
        tools: ["Codebase"],
        instructors: ["Michael Martin", "Doro Unger-Lee", "Nicolas Arnedo"],
        category: "Codebase",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase_EntrepreneurAcademy_Certificate_Foundations.pdf"
    },
    {
        name: "Go-to-Market Strategist",
        description: "Generate quality leads, craft winning sales messages, and design pricing strategies that drive growth.",
        slug: "go-to-market",
        icon: <SquareStackIcon />,
        status: "featured",
        duration: "1 hour",
        languages: [],
        tools: ["Codebase"],
        instructors: ["Michael Martin", "Doro Unger-Lee", "Nicolas Arnedo"],
        category: "Codebase",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase_EntrepreneurAcademy_Certificate_GTM.pdf"
    },
    {
        name: "Web3 Community Architect",
        description: "Build engaged communities, amplifiy growth through media and events, and design impactful token economies.",
        slug: "web3-community-architect",
        icon: <SquareStackIcon />,
        status: "featured",
        duration: "1 hour",
        languages: [],
        tools: ["Codebase"],
        instructors: ["Michael Martin", "Doro Unger-Lee", "Nicolas Arnedo"],
        category: "Codebase",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase_EntrepreneurAcademy_Certificate_Community.pdf"
    },
    {
        name: "Fundraising & Finance Pro",
        description: "Master VC communication, secure funding through grants, and craft winning pitches.",
        slug: "fundraising-finance",
        icon: <SquareStackIcon />,
        status: "featured",
        duration: "1 hour",
        languages: [],
        tools: ["Codebase"],
        instructors: ["Michael Martin", "Doro Unger-Lee", "Nicolas Arnedo"],
        category: "Codebase",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase_EntrepreneurAcademy_Certificate_Fundraising.pdf"
    },
    {
        name: "Encrypted ERC",
        description: "Learn the basics on what is an encrypted ERC token and how to use it",
        slug: "encrypted-erc",
        icon: <SquareCode />,
        duration: "3 hour",
        status: "featured",
        tools: [],
        languages: ["Solidity"],
        instructors: ["Alejandro Soto"],
        category: "Smart Contract Development",
        certificateTemplate: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf"
    },
    /*{
        name:"Chainlink VRF with Interchain Messaging ",
        description:"Utilize Interchain Messaging to make Chainlink VRF available on any blockchain in the Avalanche Network",
        slug:"teleporter-chainlink-vrf",
        icon: Dice3Icon,
        status: "featured",
        duration: "2.5 hours",
        tools: ["Teleporter", "Chainlink VRF"],
        languages: ["Solidity"]
     },
     {
        name:"HyperSDK",
        description:"Learn to build customized Virtual Machines using our SDK",
        slug:"hypersdk",
        icon: Blocks,
        duration: "4 hours",
        tools: ["Avalanche-CLI"],
        languages: ["Go"]
     },*/
];

const ecosystemCourses: Course[] = [
    /*{
        name:"Run a Gogopool Minipool",
        description:"A Minipool represents a validator that is jointly funded equally by AVAX borrowed from liquid stakers and AVAX contribution from the minipool operator. Thanks to Minipool design architecture, users can become validators on the Avalanche network with nearly half the usual AVAX requirement.",
        slug:"gogopool-minipool",
        icon: Blocks,
        duration: "2 hours",
        tools: ["Avalanche-CLI"],
        languages: ["Go"]
   },
   {
        name:"Use Safe on an Avalanche Chain",
        description:"Secure your multi-sig wallet with Safe on a Avalanche L1.",
        slug:"safe-on-an-avalanche-chain",
        icon: Blocks,
        duration: "4 hours",
        tools: ["Avalanche-CLI"],
        languages: ["Go"]
   }*/
];

const codebaseEntrepreneurCourses = officialCourses.filter((course) => course.category === "Codebase");

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
    
    codebaseEntrepreneurCourses.forEach(course => {
        if (course.certificateTemplate) {
            mapping[course.slug] = course.name;
        }
    });
    
    return mapping;
};

export default {
    official: officialCourses.filter((course) => ["normal", "featured"].includes(course.status) && course.category !== "Codebase"),
    official_featured: officialCourses.filter((course) => course.status === "featured" && course.category !== "Codebase"),
    codebaseEntrepreneur: codebaseEntrepreneurCourses,
    ecosystem: ecosystemCourses,
};


