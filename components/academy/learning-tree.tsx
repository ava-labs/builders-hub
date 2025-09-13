"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { ArrowRight, ChevronDown, GraduationCap, BookOpen } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

// Import configs
import { avalancheLearningPaths, avalancheCategoryStyles } from './learning-path-configs/avalanche-developer.config';
import { entrepreneurLearningPaths, entrepreneurCategoryStyles } from './learning-path-configs/codebase-entrepreneur.config';
import type { CourseNode } from './learning-path-configs/avalanche-developer.config';

interface LearningTreeProps {
  pathType?: 'avalanche' | 'entrepreneur';
}

export default function LearningTree({ pathType = 'avalanche' }: LearningTreeProps) {
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null);
  const isMobile = useIsMobile();

  // Select the appropriate learning paths and styles based on pathType
  const learningPaths = pathType === 'avalanche' ? avalancheLearningPaths : entrepreneurLearningPaths;
  const categoryStyles = pathType === 'avalanche' ? avalancheCategoryStyles : entrepreneurCategoryStyles;

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
  const Legend = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={isMobile ? "mt-8 grid grid-cols-2 gap-3" : "flex flex-wrap gap-6 justify-center"}>
      {Object.entries(categoryStyles).map(([category, style]) => {
        const Icon = style.icon;
        return (
          <div key={category} className="flex items-center gap-2">
            <div className={cn(
              isMobile ? "w-6 h-6" : "w-8 h-8",
              "rounded-full bg-gradient-to-br flex items-center justify-center shadow-sm",
              isMobile && "flex-shrink-0",
              style.gradient
            )}>
              <Icon className={isMobile ? "w-3 h-3 text-white" : "w-4 h-4 text-white"} />
            </div>
            <span className={cn(
              isMobile ? "text-xs" : "text-sm",
              "font-medium text-zinc-600 dark:text-zinc-400"
            )}>{category}</span>
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

            connections.push(
              <path
                key={`${depId}-${node.id}`}
                d={pathData}
                fill="none"
                stroke={isActive ? "rgb(99, 102, 241)" : "rgb(226, 232, 240)"}
                strokeWidth={isActive ? "1.5" : "1"}
                opacity={isActive ? "1" : "0.5"}
                className="transition-all duration-700 ease-in-out"
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={isActive ? "url(#arrow-active)" : "url(#arrow-inactive)"}
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
            <marker
              id="arrow-inactive"
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
                opacity="0.5"
              />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill="rgb(99, 102, 241)"
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

          return (
            <div
              key={node.id}
              className="absolute flex justify-center"
              style={{
                left: `${node.position.x}%`,
                top: `${node.position.y}px`,
                transform: 'translateX(-50%)',
                width: '280px',
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
                    "relative w-full p-5 rounded-2xl transition-all duration-300 min-height-[110px]",
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
    </>
  );

  return (
    <div className="relative w-full">
      {/* Legend at top for all learning trees */}
      <div className="mb-8">
        <Legend isMobile={false} />
      </div>

      {/* Mobile Layout - visible on small screens, hidden on lg and up */}
      <div className="block lg:hidden">
        <MobileLayout />
      </div>

      {/* Desktop Layout - hidden on small screens, visible on lg and up */}
      <div className="hidden lg:block">
        <DesktopLayout />
      </div>
    </div>

  );
} 