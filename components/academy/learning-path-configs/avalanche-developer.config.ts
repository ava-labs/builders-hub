import { BookOpen, ArrowLeftRight, Layers, Coins, Code } from 'lucide-react';
import type { CourseNode } from '../learning-tree';

export const avalancheLearningPaths: CourseNode[] = [
    // Foundation Layer
    {
        id: "blockchain-fundamentals",
        name: "Blockchain Fundamentals",
        description: "Start here to learn about blockchain and solidity basics",
        slug: "blockchain-fundamentals",
        category: "Fundamentals",
        position: { x: 50, y: 0 },
        mobileOrder: 1
    },

    // Second Layer - Avalanche Fundamentals
    {
        id: "avalanche-fundamentals",
        name: "Avalanche Fundamentals",
        description: "Learn about Avalanche Consensus, Multi-Chain Architecture, and VMs",
        slug: "avalanche-fundamentals",
        category: "Fundamentals",
        dependencies: ["blockchain-fundamentals"],
        position: { x: 50, y: 150 },
        mobileOrder: 2
    },

    // Third Layer - Branching paths
    {
        id: "interchain-messaging",
        name: "Interchain Messaging",
        description: "Build apps leveraging Avalanche's Interchain Messaging",
        slug: "interchain-messaging",
        category: "Interoperability",
        dependencies: ["avalanche-fundamentals"],
        position: { x: 15, y: 350 },
        mobileOrder: 3
    },
    {
        id: "permissioned-l1s",
        name: "Permissioned L1s",
        description: "Create and manage permissioned blockchains with Proof of Authority",
        slug: "permissioned-l1s",
        category: "L1 Development",
        dependencies: ["avalanche-fundamentals"],
        position: { x: 40, y: 350 },
        mobileOrder: 7
    },
    {
        id: "l1-native-tokenomics",
        name: "L1 Native Tokenomics",
        description: "Design L1 economics with custom token, native minting rights and transaction fees",
        slug: "l1-native-tokenomics",
        category: "L1 Tokenomics",
        dependencies: ["avalanche-fundamentals"],
        position: { x: 65, y: 350 },
        mobileOrder: 6
    },
    {
        id: "customizing-evm",
        name: "Customizing the EVM",
        description: "Add custom precompiles and configure the EVM",
        slug: "customizing-evm",
        category: "VM Customization",
        dependencies: ["avalanche-fundamentals"],
        position: { x: 90, y: 350 },
        mobileOrder: 8
    },

    // Fourth Layer - Advanced topics (adjusted for no overlap)
    {
        id: "interchain-token-transfer",
        name: "Interchain Token Transfer",
        description: "Transfer assets between chains using Interchain Messaging",
        slug: "interchain-token-transfer",
        category: "Interoperability",
        dependencies: ["interchain-messaging"],
        position: { x: 5, y: 550 },
        mobileOrder: 4
    },
    {
        id: "icm-chainlink",
        name: "Chainlink via ICM",
        description: "Use Chainlink services on an L1 through the Interchain Messaging",
        slug: "icm-chainlink",
        category: "Interoperability",
        dependencies: ["interchain-messaging"],
        position: { x: 35, y: 550 },
        mobileOrder: 5
    },
];

export const avalancheCategoryStyles = {
    "Fundamentals": {
        gradient: "from-blue-500 to-blue-600",
        icon: BookOpen,
        lightBg: "bg-blue-50",
        darkBg: "dark:bg-blue-950/30"
    },
    "Interoperability": {
        gradient: "from-purple-500 to-purple-600",
        icon: ArrowLeftRight,
        lightBg: "bg-purple-50",
        darkBg: "dark:bg-purple-950/30"
    },
    "L1 Development": {
        gradient: "from-emerald-500 to-emerald-600",
        icon: Layers,
        lightBg: "bg-emerald-50",
        darkBg: "dark:bg-emerald-950/30"
    },
    "L1 Tokenomics": {
        gradient: "from-red-400 to-red-500",
        icon: Coins,
        lightBg: "bg-red-50",
        darkBg: "dark:bg-red-950/30"
    },
    "VM Customization": {
        gradient: "from-orange-500 to-orange-600",
        icon: Code,
        lightBg: "bg-orange-50",
        darkBg: "dark:bg-orange-950/30"
    }
};
