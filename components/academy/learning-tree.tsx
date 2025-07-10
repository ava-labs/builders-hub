"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { ArrowRight, BookOpen, Code, Globe, Layers, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface CourseNode {
  id: string;
  name: string;
  description: string;
  slug: string;
  category: string;
  dependencies?: string[];
  position: { x: number; y: number };
  mobileOrder?: number;
}

const learningPaths: CourseNode[] = [
  // Foundation Layer
  {
    id: "blockchain-fundamentals",
    name: "Blockchain Fundamentals",
    description: "Start here to understand blockchain basics",
    slug: "blockchain-fundamentals",
    category: "Fundamentals",
    position: { x: 50, y: 0 },
    mobileOrder: 1
  },
  
  // Second Layer - Avalanche Fundamentals
  {
    id: "avalanche-fundamentals",
    name: "Avalanche Fundamentals",
    description: "Learn Avalanche consensus, Multi-Chain Architecture, and VMs",
    slug: "avalanche-fundamentals",
    category: "Fundamentals",
    dependencies: ["blockchain-fundamentals"],
    position: { x: 50, y: 250 },
    mobileOrder: 2
  },
  
  // Third Layer - Branching paths
  {
    id: "interchain-messaging",
    name: "Interchain Messaging",
    description: "Build cross-chain dApps",
    slug: "interchain-messaging",
    category: "Interoperability",
    dependencies: ["avalanche-fundamentals"],
    position: { x: 20, y: 500 },
    mobileOrder: 3
  },
  {
    id: "customizing-evm",
    name: "Customizing the EVM",
    description: "Add custom precompiles and configure the EVM",
    slug: "customizing-evm",
    category: "L1 Development",
    dependencies: ["avalanche-fundamentals"],
    position: { x: 50, y: 500 },
    mobileOrder: 4
  },
  {
    id: "solidity-foundry",
    name: "Solidity with Foundry",
    description: "Develop smart contracts with Foundry",
    slug: "solidity-foundry",
    category: "Smart Contract Development",
    dependencies: ["avalanche-fundamentals"],
    position: { x: 80, y: 500 },
    mobileOrder: 5
  },
  
  // Fourth Layer - Advanced topics (adjusted for no overlap)
  {
    id: "interchain-token-transfer",
    name: "Interchain Token Transfer",
    description: "Transfer assets between chains using ICM",
    slug: "interchain-token-transfer",
    category: "Interoperability",
    dependencies: ["interchain-messaging"],
    position: { x: 5, y: 750 },
    mobileOrder: 6
  },
  {
    id: "icm-chainlink",
    name: "Chainlink via ICM",
    description: "Integrate Chainlink services to your L1",
    slug: "icm-chainlink",
    category: "Interoperability",
    dependencies: ["interchain-messaging"],
    position: { x: 35, y: 750 },
    mobileOrder: 7
  },
  {
    id: "avacloudapis",
    name: "AvaCloud APIs",
    description: "Build web apps",
    slug: "avacloudapis",
    category: "Smart Contract Development",
    dependencies: ["solidity-foundry"],
    position: { x: 80, y: 750 },
    mobileOrder: 8
  },
  
  // Fifth Layer - L1 Development courses moved down
  {
    id: "l1-tokenomics",
    name: "L1 Tokenomics",
    description: "Design L1 economics",
    slug: "l1-tokenomics",
    category: "L1 Development",
    dependencies: ["customizing-evm"],
    position: { x: 35, y: 1000 },
    mobileOrder: 9
  },
  {
    id: "l1-validator-management",
    name: "L1 Validator Management",
    description: "Manage validators for your L1",
    slug: "l1-validator-management",
    category: "L1 Development",
    dependencies: ["customizing-evm"],
    position: { x: 65, y: 1000 },
    mobileOrder: 10
  }
];

const categoryStyles = {
  "Fundamentals": {
    gradient: "from-blue-500 to-blue-600",
    icon: BookOpen,
    lightBg: "bg-blue-50",
    darkBg: "dark:bg-blue-950/30"
  },
  "Interoperability": {
    gradient: "from-purple-500 to-purple-600",
    icon: Globe,
    lightBg: "bg-purple-50",
    darkBg: "dark:bg-purple-950/30"
  },
  "L1 Development": {
    gradient: "from-emerald-500 to-emerald-600",
    icon: Layers,
    lightBg: "bg-emerald-50",
    darkBg: "dark:bg-emerald-950/30"
  },
  "Smart Contract Development": {
    gradient: "from-orange-500 to-orange-600",
    icon: Code,
    lightBg: "bg-orange-50",
    darkBg: "dark:bg-orange-950/30"
  }
};

export default function LearningTree() {
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null);
  const isMobile = useIsMobile();

  // Function to get all ancestor nodes (dependencies) of a given node
  const getAncestors = (nodeId: string, ancestors: Set<string> = new Set()): Set<string> => {
    const node = learningPaths.find(n => n.id === nodeId);
    if (!node || !node.dependencies) return ancestors;
    
    node.dependencies.forEach(depId => {
      ancestors.add(depId);
      getAncestors(depId, ancestors);
    });
    
    return ancestors;
  };

  // Get all nodes that should be highlighted when hovering
  const highlightedNodes = React.useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    
    const highlighted = new Set<string>();
    highlighted.add(hoveredNode);
    
    // Add all ancestors
    const ancestors = getAncestors(hoveredNode);
    ancestors.forEach(id => highlighted.add(id));
    
    return highlighted;
  }, [hoveredNode]);

  // Calculate SVG dimensions based on node positions
  const maxX = Math.max(...learningPaths.map(node => node.position.x)) + 10;
  const maxY = Math.max(...learningPaths.map(node => node.position.y)) + 200;
  
  // Get unique Y positions (levels) and their categories
  const levels = [...new Set(learningPaths.map(node => node.position.y))].sort((a, b) => a - b);
  const levelCategories = levels.map(y => {
    const nodesAtLevel = learningPaths.filter(node => node.position.y === y);
    const categories = [...new Set(nodesAtLevel.map(node => node.category))];
    return { y, categories };
  });

  const drawConnections = () => {
    const connections: React.JSX.Element[] = [];
    
    learningPaths.forEach((node) => {
      if (node.dependencies && node.dependencies.length > 0) {
        node.dependencies.forEach((depId) => {
          const parentNode = learningPaths.find(n => n.id === depId);
          if (parentNode) {
            // Check if this connection should be highlighted
            const isActive = highlightedNodes.has(node.id) && highlightedNodes.has(depId);
            
            // Calculate the center points of the nodes
            const parentCenterX = parentNode.position.x;
            const childCenterX = node.position.x;
            
            // Card dimensions
            const cardHeight = 120;
            
            // Lines should connect from bottom of parent to top of child
            const parentBottomY = parentNode.position.y + cardHeight;
            const childTopY = node.position.y;
            
            // Calculate control points for curved path
            const midY = (parentBottomY + childTopY) / 2;
            
            // Create a curved path
            const pathData = `M ${parentCenterX} ${parentBottomY} C ${parentCenterX} ${midY}, ${childCenterX} ${midY}, ${childCenterX} ${childTopY}`;
            
            connections.push(
              <g key={`${depId}-${node.id}`}>
                {/* Main path - thin and elegant */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={isActive ? "rgb(99, 102, 241)" : "rgb(226, 232, 240)"}
                  strokeWidth={isActive ? "1.5" : "1"}
                  opacity={isActive ? "1" : "0.5"}
                  className="transition-all duration-700 ease-in-out"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Arrow marker at the end */}
                {isActive && (
                  <circle
                    cx={childCenterX}
                    cy={childTopY}
                    r="2"
                    fill="rgb(99, 102, 241)"
                    className="transition-all duration-700 ease-in-out"
                  />
                )}
              </g>
            );
          }
        });
      }
    });
    
    return connections;
  };

  // Mobile layout component
  const MobileLayout = () => {
    const sortedPaths = [...learningPaths].sort((a, b) => (a.mobileOrder || 0) - (b.mobileOrder || 0));
    
    return (
      <div className="relative w-full px-4 py-6">
        <div className="space-y-4">
          {sortedPaths.map((node, index) => {
            const style = categoryStyles[node.category as keyof typeof categoryStyles];
            const Icon = style?.icon || BookOpen;
            
            return (
              <div key={node.id} className="relative">
                {/* Connection line from previous course */}
                {index > 0 && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />
                  </div>
                )}
                
                <Link
                  href={`/academy/${node.slug}`}
                  className="block relative group"
                >
                  <div
                    className={cn(
                      "relative w-full p-4 rounded-xl transition-all duration-300",
                      "bg-white dark:bg-zinc-900",
                      "border border-zinc-200 dark:border-zinc-800",
                      "shadow-sm active:shadow-lg",
                      "active:scale-[0.98]",
                      style?.lightBg,
                      style?.darkBg
                    )}
                  >
                    {/* Category icon */}
                    <div className={cn(
                      "absolute -top-2 -right-2 w-8 h-8 rounded-full",
                      "bg-gradient-to-br shadow-md",
                      "flex items-center justify-center",
                      "text-white",
                      style?.gradient
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    
                    {/* Content */}
                    <h4 className="font-semibold text-base mb-1 text-zinc-900 dark:text-white leading-tight pr-8">
                      {node.name}
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {node.description}
                    </p>
                    
                    {/* Mobile tap indicator */}
                    <div className="absolute bottom-3 right-3">
                      <ArrowRight className="w-4 h-4 text-zinc-400" />
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
        
        {/* Legend for mobile */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {Object.entries(categoryStyles).map(([category, style]) => {
            const Icon = style.icon;
            return (
              <div key={category} className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center shadow-sm flex-shrink-0",
                  style.gradient
                )}>
                  <Icon className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{category}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Desktop layout component (existing code)
  const DesktopLayout = () => (
    <>
      <div className="relative p-8 lg:p-12" style={{ minHeight: `${maxY}px` }}>
        {/* Render lines behind nodes */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 100 ${maxY}`}
          style={{ height: `${maxY}px`, zIndex: 1 }}
          preserveAspectRatio="none"
        >
          {drawConnections()}
        </svg>
        
        {/* Render nodes */}
        {learningPaths.map((node) => {
          const style = categoryStyles[node.category as keyof typeof categoryStyles];
          const Icon = style?.icon || BookOpen;
          const isHighlighted = highlightedNodes.has(node.id);
          
          return (
            <div
              key={node.id}
              className="absolute flex justify-center"
              style={{
                left: `${node.position.x}%`,
                top: `${node.position.y}px`,
                transform: 'translateX(-50%)',
                width: '260px',
                zIndex: isHighlighted ? 20 : 10
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <Link
                href={`/academy/${node.slug}`}
                className="block relative group w-full"
              >
                <div
                  className={cn(
                    "relative w-full p-5 rounded-2xl transition-all duration-300",
                    "bg-white dark:bg-zinc-900",
                    "border dark:border-zinc-800",
                    "shadow-sm",
                    isHighlighted 
                      ? "border-indigo-500 shadow-lg scale-[1.02]" 
                      : "border-zinc-200 hover:shadow-lg hover:scale-[1.02] hover:border-zinc-300 dark:hover:border-zinc-700",
                    style?.lightBg,
                    style?.darkBg
                  )}
                >
                  {/* Category icon */}
                  <div className={cn(
                    "absolute -top-3 -right-3 w-10 h-10 rounded-full",
                    "bg-gradient-to-br shadow-md",
                    "flex items-center justify-center",
                    "text-white",
                    style?.gradient
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  {/* Content */}
                  <h4 className="font-semibold text-base mb-2 text-zinc-900 dark:text-white leading-tight pr-8">
                    {node.name}
                  </h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {node.description}
                  </p>
                  
                  {/* Hover indicator */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-5 h-5 text-zinc-400" />
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="mt-8 flex flex-wrap gap-6 justify-center">
        {Object.entries(categoryStyles).map(([category, style]) => {
          const Icon = style.icon;
          return (
            <div key={category} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center shadow-sm",
                style.gradient
              )}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{category}</span>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="relative w-full">
      {isMobile ? <MobileLayout /> : <DesktopLayout />}
    </div>
  );
} 