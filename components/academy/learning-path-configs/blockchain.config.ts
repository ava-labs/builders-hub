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
    // Third Layer - NFT Deployment and Encrypted ERC
    {
        id: "nft-deployment",
        name: "NFT Deployment",
        description: "Learn how to create and deploy your own NFT collection",
        slug: "blockchain/nft-deployment",
        category: "Development",
        dependencies: ["intro-to-solidity"],
        position: { x: 20, y: 500 },
        mobileOrder: 3
    },
    {
        id: "x402-payment-infrastructure",
        name: "x402 Payments",
        description: "Instant & permissionless HTTP-native payments on Avalanche",
        slug: "blockchain/x402-payment-infrastructure",
        category: "Development",
        dependencies: ["intro-to-solidity"],
        position: { x: 50, y: 500 },
        mobileOrder: 4
    },
    {
        id: "encrypted-erc",
        name: "Encrypted ERC",
        description: "Learn about eERC tokens to add privacy to your applications",
        slug: "blockchain/encrypted-erc",
        category: "Privacy",
        dependencies: ["intro-to-solidity"],
        position: { x: 80, y: 500 },
        mobileOrder: 4
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

