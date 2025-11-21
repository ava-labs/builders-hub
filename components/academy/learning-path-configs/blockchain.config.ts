import { BookOpen, Code, Shield } from 'lucide-react';
import type { CourseNode } from '../learning-tree';

export const blockchainLearningPaths: CourseNode[] = [
    // Foundation Layer
    {
        id: "blockchain-fundamentals",
        name: "Blockchain Fundamentals",
        description: "Start here to learn about blockchain and solidity basics",
        slug: "blockchain/blockchain-fundamentals",
        category: "Fundamentals",
        position: { x: 50, y: 0 },
        mobileOrder: 1
    },
    // Second Layer - Intro to Solidity
    {
        id: "intro-to-solidity",
        name: "Intro to Solidity",
        description: "Start here to learn about Solidity basics with Foundry",
        slug: "blockchain/solidity-foundry",
        category: "Development",
        dependencies: ["blockchain-fundamentals"],
        position: { x: 50, y: 250 },
        mobileOrder: 2
    },
    // Third Layer - Encrypted ERC
    {
        id: "encrypted-erc",
        name: "Encrypted ERC",
        description: "Learn about eERC tokens to add privacy to your applications",
        slug: "blockchain/encrypted-erc",
        category: "Privacy",
        dependencies: ["intro-to-solidity"],
        position: { x: 50, y: 500 },
        mobileOrder: 3
    },
];

export const blockchainCategoryStyles = {
    "Fundamentals": {
        gradient: "from-blue-500 to-blue-600",
        icon: BookOpen,
        lightBg: "bg-blue-50",
        darkBg: "dark:bg-blue-950",
        label: "Fundamentals"
    },
    "Development": {
        gradient: "from-orange-500 to-orange-600",
        icon: Code,
        lightBg: "bg-orange-50",
        darkBg: "dark:bg-orange-950",
        label: "Development"
    },
    "Privacy": {
        gradient: "from-indigo-500 to-indigo-600",
        icon: Shield,
        lightBg: "bg-indigo-50",
        darkBg: "dark:bg-indigo-950",
        label: "Privacy"
    },
};

