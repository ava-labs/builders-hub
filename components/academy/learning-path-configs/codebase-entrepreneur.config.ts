import { BookOpen, Users, Lightbulb, Coins } from 'lucide-react';

export interface CourseNode {
    id: string;
    name: string;
    description: string;
    slug: string;
    category: string;
    position: { x: number; y: number };
    dependencies?: string[];
    mobileOrder: number;
}

export const entrepreneurLearningPaths: CourseNode[] = [
    // Foundation Layer
    {
        id: "codebase-foundation",
        name: "Level 1: Foundations of a Web3 Venture",
        description: "Establishing essential blockchain and business fundamentals.",
        slug: "foundations-web3-venture",
        category: "Fundamentals",
        position: { x: 50, y: 0 },
        mobileOrder: 1
    },

    // Second Layer  
    {
        id: "codebase-gtm",
        name: "Level 2: Go To Market Strategist",
        description: "Master go-to-market strategies for Web3 products and services.",
        slug: "go-to-market",
        category: "Business Strategy",
        dependencies: ["codebase-foundation"],
        position: { x: 30, y: 200 },
        mobileOrder: 2
    },
    {
        id: "codebase-web3-community-architect",
        name: "Level 3: Web3 Community Architect",
        description: "Learn to build and manage thriving Web3 communities.",
        slug: "web3-community-architect",
        category: "Community",
        dependencies: ["codebase-foundation"],
        position: { x: 70, y: 200 },
        mobileOrder: 3
    },

    // Third Layer
    {
        id: "codebase-fundraising",
        name: "Level 4: Fundraising & Finance Pro",
        description: "Master fundraising strategies and financial management in Web3.",
        slug: "fundraising-finance",
        category: "Finance",
        dependencies: ["codebase-web3-community-architect", "codebase-gtm"],
        position: { x: 50, y: 400 },
        mobileOrder: 4
    }
];

export const entrepreneurCategoryStyles = {
    "Fundamentals": {
        gradient: "from-blue-500 to-blue-600",
        icon: BookOpen,
        lightBg: "bg-blue-50",
        darkBg: "dark:bg-blue-950/30"
    },
    "Community": {
        gradient: "from-purple-500 to-purple-600",
        icon: Users,
        lightBg: "bg-purple-50",
        darkBg: "dark:bg-purple-950/30"
    },
    "Business Strategy": {
        gradient: "from-emerald-500 to-emerald-600",
        icon: Lightbulb,
        lightBg: "bg-emerald-50",
        darkBg: "dark:bg-emerald-950/30"
    },
    "Finance": {
        gradient: "from-yellow-500 to-yellow-600",
        icon: Coins,
        lightBg: "bg-yellow-50",
        darkBg: "dark:bg-yellow-950/30"
    }
};
