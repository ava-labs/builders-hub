import { BookOpen, ArrowLeftRight, Layers, Coins, Code, Shield } from 'lucide-react';
import type { CourseNode } from '../learning-tree';

export const avalancheLearningPaths: CourseNode[] = [
    // Foundation Layer - Avalanche Fundamentals
    {
        id: "avalanche-fundamentals",
        name: "Avalanche Fundamentals",
        description: "Learn about Avalanche Consensus, Multi-Chain Architecture, and VMs",
        slug: "avalanche-l1/avalanche-fundamentals",
        category: "Fundamentals",
        position: { x: 50, y: 0 },
        mobileOrder: 1
    },
    // Second Layer - Branching paths
    {
        id: "customizing-evm",
        name: "Customizing the EVM",
        description: "Add custom precompiles and configure the EVM",
        slug: "avalanche-l1/customizing-evm",
        category: "VM Customization",
        dependencies: ["avalanche-fundamentals"],
        position: { x: 87.5, y: 250 },
        mobileOrder: 2
    },

    // Third Layer - Branching paths
    {
        id: "interchain-messaging",
        name: "Interchain Messaging",
        description: "Build apps leveraging Avalanche's Interchain Messaging",
        slug: "avalanche-l1/interchain-messaging",
        category: "Interoperability",
        dependencies: ["avalanche-fundamentals"],
        position: { x: 62.5, y: 250 },
        mobileOrder: 3
    },
    {
        id: "permissioned-l1s",
        name: "Permissioned L1s",
        description: "Create and manage permissioned blockchains with Proof of Authority",
        slug: "avalanche-l1/permissioned-l1s",
        category: "L1 Development",
        dependencies: ["avalanche-fundamentals"],
        position: { x: 12.5, y: 250 },
        mobileOrder: 6
    },
    {
        id: "l1-native-tokenomics",
        name: "L1 Native Tokenomics",
        description: "Design L1 economics with custom token, native minting rights and transaction fees",
        slug: "avalanche-l1/l1-native-tokenomics",
        category: "L1 Tokenomics",
        dependencies: ["avalanche-fundamentals"],
        position: { x: 37.5, y: 250 },
        mobileOrder: 7
    },
    // Third Layer - Advanced topics
    {
        id: "interchain-token-transfer",
        name: "Interchain Token Transfer",
        description: "Transfer assets between chains using Interchain Messaging",
        slug: "avalanche-l1/interchain-token-transfer",
        category: "Interoperability",
        dependencies: ["interchain-messaging"],
        position: { x: 82.5, y: 500 },
        mobileOrder: 4
    },
    {
        id: "erc20-to-erc20-bridge",
        name: "ERC20 to ERC20 Bridge",
        description: "Bridge ERC20 tokens between chains using Interchain Token Transfer",
        slug: "avalanche-l1/erc20-bridge",
        category: "Interoperability",
        dependencies: ["interchain-messaging", "l1-native-tokenomics"],
        position: { x: 52.5, y: 500 },
        mobileOrder: 5
    },
    {
        id: "permissionless-l1s",
        name: "Permissionless L1s",
        description: "Create and manage permissionless blockchains with Proof of Stake",
        slug: "avalanche-l1/permissionless-l1s",
        category: "L1 Development",
        dependencies: ["permissioned-l1s", "l1-native-tokenomics"],
        position: { x: 22.5, y: 500 },
        mobileOrder: 8
    },
];

export const avalancheCategoryStyles = {
    "Fundamentals": {
        gradient: "from-blue-500 to-blue-600",
        icon: BookOpen,
        lightBg: "bg-blue-50",
        darkBg: "dark:bg-blue-950",
        label: "Fundamentals"
    },
    "Interoperability": {
        gradient: "from-purple-500 to-purple-600",
        icon: ArrowLeftRight,
        lightBg: "bg-purple-50",
        darkBg: "dark:bg-purple-950",
        label: "Interoperability"
    },
    "L1 Development": {
        gradient: "from-emerald-500 to-emerald-600",
        icon: Layers,
        lightBg: "bg-emerald-50",
        darkBg: "dark:bg-emerald-950",
        label: "L1 Development"
    },
    "L1 Tokenomics": {
        gradient: "from-red-400 to-red-500",
        icon: Coins,
        lightBg: "bg-red-50",
        darkBg: "dark:bg-red-950",
        label: "L1 Tokenomics"
    },
    "VM Customization": {
        gradient: "from-orange-500 to-orange-600",
        icon: Code,
        lightBg: "bg-orange-50",
        darkBg: "dark:bg-orange-950",
        label: "VM Customization"
    },
};
