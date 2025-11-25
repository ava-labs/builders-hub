"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";

interface ICMFlowData {
  sourceChain: string;
  sourceChainId: string;
  sourceLogo: string;
  sourceColor: string;
  targetChain: string;
  targetChainId: string;
  targetLogo: string;
  targetColor: string;
  messageCount: number;
}

interface ChainNode {
  id: string;
  name: string;
  logo: string;
  color: string;
  totalMessages: number;
  isSource: boolean;
}

interface ICMFlowResponse {
  flows: ICMFlowData[];
  sourceNodes: ChainNode[];
  targetNodes: ChainNode[];
  totalMessages: number;
  last_updated: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

interface Particle {
  id: number;
  flowIndex: number;
  progress: number;
  speed: number;
}

interface ICMFlowChartProps {
  data?: ICMFlowResponse | null;
  width?: number;
  height?: number;
  maxFlows?: number;
  showLabels?: boolean;
  animationEnabled?: boolean;
}

// Generate random stars for background
function generateStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 0.5 + Math.random() * 1.5,
    duration: 6 + Math.random() * 8,
    delay: Math.random() * 8,
  }));
}

// Lighten or darken a color
function adjustColor(color: string, amount: number): string {
  if (color.startsWith('hsl')) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const h = parseInt(match[1]);
      const s = parseInt(match[2]);
      const l = Math.min(100, Math.max(0, parseInt(match[3]) + amount));
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
  }
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(0, 2), 16) + amount * 2.55));
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(2, 4), 16) + amount * 2.55));
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(4, 6), 16) + amount * 2.55));
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
  return color;
}

// Calculate cubic bezier point
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const oneMinusT = 1 - t;
  return (
    oneMinusT * oneMinusT * oneMinusT * p0 +
    3 * oneMinusT * oneMinusT * t * p1 +
    3 * oneMinusT * t * t * p2 +
    t * t * t * p3
  );
}

export default function ICMFlowChart({
  data,
  width = 900,
  height = 500,
  maxFlows = 50,
  showLabels = true,
  animationEnabled = true,
}: ICMFlowChartProps) {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [hoveredFlow, setHoveredFlow] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  const stars = useMemo(() => generateStars(60), []);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Particle animation
  useEffect(() => {
    if (!animationEnabled || !data || data.flows.length === 0) return;

    // Initialize particles
    const initialParticles: Particle[] = [];
    const particlesPerFlow = 3;
    
    data.flows.slice(0, maxFlows).forEach((_, flowIndex) => {
      for (let i = 0; i < particlesPerFlow; i++) {
        initialParticles.push({
          id: flowIndex * particlesPerFlow + i,
          flowIndex,
          progress: Math.random(),
          speed: 0.001 + Math.random() * 0.002,
        });
      }
    });
    setParticles(initialParticles);

    const animate = (time: number) => {
      if (time - lastTimeRef.current > 16) { // ~60fps
        lastTimeRef.current = time;
        setParticles(prev => 
          prev.map(p => ({
            ...p,
            progress: (p.progress + p.speed) % 1,
          }))
        );
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animationEnabled, data, maxFlows]);

  if (!isMounted || !data) {
    return (
      <div 
        className="relative rounded-lg border border-gray-700 dark:border-gray-800 overflow-hidden animate-pulse"
        style={{ width, height }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
      </div>
    );
  }

  const isDark = resolvedTheme === 'dark';
  const flows = data.flows.slice(0, maxFlows);
  const totalMessages = data.totalMessages;
  
  // Layout calculations - compact mode for more chains
  const padding = { top: 30, right: 20, bottom: 15, left: 20 };
  const nodeWidth = 14;
  const nodeGap = 2;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Calculate unique source and target nodes from flows
  const sourceNodesMap = new Map<string, { name: string; color: string; logo: string; total: number }>();
  const targetNodesMap = new Map<string, { name: string; color: string; logo: string; total: number }>();
  
  flows.forEach(flow => {
    const sourceKey = flow.sourceChainId || flow.sourceChain;
    const targetKey = flow.targetChainId || flow.targetChain;
    
    if (!sourceNodesMap.has(sourceKey)) {
      sourceNodesMap.set(sourceKey, {
        name: flow.sourceChain,
        color: flow.sourceColor,
        logo: flow.sourceLogo,
        total: 0,
      });
    }
    sourceNodesMap.get(sourceKey)!.total += flow.messageCount;
    
    if (!targetNodesMap.has(targetKey)) {
      targetNodesMap.set(targetKey, {
        name: flow.targetChain,
        color: flow.targetColor,
        logo: flow.targetLogo,
        total: 0,
      });
    }
    targetNodesMap.get(targetKey)!.total += flow.messageCount;
  });
  
  const sourceNodes = Array.from(sourceNodesMap.entries())
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => b.total - a.total);
  
  const targetNodes = Array.from(targetNodesMap.entries())
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => b.total - a.total);
  
  // Calculate node heights based on message counts - scale to fit container
  const totalSourceMessages = sourceNodes.reduce((sum, n) => sum + n.total, 0);
  const totalTargetMessages = targetNodes.reduce((sum, n) => sum + n.total, 0);
  
  const minNodeHeight = 1;
  const sourceGapsTotal = (sourceNodes.length - 1) * nodeGap;
  const targetGapsTotal = (targetNodes.length - 1) * nodeGap;
  const sourceAvailableHeight = chartHeight - sourceGapsTotal;
  const targetAvailableHeight = chartHeight - targetGapsTotal;
  
  // Position nodes with compact layout
  const sourceNodePositions = new Map<string, { y: number; height: number; currentY: number }>();
  const targetNodePositions = new Map<string, { y: number; height: number; currentY: number }>();
  
  // Calculate heights proportionally to fill container - each node gets height based on its share of total messages
  const sourceHeights = sourceNodes.map(node => {
    const ratio = node.total / totalSourceMessages;
    return Math.max(minNodeHeight, ratio * sourceAvailableHeight);
  });
  const targetHeights = targetNodes.map(node => {
    const ratio = node.total / totalTargetMessages;
    return Math.max(minNodeHeight, ratio * targetAvailableHeight);
  });
  
  let sourceY = 0;
  sourceNodes.forEach((node, i) => {
    const nodeHeight = sourceHeights[i];
    sourceNodePositions.set(node.id, { y: sourceY, height: nodeHeight, currentY: sourceY });
    sourceY += nodeHeight + nodeGap;
  });
  
  let targetY = 0;
  targetNodes.forEach((node, i) => {
    const nodeHeight = targetHeights[i];
    targetNodePositions.set(node.id, { y: targetY, height: nodeHeight, currentY: targetY });
    targetY += nodeHeight + nodeGap;
  });
  
  // Calculate link paths - scale to fill 75% of each node's height proportionally
  // First, calculate total outgoing messages per source and incoming per target
  const sourceOutgoing = new Map<string, number>();
  const targetIncoming = new Map<string, number>();
  const LINK_HEIGHT_RATIO = 0.75; // Links cover 75% of node height
  const LINK_MARGIN_RATIO = (1 - LINK_HEIGHT_RATIO) / 2; // 12.5% margin top and bottom
  
  flows.forEach(flow => {
    const sourceKey = flow.sourceChainId || flow.sourceChain;
    const targetKey = flow.targetChainId || flow.targetChain;
    sourceOutgoing.set(sourceKey, (sourceOutgoing.get(sourceKey) || 0) + flow.messageCount);
    targetIncoming.set(targetKey, (targetIncoming.get(targetKey) || 0) + flow.messageCount);
  });
  
  // Initialize currentY with margin offset for each node
  sourceNodePositions.forEach((pos, key) => {
    pos.currentY = pos.y + pos.height * LINK_MARGIN_RATIO;
  });
  targetNodePositions.forEach((pos, key) => {
    pos.currentY = pos.y + pos.height * LINK_MARGIN_RATIO;
  });
  
  const linkPaths = flows.map((flow, index) => {
    const sourceKey = flow.sourceChainId || flow.sourceChain;
    const targetKey = flow.targetChainId || flow.targetChain;
    const sourcePos = sourceNodePositions.get(sourceKey)!;
    const targetPos = targetNodePositions.get(targetKey)!;
    
    // Link height proportional to flow's share of the source node (within 75% of node height)
    const sourceTotal = sourceOutgoing.get(sourceKey) || 1;
    const targetTotal = targetIncoming.get(targetKey) || 1;
    const sourceRatio = flow.messageCount / sourceTotal;
    const targetRatio = flow.messageCount / targetTotal;
    
    // Use 75% of the node's height for links
    const sourceUsableHeight = sourcePos.height * LINK_HEIGHT_RATIO;
    const targetUsableHeight = targetPos.height * LINK_HEIGHT_RATIO;
    
    const sourceLinkHeight = Math.max(0.5, sourceUsableHeight * sourceRatio);
    const targetLinkHeight = Math.max(0.5, targetUsableHeight * targetRatio);
    const linkHeight = Math.min(sourceLinkHeight, targetLinkHeight);
    
    const x1 = nodeWidth;
    const y1 = sourcePos.currentY + sourceLinkHeight / 2;
    sourcePos.currentY += sourceLinkHeight;
    
    const x2 = chartWidth - nodeWidth;
    const y2 = targetPos.currentY + targetLinkHeight / 2;
    targetPos.currentY += targetLinkHeight;
    
    // Bezier control points
    const cx1 = x1 + (x2 - x1) * 0.4;
    const cx2 = x1 + (x2 - x1) * 0.6;
    
    return {
      flow,
      index,
      path: `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`,
      x1, y1, x2, y2, cx1, cx2,
      height: linkHeight,
      sourceLinkHeight,
      targetLinkHeight,
      sourceColor: flow.sourceColor,
      targetColor: flow.targetColor,
    };
  });

  // Reset currentY for node positions
  sourceNodePositions.forEach(pos => pos.currentY = pos.y);
  targetNodePositions.forEach(pos => pos.currentY = pos.y);

  // Format message count
  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };

  return (
    <div 
      className="relative rounded-lg border border-gray-700 dark:border-gray-800 overflow-hidden"
      style={{ width, height }}
    >
      {/* Starfield Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: star.size,
              height: star.size,
              left: `${star.x}%`,
              top: `${star.y}%`,
              animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* SVG Chart */}
      <svg 
        className="w-full h-full relative z-10"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Grid pattern */}
          <pattern id="icm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path 
              d="M 20 0 L 0 0 0 20" 
              fill="none" 
              stroke="rgba(255, 255, 255, 0.03)" 
              strokeWidth="0.5"
            />
          </pattern>
          
          {/* Link gradients */}
          {linkPaths.map((link, i) => (
            <linearGradient 
              key={`link-gradient-${i}`}
              id={`link-gradient-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={link.x1}
              x2={link.x2}
            >
              <stop offset="0%" stopColor={link.sourceColor} />
              <stop offset="100%" stopColor={link.targetColor} />
            </linearGradient>
          ))}
          
          {/* Node gradients */}
          {[...sourceNodes, ...targetNodes].map((node, i) => (
            <linearGradient 
              key={`node-gradient-${i}`}
              id={`node-gradient-${node.id.replace(/[^a-zA-Z0-9]/g, '-')}`}
              x1="0%" y1="0%" x2="100%" y2="100%"
            >
              <stop offset="0%" stopColor={adjustColor(node.color, 15)} />
              <stop offset="100%" stopColor={adjustColor(node.color, -10)} />
            </linearGradient>
          ))}

          {/* Glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* Background grid */}
          <rect 
            width={chartWidth} 
            height={chartHeight} 
            fill="url(#icm-grid)" 
            opacity="0.5"
          />

          {/* Links */}
          <g className="links" fill="none" strokeOpacity="0.5">
            {linkPaths.map((link, i) => {
              const isHovered = hoveredFlow === i || 
                hoveredNode === (link.flow.sourceChainId || link.flow.sourceChain) ||
                hoveredNode === (link.flow.targetChainId || link.flow.targetChain);
              
              // Use average of source and target link heights for stroke width
              const strokeW = Math.max(1, (link.sourceLinkHeight + link.targetLinkHeight) / 2);
              
              return (
                <g key={i} className="link-group">
                  <path
                    d={link.path}
                    stroke={`url(#link-gradient-${i})`}
                    strokeWidth={strokeW}
                    opacity={hoveredFlow !== null || hoveredNode !== null 
                      ? (isHovered ? 0.9 : 0.15) 
                      : 0.55}
                    style={{
                      transition: 'opacity 0.3s, stroke-width 0.3s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoveredFlow(i)}
                    onMouseLeave={() => setHoveredFlow(null)}
                  />
                </g>
              );
            })}
          </g>

          {/* Animated particles */}
          {animationEnabled && particles.map((particle) => {
            const link = linkPaths[particle.flowIndex];
            if (!link) return null;
            
            const t = particle.progress;
            const x = cubicBezier(t, link.x1, link.cx1, link.cx2, link.x2);
            const y = cubicBezier(t, link.y1, link.y1, link.y2, link.y2);
            
            // Interpolate color
            const color = t < 0.5 ? link.sourceColor : link.targetColor;
            
            return (
              <circle
                key={particle.id}
                r={1.5}
                fill={color}
                opacity={0.7}
                filter="url(#glow)"
                style={{ mixBlendMode: 'screen' }}
                transform={`translate(${x},${y})`}
              />
            );
          })}

          {/* Source Nodes (Left) */}
          <g className="source-nodes">
            {sourceNodes.map((node) => {
              const pos = sourceNodePositions.get(node.id)!;
              const isHovered = hoveredNode === node.id;
              // Calculate normalized percentage - only show label if >= 2%
              const percentage = (node.total / totalSourceMessages) * 100;
              const showLabel = showLabels && percentage >= 2;
              
              return (
                <g
                  key={`source-${node.id}`}
                  className="node-group"
                  transform={`translate(0,${pos.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <rect
                    height={Math.max(pos.height, 2)}
                    width={nodeWidth}
                    fill={`url(#node-gradient-${node.id.replace(/[^a-zA-Z0-9]/g, '-')})`}
                    stroke={adjustColor(node.color, -20)}
                    strokeWidth={0.5}
                    rx={2}
                    ry={2}
                    opacity={isHovered ? 1 : 0.85}
                    style={{ transition: 'opacity 0.2s' }}
                  />
                  {showLabel && (
                    <text
                      x={nodeWidth + 4}
                      y={pos.height / 2}
                      dy="0.35em"
                      textAnchor="start"
                      className="node-label"
                      fill="#ffffff"
                      fontWeight="500"
                      fontSize="9px"
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.name.length > 18 ? node.name.slice(0, 18) + '..' : node.name} ({formatCount(node.total)})
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Target Nodes (Right) */}
          <g className="target-nodes">
            {targetNodes.map((node) => {
              const pos = targetNodePositions.get(node.id)!;
              const isHovered = hoveredNode === node.id;
              // Calculate normalized percentage - only show label if >= 2%
              const percentage = (node.total / totalTargetMessages) * 100;
              const showLabel = showLabels && percentage >= 2;
              
              return (
                <g
                  key={`target-${node.id}`}
                  className="node-group"
                  transform={`translate(${chartWidth - nodeWidth},${pos.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <rect
                    height={Math.max(pos.height, 2)}
                    width={nodeWidth}
                    fill={`url(#node-gradient-${node.id.replace(/[^a-zA-Z0-9]/g, '-')})`}
                    stroke={adjustColor(node.color, -20)}
                    strokeWidth={0.5}
                    rx={2}
                    ry={2}
                    opacity={isHovered ? 1 : 0.85}
                    style={{ transition: 'opacity 0.2s' }}
                  />
                  {showLabel && (
                    <text
                      x={-4}
                      y={pos.height / 2}
                      dy="0.35em"
                      textAnchor="end"
                      className="node-label"
                      fill="#ffffff"
                      fontWeight="500"
                      fontSize="9px"
                      style={{ pointerEvents: 'none' }}
                    >
                      ({formatCount(node.total)}) {node.name.length > 18 ? node.name.slice(0, 18) + '..' : node.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Title */}
          <text
            x={chartWidth / 2}
            y={-10}
            textAnchor="middle"
            fontSize="11px"
            fontWeight="bold"
            fill="rgba(255, 255, 255, 0.8)"
          >
            Total: {formatCount(totalMessages)} messages ({flows.length} routes)
          </text>
        </g>
      </svg>

      {/* Hover tooltip */}
      {hoveredFlow !== null && (
        <div
          className="absolute bg-gray-900/95 border border-gray-700 rounded-lg p-3 shadow-xl z-20 pointer-events-none"
          style={{
            left: '50%',
            bottom: 16,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              {linkPaths[hoveredFlow].flow.sourceLogo ? (
                <Image
                  src={linkPaths[hoveredFlow].flow.sourceLogo}
                  alt={linkPaths[hoveredFlow].flow.sourceChain}
                  width={20}
                  height={20}
                  className="rounded-full"
                  unoptimized
                />
              ) : (
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ background: linkPaths[hoveredFlow].sourceColor }}
                >
                  {linkPaths[hoveredFlow].flow.sourceChain.charAt(0)}
                </div>
              )}
              <span className="text-white font-medium">
                {linkPaths[hoveredFlow].flow.sourceChain}
              </span>
            </div>
            <span className="text-gray-400">→</span>
            <div className="flex items-center gap-2">
              {linkPaths[hoveredFlow].flow.targetLogo ? (
                <Image
                  src={linkPaths[hoveredFlow].flow.targetLogo}
                  alt={linkPaths[hoveredFlow].flow.targetChain}
                  width={20}
                  height={20}
                  className="rounded-full"
                  unoptimized
                />
              ) : (
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ background: linkPaths[hoveredFlow].targetColor }}
                >
                  {linkPaths[hoveredFlow].flow.targetChain.charAt(0)}
                </div>
              )}
              <span className="text-white font-medium">
                {linkPaths[hoveredFlow].flow.targetChain}
              </span>
            </div>
            <span className="text-emerald-400 font-bold ml-2">
              {formatCount(linkPaths[hoveredFlow].flow.messageCount)} msgs
            </span>
          </div>
        </div>
      )}

      {/* CSS for twinkle animation */}
      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

