"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';

/**
 * MiniNetworkDiagram - Compact Network Visualization for Home Page
 * 
 * A lightweight version of NetworkDiagram designed for landing pages.
 * Features auto-rotation, drag interaction, and a vibrant gradient aesthetic.
 * Transparent background works on any page. Theme-aware text colors.
 */

export interface MiniChainData {
  id: string;
  chainId?: string; // blockchain chainId for ICM matching
  name: string;
  logo?: string;
  color?: string;
  category?: string;
  link?: string;
  isPrimary?: boolean;
  validatorCount?: number;
  tps?: number; // Transactions per second for pulse effect
}

export interface MiniICMFlow {
  sourceChainId: string;
  targetChainId: string;
  messageCount: number;
}

interface MiniNetworkDiagramProps {
  chains: MiniChainData[];
  icmFlows?: MiniICMFlow[];
  containerSize?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  className?: string;
  onChainClick?: (chain: MiniChainData) => void;
}

interface ChainNode {
  id: string;
  chainId?: string;
  name: string;
  logo?: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isPrimary: boolean;
  link?: string;
  category?: string;
  tps?: number;
}

interface Connection {
  from: number;
  to: number;
  opacity: number;
  messageCount: number;
}

interface Particle {
  connectionIndex: number;
  progress: number;
  speed: number;
}

// Generate consistent color from string
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

// Convert color to rgba
function toRgba(color: string, alpha: number): string {
  if (color.startsWith('hsl')) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const h = parseInt(match[1]) / 360;
      const s = parseInt(match[2]) / 100;
      const l = parseInt(match[3]) / 100;
      
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
    }
  }
  
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  if (color.startsWith('rgb')) {
    if (color.startsWith('rgba')) {
      return color.replace(/[\d.]+\)$/, `${alpha})`);
    }
    return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  
  return `rgba(139, 92, 246, ${alpha})`;
}

export default function MiniNetworkDiagram({
  chains,
  icmFlows = [],
  containerSize = 550,
  autoRotate = true,
  autoRotateSpeed = 0.15,
  className = "",
  onChainClick,
}: MiniNetworkDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const nodesRef = useRef<ChainNode[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const logoImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const hoveredNodeRef = useRef<number | null>(null);
  const rotationRef = useRef(0);
  
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  
  const [dimensions, setDimensions] = useState({ width: containerSize, height: containerSize });
  const [hoveredNode, setHoveredNode] = useState<ChainNode | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dpr, setDpr] = useState(1); // Device pixel ratio for Retina/HiDPI support
  
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  const dragVelocityRef = useRef({ x: 0, y: 0 });

  // Helper to proxy external images through Next.js image optimization to avoid CORS
  const getProxiedImageUrl = useCallback((url: string): string => {
    if (!url) return url;
    // Local images don't need proxying
    if (url.startsWith('/')) return url;
    // Use Next.js image optimization as a CORS proxy
    return `/_next/image?url=${encodeURIComponent(url)}&w=128&q=75`;
  }, []);

  // Load chain logos
  useEffect(() => {
    chains.forEach((chain) => {
      if (chain.logo && !logoImagesRef.current.has(chain.id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          logoImagesRef.current.set(chain.id, img);
        };
        img.onerror = () => {
          // If proxied URL fails, try without proxy as fallback
          if (img.src.includes('/_next/image')) {
            const fallbackImg = new Image();
            fallbackImg.crossOrigin = 'anonymous';
            fallbackImg.onload = () => {
              logoImagesRef.current.set(chain.id, fallbackImg);
            };
            fallbackImg.src = chain.logo!;
          }
        };
        // Use proxied URL for external images to avoid CORS
        img.src = getProxiedImageUrl(chain.logo);
      }
    });
  }, [chains, getProxiedImageUrl]);

  // Initialize layout
  const initializeLayout = useCallback((width: number, height: number): ChainNode[] => {
    if (chains.length === 0) return [];

    const centerX = width / 2;
    const centerY = height / 2;
    const nodes: ChainNode[] = [];
    
    // Separate primary and secondary chains
    const primaryChain = chains.find(c => c.isPrimary);
    const secondaryChains = chains.filter(c => !c.isPrimary);
    
    // Add primary chain at center
    if (primaryChain) {
      nodes.push({
        id: primaryChain.id,
        chainId: primaryChain.chainId,
        name: primaryChain.name,
        logo: primaryChain.logo,
        color: primaryChain.color || '#e84142',
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        radius: 36,
        isPrimary: true,
        link: primaryChain.link,
        category: primaryChain.category,
        tps: primaryChain.tps,
      });
    }

    // Find max validator count for normalization
    const maxValidators = Math.max(...secondaryChains.map(c => c.validatorCount || 0), 1);

    // Sort chains by size (validators + tps) - bigger chains first
    const sortedChains = [...secondaryChains].sort((a, b) => {
      const aScore = (a.validatorCount || 0) + (a.tps || 0) * 10;
      const bScore = (b.validatorCount || 0) + (b.tps || 0) * 10;
      return bScore - aScore;
    });

    // Distribute chains in orbital rings - bigger chains closer to center
    const orbitalRadius = Math.min(width, height) * 0.38;
    const numRings = 3;
    const chainsPerRing = Math.ceil(sortedChains.length / numRings);
    
    sortedChains.forEach((chain, index) => {
      // Assign to ring based on sorted index (biggest chains in inner ring)
      const ringIndex = Math.min(Math.floor(index / chainsPerRing), numRings - 1);
      const indexInRing = index - (ringIndex * chainsPerRing);
      const chainsInThisRing = Math.min(chainsPerRing, sortedChains.length - ringIndex * chainsPerRing);
      
      // Three rings: inner (0.55), middle (0.75), outer (0.98)
      const ringMultipliers = [0.40, 0.90, 1.20];
      const ringRadius = orbitalRadius * ringMultipliers[ringIndex];
      
      // Distribute chains evenly within their ring
      const angle = (indexInRing / chainsInThisRing) * Math.PI * 2;
      const angleOffset = ringIndex * (Math.PI / 5); // Offset each ring
      
      const x = centerX + Math.cos(angle + angleOffset) * ringRadius;
      const y = centerY + Math.sin(angle + angleOffset) * ringRadius * 0.85; // Slightly elliptical
      
      // Size based on validator count (normalized)
      const validatorRatio = chain.validatorCount ? Math.sqrt(chain.validatorCount / maxValidators) : 0.3;
      const minRadius = 14;
      const maxRadius = 26;
      const radius = minRadius + validatorRatio * (maxRadius - minRadius);
      
      nodes.push({
        id: chain.id,
        chainId: chain.chainId,
        name: chain.name,
        logo: chain.logo,
        color: chain.color || stringToColor(chain.name),
        x,
        y,
        vx: 0,
        vy: 0,
        radius,
        isPrimary: false,
        link: chain.link,
        category: chain.category,
        tps: chain.tps,
      });
    });

    return nodes;
  }, [chains]);

  // Generate connections from real ICM flow data
  const generateConnections = useCallback((nodes: ChainNode[], flows: MiniICMFlow[]): Connection[] => {
    const connections: Connection[] = [];
    
    // Build lookup map by chainId
    const nodeByChainId = new Map<string, number>();
    nodes.forEach((n, idx) => {
      if (n.chainId) {
        nodeByChainId.set(n.chainId, idx);
      }
    });
    
    // If we have real ICM flow data, use it
    if (flows.length > 0) {
      const maxMessages = Math.max(...flows.map(f => f.messageCount), 1);
      
      // Sort by message count and take top flows
      const sortedFlows = [...flows].sort((a, b) => b.messageCount - a.messageCount);
      const topFlows = sortedFlows.slice(0, 30); // Limit connections for clarity
      
      topFlows.forEach((flow) => {
        const fromIdx = nodeByChainId.get(flow.sourceChainId);
        const toIdx = nodeByChainId.get(flow.targetChainId);
        
        if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
          // Opacity based on message volume
          const ratio = flow.messageCount / maxMessages;
          const opacity = 0.1 + ratio * 0.4;
          
          // Avoid duplicate connections
          if (!connections.some(c => 
            (c.from === fromIdx && c.to === toIdx) || 
            (c.from === toIdx && c.to === fromIdx)
          )) {
            connections.push({
              from: fromIdx,
              to: toIdx,
              opacity,
              messageCount: flow.messageCount,
            });
          }
        }
      });
    }
    
    // Fallback: if no ICM data or very few connections, connect to primary
    if (connections.length < 5) {
      const primaryIndex = nodes.findIndex(n => n.isPrimary);
      if (primaryIndex >= 0) {
        nodes.forEach((_, index) => {
          if (index !== primaryIndex && !connections.some(c => 
            (c.from === primaryIndex && c.to === index) || 
            (c.from === index && c.to === primaryIndex)
          )) {
            connections.push({
              from: primaryIndex,
              to: index,
              opacity: 0.12,
              messageCount: 0,
            });
          }
        });
      }
    }
    
    return connections;
  }, []);

  // Initialize particles for connections - count and speed based on message volume
  const initializeParticles = useCallback((connections: Connection[]): Particle[] => {
    const particles: Particle[] = [];
    const maxMessages = Math.max(...connections.map(c => c.messageCount), 1);
    
    connections.forEach((conn, index) => {
      // More particles for high-traffic connections
      const ratio = conn.messageCount / maxMessages;
      const count = conn.messageCount > 0 
        ? Math.max(1, Math.min(4, Math.ceil(ratio * 4)))
        : 1;
      
      // Faster particles for higher traffic
      const baseSpeed = 0.001 + ratio * 0.002;
      
      for (let i = 0; i < count; i++) {
        particles.push({
          connectionIndex: index,
          progress: Math.random(),
          speed: baseSpeed + Math.random() * 0.001,
        });
      }
    });
    return particles;
  }, []);

  // Initialize nodes and connections
  useEffect(() => {
    nodesRef.current = initializeLayout(dimensions.width, dimensions.height);
    connectionsRef.current = generateConnections(nodesRef.current, icmFlows);
    particlesRef.current = initializeParticles(connectionsRef.current);
  }, [chains, icmFlows, dimensions, initializeLayout, generateConnections, initializeParticles]);

  // Update dimensions and device pixel ratio
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const pixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
        setDpr(pixelRatio);
        setDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Physics simulation with rotation
  const simulatePhysics = useCallback((nodes: ChainNode[], deltaRotation: number) => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    
    nodes.forEach((node, i) => {
      if (node.isPrimary) return; // Primary stays at center
      
      // Rotate around center
      const dx = node.x - centerX;
      const dy = node.y - centerY;
      const angle = Math.atan2(dy, dx) + deltaRotation;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      node.x = centerX + Math.cos(angle) * dist;
      node.y = centerY + Math.sin(angle) * dist;
      
      // Repulsion between nodes
      for (let j = i + 1; j < nodes.length; j++) {
        const other = nodes[j];
        const ddx = other.x - node.x;
        const ddy = other.y - node.y;
        const distance = Math.sqrt(ddx * ddx + ddy * ddy);
        const minDist = node.radius + other.radius + 20;
        
        if (distance < minDist && distance > 0) {
          const force = (minDist - distance) * 0.03;
          const fx = (ddx / distance) * force;
          const fy = (ddy / distance) * force;
          
          if (!node.isPrimary) {
            node.x -= fx;
            node.y -= fy;
          }
          if (!other.isPrimary) {
            other.x += fx;
            other.y += fy;
          }
        }
      }
    });
  }, [dimensions]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const draw = () => {
      time += 0.01;

      // Reset transform and scale for HiDPI/Retina displays
      // This ensures we draw in CSS pixel coordinates but render at device resolution
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      // Calculate rotation
      let deltaRotation = 0;

      // Pause movement when hovering a chain
      const isHovering = hoveredNodeRef.current !== null;

      if (isDragging) {
        // While dragging, apply drag velocity directly for responsive rotation
        deltaRotation = dragVelocityRef.current.x * 0.02;
      } else if (!isHovering) {
        // When not dragging and not hovering, apply auto-rotation
        if (autoRotate) {
          deltaRotation = autoRotateSpeed * 0.01;
        }

        // Apply momentum decay after release
        if (Math.abs(dragVelocityRef.current.x) > 0.01) {
          deltaRotation += dragVelocityRef.current.x * 0.015;
          dragVelocityRef.current = {
            x: dragVelocityRef.current.x * 0.96,
            y: dragVelocityRef.current.y * 0.96
          };
        }
      }

      rotationRef.current += deltaRotation;
      simulatePhysics(nodesRef.current, deltaRotation);

      // Update particles
      particlesRef.current.forEach(particle => {
        particle.progress += particle.speed;
        if (particle.progress > 1) particle.progress = 0;
      });

      const { width, height } = dimensions;

      // Clear canvas (transparent - background handled by CSS)
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const connections = connectionsRef.current;

      // Draw connections
      connections.forEach((conn, i) => {
        const fromNode = nodes[conn.from];
        const toNode = nodes[conn.to];
        if (!fromNode || !toNode) return;

        const pulse = 0.6 + 0.2 * Math.sin(time * 1.5 + i * 0.5);
        
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        
        const gradient = ctx.createLinearGradient(
          fromNode.x, fromNode.y, toNode.x, toNode.y
        );
        const baseOpacity = conn.opacity * pulse * 1.5; // More visible
        gradient.addColorStop(0, toRgba(fromNode.color, baseOpacity));
        gradient.addColorStop(0.5, toRgba(fromNode.color, baseOpacity * 0.6));
        gradient.addColorStop(1, toRgba(toNode.color, baseOpacity));
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Draw particles
      particlesRef.current.forEach((particle) => {
        const conn = connections[particle.connectionIndex];
        if (!conn) return;
        
        const fromNode = nodes[conn.from];
        const toNode = nodes[conn.to];
        if (!fromNode || !toNode) return;
        
        const x = fromNode.x + (toNode.x - fromNode.x) * particle.progress;
        const y = fromNode.y + (toNode.y - fromNode.y) * particle.progress;
        
        // Interpolate color along the connection
        const particleColor = particle.progress < 0.5 ? fromNode.color : toNode.color;
        
        // Particle glow
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = toRgba(particleColor, 0.2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = toRgba(particleColor, 0.5);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = toRgba(particleColor, 0.9);
        ctx.fill();
      });

      // Draw nodes
      const hoveredIdx = hoveredNodeRef.current;
      
      // Find max TPS for normalization
      const maxTps = Math.max(...nodes.map(n => n.tps || 0), 1);
      
      nodes.forEach((node, index) => {
        const isHovered = hoveredIdx === index;
        const scale = isHovered ? 1.15 : 1;
        const radius = node.radius * scale;

        // TPS-based pulse wave effect (expanding rings)
        const tpsRatio = Math.sqrt((node.tps || 0) / maxTps);
        
        // Draw pulse waves for ANY chain with TPS > 0 (normalized relative to others)
        if ((node.tps || 0) > 0) {
          const pulseSpeed = 0.6 + tpsRatio * 2.0; // Match NetworkDiagram speed
          // Dynamic wave count: min 3, max 6, scaled by TPS ratio
          const minWaves = 3;
          const maxWaves = 6;
          const minDistance = 18;
          const maxDistance = 32;
          const fadeCurve = 1.5;
          const numWaves = Math.round(minWaves + tpsRatio * (maxWaves - minWaves));
          
          for (let w = 0; w < numWaves; w++) {
            // Each wave is offset in phase (evenly distributed)
            const wavePhase = (time * pulseSpeed + w * (Math.PI * 2 / numWaves)) % (Math.PI * 2);
            const waveProgress = wavePhase / (Math.PI * 2); // 0 to 1
            
            // Wave expands from chain edge outward
            const waveRadius = radius + waveProgress * (minDistance + tpsRatio * (maxDistance - minDistance));
            // Wave fades out as it expands
            const waveAlpha = Math.pow(1 - waveProgress, fadeCurve) * (0.35 + tpsRatio * 0.25);
            
            if (waveAlpha > 0.02) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, waveRadius, 0, Math.PI * 2);
              ctx.strokeStyle = toRgba(node.color, waveAlpha);
              ctx.lineWidth = 1.5 + (1 - waveProgress) * 1.5; // Thicker at start, thinner as expands
              ctx.stroke();
            }
          }
        }

        // Outer glow
        if (isHovered || node.isPrimary) {
          const glowRadius = radius + (node.isPrimary ? 18 : 14);
          const glowGradient = ctx.createRadialGradient(
            node.x, node.y, radius * 0.5,
            node.x, node.y, glowRadius
          );
          glowGradient.addColorStop(0, toRgba(node.color, node.isPrimary ? 0.4 : 0.3));
          glowGradient.addColorStop(0.5, toRgba(node.color, 0.15));
          glowGradient.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = glowGradient;
          ctx.fill();
        }

        // Node circle - more vibrant fill
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = toRgba(node.color, isHovered ? 0.25 : 0.15);
        ctx.fill();

        // White inner fill for logo contrast
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();

        // Border - vibrant color
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isHovered 
          ? toRgba(node.color, 1) 
          : toRgba(node.color, 0.8);
        ctx.lineWidth = isHovered ? 3 : 2.5;
        ctx.stroke();

        // Logo
        const logoImg = logoImagesRef.current.get(node.id);
        if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
          const logoSize = radius * 1.3;
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 0.7, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            logoImg,
            node.x - logoSize / 2,
            node.y - logoSize / 2,
            logoSize,
            logoSize
          );
          ctx.restore();
        } else {
          // Fallback letter
          ctx.font = `bold ${radius * 0.8}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = toRgba(node.color, 0.9);
          ctx.fillText(node.name.charAt(0), node.x, node.y);
        }

        // Label
        const labelY = node.y + radius + 12;
        ctx.font = `${isHovered ? 'bold ' : ''}${Math.max(9, Math.min(11, radius / 2))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Theme-aware text color with shadow for readability
        if (isDarkMode) {
          // Dark mode: light text with dark shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = isHovered ? toRgba(node.color, 1) : 'rgba(255, 255, 255, 0.9)';
        } else {
          // Light mode: dark text with light shadow
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = isHovered ? toRgba(node.color, 1) : 'rgba(30, 30, 50, 0.9)';
        }
        ctx.fillText(node.name, node.x, labelY);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, isDragging, autoRotate, autoRotateSpeed, simulatePhysics, isDarkMode, dpr]);

  // Mouse/touch handlers
  const getNodeAtPosition = useCallback((x: number, y: number): number | null => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy < node.radius * node.radius) {
        return i;
      }
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const dx = x - lastDragPosRef.current.x;
      dragVelocityRef.current = { x: dx, y: 0 };
      lastDragPosRef.current = { x, y };
      return;
    }

    const nodeIndex = getNodeAtPosition(x, y);
    hoveredNodeRef.current = nodeIndex;
    setHoveredNode(nodeIndex !== null ? nodesRef.current[nodeIndex] : null);
  }, [isDragging, getNodeAtPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nodeIndex = getNodeAtPosition(x, y);
    
    if (nodeIndex !== null) {
      const node = nodesRef.current[nodeIndex];
      if (node.link) {
        window.location.href = node.link;
      } else if (onChainClick) {
        const chain = chains.find(c => c.id === node.id);
        if (chain) onChainClick(chain);
      }
    } else {
      setIsDragging(true);
      dragStartRef.current = { x, y };
      lastDragPosRef.current = { x, y };
      dragVelocityRef.current = { x: 0, y: 0 };
    }
  }, [getNodeAtPosition, chains, onChainClick]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    hoveredNodeRef.current = null;
    setHoveredNode(null);
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const nodeIndex = getNodeAtPosition(x, y);
    
    if (nodeIndex !== null) {
      const node = nodesRef.current[nodeIndex];
      if (node.link) {
        window.location.href = node.link;
      } else if (onChainClick) {
        const chain = chains.find(c => c.id === node.id);
        if (chain) onChainClick(chain);
      }
    } else {
      setIsDragging(true);
      dragStartRef.current = { x, y };
      lastDragPosRef.current = { x, y };
    }
  }, [getNodeAtPosition, chains, onChainClick]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const dx = x - lastDragPosRef.current.x;
    dragVelocityRef.current = { x: dx, y: 0 };
    lastDragPosRef.current = { x, y };
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (chains.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-zinc-900 rounded-xl ${className}`}
        style={{ width: containerSize, height: containerSize }}
      >
        <p className="text-zinc-500 text-sm">No chains to display</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Background nebula gradient - contained within component */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '200%',
          height: '200%',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: isDarkMode
            ? `
              radial-gradient(ellipse 35% 30% at 45% 45%, rgba(139, 92, 246, 0.18) 0%, rgba(139, 92, 246, 0.06) 30%, transparent 50%),
              radial-gradient(ellipse 30% 25% at 60% 55%, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.04) 30%, transparent 50%),
              radial-gradient(ellipse 25% 35% at 48% 65%, rgba(236, 72, 153, 0.12) 0%, rgba(236, 72, 153, 0.03) 30%, transparent 50%)
            `
            : `
              radial-gradient(ellipse 35% 30% at 45% 45%, rgba(139, 92, 246, 0.12) 0%, rgba(139, 92, 246, 0.04) 30%, transparent 50%),
              radial-gradient(ellipse 30% 25% at 60% 55%, rgba(6, 182, 212, 0.10) 0%, rgba(6, 182, 212, 0.03) 30%, transparent 50%),
              radial-gradient(ellipse 25% 35% at 48% 65%, rgba(236, 72, 153, 0.08) 0%, rgba(236, 72, 153, 0.02) 30%, transparent 50%)
            `,
        }}
      />
      <canvas
        ref={canvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{ width: dimensions.width, height: dimensions.height }}
        className={`${isDragging ? 'cursor-grabbing' : hoveredNode ? 'cursor-pointer' : 'cursor-grab'} touch-none`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />
      
      {/* Hover tooltip */}
      {hoveredNode && !hoveredNode.isPrimary && (
        <div 
          className="absolute pointer-events-none z-50 px-2.5 py-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg"
          style={{
            left: Math.min(hoveredNode.x + 20, dimensions.width - 120),
            top: Math.max(hoveredNode.y - 30, 10),
          }}
        >
          <p className="text-zinc-900 dark:text-white text-xs font-medium">{hoveredNode.name}</p>
          {hoveredNode.category && (
            <p className="text-zinc-500 dark:text-zinc-400 text-[10px]">{hoveredNode.category}</p>
          )}
        </div>
      )}
      
      {/* Bottom bar with CTAs and hint */}
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <a 
            href="/stats/overview" 
            className="px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full text-[11px] font-medium hover:opacity-80 transition-opacity"
          >
            View Stats
          </a>
          <a 
            href="/explorer"
            className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-full text-[11px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Explorer
          </a>
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          Drag to rotate
        </span>
      </div>
    </div>
  );
}

