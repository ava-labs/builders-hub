"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { ArrowRight, ChevronDown, GraduationCap, BookOpen, Shield } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

// CourseNode interface definition
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

// Import configs
import { avalancheLearningPaths, avalancheCategoryStyles } from './learning-path-configs/avalanche.config';
import { entrepreneurLearningPaths, entrepreneurCategoryStyles } from './learning-path-configs/entrepreneur.config';
import { blockchainLearningPaths, blockchainCategoryStyles } from './learning-path-configs/blockchain.config';

interface LearningTreeProps {
  pathType?: 'avalanche' | 'entrepreneur' | 'blockchain';
}

export default function LearningTree({ pathType = 'avalanche' }: LearningTreeProps) {
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const isMobile = useIsMobile();

  // Detect dark mode
  React.useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Select the appropriate learning paths and styles based on pathType
  const learningPaths = pathType === 'avalanche' 
    ? avalancheLearningPaths 
    : pathType === 'blockchain' 
    ? blockchainLearningPaths 
    : entrepreneurLearningPaths;
  const categoryStyles = pathType === 'avalanche' 
    ? avalancheCategoryStyles 
    : pathType === 'blockchain' 
    ? blockchainCategoryStyles 
    : entrepreneurCategoryStyles;

  const resolveSlug = (slug: string) => {
    if (pathType === 'entrepreneur') {
      const cleanSlug = slug.replace(/^entrepreneur\//, '');
      return `/academy/entrepreneur/${cleanSlug}`;
    }
    return `/academy/${slug}`;
  };

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
  const maxY = Math.max(...learningPaths.map(node => node.position.y)) + 250;

  // Legend component
  const Legend = ({ isMobile = false, vertical = false }: { isMobile?: boolean; vertical?: boolean }) => (
    <div className={
      isMobile 
        ? "mt-8 grid grid-cols-2 gap-3" 
        : vertical 
        ? "flex flex-col gap-10" 
        : "flex flex-wrap gap-6 justify-center"
    }>
      {Object.entries(categoryStyles).map(([category, style]) => {
        const Icon = style.icon;
        const isHovered = hoveredCategory === category;
        return (
          <div 
            key={category} 
            className={cn(
              "flex items-center gap-2 cursor-pointer transition-all duration-200",
              isHovered && "scale-110"
            )}
            onMouseEnter={() => setHoveredCategory(category)}
            onMouseLeave={() => setHoveredCategory(null)}
          >
            <div className={cn(
              isMobile ? "w-6 h-6" : "w-8 h-8",
              "rounded-full bg-gradient-to-br flex items-center justify-center shadow-sm transition-all duration-200",
              isMobile && "flex-shrink-0",
              style.gradient,
              isHovered && "shadow-lg scale-110"
            )}>
              <Icon className={isMobile ? "w-3 h-3 text-white" : "w-4 h-4 text-white"} />
            </div>
            <span className={cn(
              isMobile ? "text-xs" : "text-sm",
              "font-medium text-zinc-600 dark:text-zinc-400 transition-colors duration-200",
              isHovered && "text-zinc-900 dark:text-zinc-100"
            )}>{style.label || category}</span>
          </div>
        );
      })}
    </div>
  );

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
            const cardHeight = 110;

            // Lines should connect from bottom of parent to top of child
            const parentBottomY = parentNode.position.y + cardHeight;
            const childTopY = node.position.y;

            // Calculate control points for curved path
            const midY = (parentBottomY + childTopY) / 2;

            // Adjust the end point to account for arrow marker
            const adjustedChildTopY = childTopY + (isActive ? 6 : 5); // Account for marker size

            // Create a curved path
            const pathData = `M ${parentCenterX} ${parentBottomY} C ${parentCenterX} ${midY}, ${childCenterX} ${midY}, ${childCenterX} ${adjustedChildTopY}`;
            
            const inactiveMarker = isDarkMode ? "url(#arrow-inactive-dark)" : "url(#arrow-inactive-light)";
            const activeMarker = isDarkMode ? "url(#arrow-active-dark)" : "url(#arrow-active-light)";
            
            connections.push(
              <path
                key={`${depId}-${node.id}`}
                d={pathData}
                fill="none"
                stroke={isActive ? (isDarkMode ? "rgb(212, 212, 216)" : "rgb(161, 161, 170)") : isDarkMode ? "rgb(113, 113, 122)" : "rgb(226, 232, 240)"}
                strokeWidth={isActive ? "1.5" : "1"}
                opacity={isActive ? "1" : isDarkMode ? "0.6" : "0.5"}
                className="transition-all duration-700 ease-in-out"
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={isActive ? activeMarker : inactiveMarker}
              />
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
            const isCategoryHovered = hoveredCategory === node.category;

            return (
              <div key={node.id} className="relative">
                {/* Connection line from previous course */}
                {index > 0 && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <svg width="16" height="16" viewBox="0 0 16 16" className="text-zinc-400 dark:text-zinc-600">
                      <path
                        d="M8 2 L8 10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                      />
                      <path
                        d="M4 8 L8 12 L12 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )}

                <Link
                  href={resolveSlug(node.slug)}
                  className="block relative group"
                >
                  <div
                    className={cn(
                      "relative w-full p-4 rounded-xl transition-all duration-300",
                      "bg-white dark:bg-zinc-900",
                      "border-2 dark:border-zinc-800",
                      "shadow-sm active:shadow-lg",
                      isCategoryHovered
                        ? "shadow-2xl scale-[1.075]"
                        : "border-zinc-200 active:scale-[0.98]",
                      style?.lightBg,
                      style?.darkBg
                    )}
                    style={
                      isCategoryHovered
                        ? {
                            boxShadow: `0 25px 50px -12px ${style?.gradient.includes('blue') ? 'rgba(59, 130, 246, 0.4)' : style?.gradient.includes('purple') ? 'rgba(168, 85, 247, 0.4)' : style?.gradient.includes('emerald') ? 'rgba(16, 185, 129, 0.4)' : style?.gradient.includes('red') ? 'rgba(239, 68, 68, 0.4)' : style?.gradient.includes('orange') ? 'rgba(249, 115, 22, 0.4)' : style?.gradient.includes('yellow') ? 'rgba(234, 179, 8, 0.4)' : 'rgba(99, 102, 241, 0.4)'}, 0 0 0 4px ${style?.gradient.includes('blue') ? 'rgba(59, 130, 246, 0.15)' : style?.gradient.includes('purple') ? 'rgba(168, 85, 247, 0.15)' : style?.gradient.includes('emerald') ? 'rgba(16, 185, 129, 0.15)' : style?.gradient.includes('red') ? 'rgba(239, 68, 68, 0.15)' : style?.gradient.includes('orange') ? 'rgba(249, 115, 22, 0.15)' : style?.gradient.includes('yellow') ? 'rgba(234, 179, 8, 0.15)' : 'rgba(99, 102, 241, 0.15)'}`
                          }
                        : undefined
                    }
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
          {/* Define arrow markers */}
          <defs>
            {/* Light mode inactive arrow */}
            <marker
              id="arrow-inactive-light"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill="rgb(226, 232, 240)"
                opacity="0.3"
              />
            </marker>
            {/* Dark mode inactive arrow */}
            <marker
              id="arrow-inactive-dark"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill="rgb(113, 113, 122)"
                opacity="0.6"
              />
            </marker>
            {/* Active arrow for light mode */}
            <marker
              id="arrow-active-light"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill="rgb(161, 161, 170)"
              />
            </marker>
            {/* Active arrow for dark mode */}
            <marker
              id="arrow-active-dark"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill="rgb(212, 212, 216)"
              />
            </marker>
          </defs>
          {drawConnections()}
        </svg>

        {/* Render nodes */}
        {learningPaths.map((node) => {
          const style = categoryStyles[node.category as keyof typeof categoryStyles];
          const Icon = style?.icon || BookOpen;
          const isHighlighted = highlightedNodes.has(node.id);
          const isCategoryHovered = hoveredCategory === node.category;

          return (
            <div
              key={node.id}
              className="absolute flex justify-center"
              style={{
                left: `${node.position.x}%`,
                top: `${node.position.y}px`,
                transform: 'translateX(-50%)',
                width: '280px',
                zIndex: isHighlighted || isCategoryHovered ? 20 : 10
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <Link
                href={resolveSlug(node.slug)}
                className="block relative group w-full"
              >
                <div
                  className={cn(
                    "relative w-full p-5 rounded-2xl transition-all duration-300 min-height-[110px]",
                    "bg-white dark:bg-zinc-900",
                    "border-2 dark:border-zinc-800",
                    "shadow-sm",
                    isHighlighted || isCategoryHovered
                      ? "shadow-2xl scale-[1.025]"
                      : "border-zinc-200 hover:shadow-lg hover:scale-[1.02] hover:border-zinc-300 dark:hover:border-zinc-700",
                    style?.lightBg,
                    style?.darkBg
                  )}
                  style={
                    isHighlighted || isCategoryHovered
                      ? {
                          boxShadow: `0 25px 50px -12px ${style?.gradient.includes('blue') ? 'rgba(59, 130, 246, 0.4)' : style?.gradient.includes('purple') ? 'rgba(168, 85, 247, 0.4)' : style?.gradient.includes('emerald') ? 'rgba(16, 185, 129, 0.4)' : style?.gradient.includes('red') ? 'rgba(239, 68, 68, 0.4)' : style?.gradient.includes('orange') ? 'rgba(249, 115, 22, 0.4)' : style?.gradient.includes('yellow') ? 'rgba(234, 179, 8, 0.4)' : 'rgba(99, 102, 241, 0.4)'}, 0 0 0 4px ${style?.gradient.includes('blue') ? 'rgba(59, 130, 246, 0.15)' : style?.gradient.includes('purple') ? 'rgba(168, 85, 247, 0.15)' : style?.gradient.includes('emerald') ? 'rgba(16, 185, 129, 0.15)' : style?.gradient.includes('red') ? 'rgba(239, 68, 68, 0.15)' : style?.gradient.includes('orange') ? 'rgba(249, 115, 22, 0.15)' : style?.gradient.includes('yellow') ? 'rgba(234, 179, 8, 0.15)' : 'rgba(99, 102, 241, 0.15)'}`
                        }
                      : undefined
                  }
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
    </>
  );

  return (
    <>
      {/* Vertical Legend on far left of screen - positioned absolutely relative to viewport */}
      <div 
        className="hidden lg:block absolute z-10"
        style={{
          left: '1rem',
          top: '30%',
          transform: 'translateY(-50%)',
          marginLeft: 'calc(-50vw + 50%)'
        }}
      >
        <Legend isMobile={false} vertical={true} />
      </div>

      <div className="relative w-full">
        {/* Mobile Layout - visible on small screens, hidden on lg and up */}
        <div className="block lg:hidden">
          {/* Legend at top for mobile */}
          <div className="mb-8">
            <Legend isMobile={true} />
          </div>
          <MobileLayout />
        </div>

        {/* Desktop Layout - hidden on small screens, visible on lg and up */}
        <div className="hidden lg:block">
          <DesktopLayout />
        </div>
      </div>
    </>
  );
} 