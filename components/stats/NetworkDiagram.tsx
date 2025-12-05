"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Info } from 'lucide-react';
import l1ChainsData from '@/constants/l1-chains.json';

export interface ChainCosmosData {
  id: string;
  chainId?: string; // blockchain chainId for ICM matching
  name: string;
  logo?: string;
  color: string;
  validatorCount: number;
  subnetId?: string;
  // Additional metrics
  activeAddresses?: number;
  txCount?: number;
  icmMessages?: number;
  tps?: number;
  category?: string;
}

export interface ICMFlowRoute {
  sourceChainId: string;
  targetChainId: string;
  messageCount: number;
}

interface NetworkDiagramProps {
  data: ChainCosmosData[];
  icmFlows?: ICMFlowRoute[];
  failedChainIds?: string[];
  onChainHover?: (chain: ChainCosmosData | null) => void;
}

interface ChainNode {
  id: string;
  chainId?: string;
  name: string;
  logo?: string;
  color: string;
  rgbaColor: string;
  validatorCount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  validators: ValidatorNode[];
  // Additional metrics
  activeAddresses?: number;
  txCount?: number;
  icmMessages?: number;
  tps?: number;
  category?: string;
}

interface ValidatorNode {
  id: string;
  localX: number;
  localY: number;
  radius: number;
  chainId: string;
}

interface ChainLink {
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromColor: string;
  toColor: string;
  messageCount: number;
}

interface MessageParticle {
  linkIndex: number;
  progress: number;
  speed: number;
}

// Convert any color to RGBA format
function colorToRgba(color: string, alpha: number = 1): string {
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
  
  return `rgba(100, 100, 200, ${alpha})`;
}

// Get point on straight line
function getPointOnLine(t: number, x0: number, y0: number, x1: number, y1: number) {
  return {
    x: x0 + (x1 - x0) * t,
    y: y0 + (y1 - y0) * t,
  };
}

export default function NetworkDiagram({
  data,
  icmFlows = [],
  failedChainIds = [],
  onChainHover,
}: NetworkDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const nodesRef = useRef<ChainNode[]>([]);
  const linksRef = useRef<ChainLink[]>([]);
  const particlesRef = useRef<MessageParticle[]>([]);
  const starsRef = useRef<{ x: number; y: number; size: number; brightness: number }[]>([]);
  const hoveredChainRef = useRef<string | null>(null);
  const logoImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const { resolvedTheme } = useTheme();
  
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [hoveredChain, setHoveredChain] = useState<ChainNode | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Detect mobile
  const isMobile = dimensions.width < 640;
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  
  // Touch state for pinch zoom
  const lastTouchDistRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);
  
  // Calculate minimum zoom needed to fit all chains in viewport
  const calculateMinZoom = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return 1;
    
    const padding = 80; // Extra padding around bounds
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    
    // Find the bounding box of all nodes (relative to center)
    let maxExtentX = 0;
    let maxExtentY = 0;
    
    nodes.forEach(node => {
      const extentX = Math.abs(node.x - centerX) + node.radius + padding;
      const extentY = Math.abs(node.y - centerY) + node.radius + padding;
      maxExtentX = Math.max(maxExtentX, extentX);
      maxExtentY = Math.max(maxExtentY, extentY);
    });
    
    // Calculate zoom needed to fit content
    const zoomToFitX = (dimensions.width / 2) / maxExtentX;
    const zoomToFitY = (dimensions.height / 2) / maxExtentY;
    const zoomToFit = Math.min(zoomToFitX, zoomToFitY);
    
    // If everything fits at zoom 1, don't allow zoom out
    // Otherwise, allow zoom out to fit all content (with a floor of 0.3)
    return zoomToFit >= 1 ? 1 : Math.max(0.3, zoomToFit);
  }, [dimensions.width, dimensions.height]);

  // Check if fullscreen API is supported
  const supportsFullscreen = typeof document !== 'undefined' && (
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled
  );

  // Fullscreen toggle with cross-browser support
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const requestFS = container.requestFullscreen ||
      (container as any).webkitRequestFullscreen ||
      (container as any).mozRequestFullScreen ||
      (container as any).msRequestFullscreen;

    const exitFS = document.exitFullscreen ||
      (document as any).webkitExitFullscreen ||
      (document as any).mozCancelFullScreen ||
      (document as any).msExitFullscreen;

    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!isCurrentlyFullscreen && requestFS) {
      requestFS.call(container).then(() => {
        setIsFullscreen(true);
      }).catch((err: Error) => {
        console.error('Error enabling fullscreen:', err);
      });
    } else if (isCurrentlyFullscreen && exitFS) {
      exitFS.call(document).then(() => {
        setIsFullscreen(false);
      }).catch((err: Error) => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  }, []);

  // Listen for fullscreen changes (with vendor prefixes)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFS);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        document.exitFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);
  
  // Transform screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    return {
      x: (screenX - centerX - panOffset.x) / zoom + centerX,
      y: (screenY - centerY - panOffset.y) / zoom + centerY,
    };
  }, [dimensions, zoom, panOffset]);

  // Load chain logos
  useEffect(() => {
    data.forEach((chain) => {
      if (chain.logo && !logoImagesRef.current.has(chain.id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          logoImagesRef.current.set(chain.id, img);
        };
        img.src = chain.logo;
      }
    });
  }, [data]);

  // Initialize chain positions
  const initializeLayout = useCallback((width: number, height: number, chains: ChainCosmosData[]): ChainNode[] => {
    if (chains.length === 0) return [];

    const centerX = width / 2;
    const centerY = height / 2;
    
    const sortedChains = [...chains].sort((a, b) => b.validatorCount - a.validatorCount);
    const maxValidators = sortedChains[0]?.validatorCount || 1;

    const nodes: ChainNode[] = [];
    
    const minChainRadius = isFullscreen ? 22 : 16;
    const maxChainRadius = isFullscreen ? 90 : 65;

    sortedChains.forEach((chain, index) => {
      const ratio = Math.sqrt(chain.validatorCount / maxValidators);
      const chainRadius = minChainRadius + ratio * (maxChainRadius - minChainRadius);
      
      const rankRatio = index / Math.max(1, sortedChains.length - 1);
      // On mobile, spread chains more so not all fit in viewport (user can pan/drag)
      // On desktop/fullscreen, keep chains within viewport
      const spreadFactor = isMobile ? 0.7 : (isFullscreen ? 0.38 : 0.38);
      const maxDist = Math.min(width, height) * spreadFactor;
      const distanceFromCenter = rankRatio * maxDist;
      
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const angle = index * goldenAngle;
      
      const x = centerX + Math.cos(angle) * distanceFromCenter;
      const y = centerY + Math.sin(angle) * distanceFromCenter;
      
      // Generate validators - show ALL validators with appropriate sizing
      const validators: ValidatorNode[] = [];
      const targetValidators = chain.validatorCount;
      
      // Calculate validator size based on how many need to fit
      const innerRadius = chainRadius * 0.85;
      const area = Math.PI * innerRadius * innerRadius;
      const areaPerValidator = area / Math.max(1, targetValidators);
      const validatorRadius = Math.max(0.8, Math.min(2.5, Math.sqrt(areaPerValidator / Math.PI) * 0.6));
      
      let placed = 0;
      let ring = 0;
      const ringSpacing = validatorRadius * 2.8;
      
      while (placed < targetValidators) {
        const ringRadius = ring === 0 ? 0 : ring * ringSpacing;
        
        if (ringRadius > innerRadius) break;
        
        const circumference = ring === 0 ? 1 : 2 * Math.PI * ringRadius;
        const validatorsInRing = ring === 0 ? 1 : Math.floor(circumference / (validatorRadius * 2.5));
        const actualInRing = Math.min(validatorsInRing, targetValidators - placed);
        
        for (let v = 0; v < actualInRing; v++) {
          const vAngle = (v / actualInRing) * Math.PI * 2 + (ring * 0.4);
          const vX = ring === 0 ? 0 : Math.cos(vAngle) * ringRadius;
          const vY = ring === 0 ? 0 : Math.sin(vAngle) * ringRadius;
          
          validators.push({
            id: `${chain.id}-v${placed}`,
            localX: vX,
            localY: vY,
            radius: validatorRadius,
            chainId: chain.id,
          });
          placed++;
        }
        ring++;
      }
      
      nodes.push({
        id: chain.id,
        chainId: chain.chainId, // Include chainId for ICM matching
        name: chain.name,
        logo: chain.logo,
        color: chain.color,
        rgbaColor: colorToRgba(chain.color, 1),
        validatorCount: chain.validatorCount,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: chainRadius,
        validators,
        // Additional metrics
        activeAddresses: chain.activeAddresses,
        txCount: chain.txCount,
        icmMessages: chain.icmMessages,
        tps: chain.tps,
        category: chain.category,
      });
    });

    return nodes;
  }, [isFullscreen, isMobile]);

  // Calculate ICM-based links - match by chainId
  const calculateICMLinks = useCallback((nodes: ChainNode[], flows: ICMFlowRoute[]): ChainLink[] => {
    const links: ChainLink[] = [];
    
    // Build lookup map by chainId (blockchain ID used by ICM)
    const nodeByChainId = new Map<string, ChainNode>();
    nodes.forEach(n => {
      if (n.chainId) {
        nodeByChainId.set(n.chainId, n);
      }
    });
    
    // Sort by message count and take top flows
    const sortedFlows = [...flows].sort((a, b) => b.messageCount - a.messageCount);
    const maxLinks = isFullscreen ? 50 : 30;
    
    sortedFlows.slice(0, maxLinks).forEach((flow) => {
      // Match using chainId (blockchain ID)
      const fromNode = nodeByChainId.get(flow.sourceChainId);
      const toNode = nodeByChainId.get(flow.targetChainId);
      
      if (fromNode && toNode && fromNode.id !== toNode.id) {
        links.push({
          fromId: fromNode.id,
          toId: toNode.id,
          fromX: fromNode.x,
          fromY: fromNode.y,
          toX: toNode.x,
          toY: toNode.y,
          fromColor: fromNode.color,
          toColor: toNode.color,
          messageCount: flow.messageCount,
        });
      }
    });
    
    return links;
  }, [isFullscreen]);

  // Initialize message particles - count and speed based on message volume
  const initializeParticles = useCallback((links: ChainLink[], maxMessages: number): MessageParticle[] => {
    const particles: MessageParticle[] = [];
    
    links.forEach((link, linkIndex) => {
      const ratio = link.messageCount / Math.max(1, maxMessages);
      // More particles for high-traffic routes (3-12 particles)
      const particleCount = Math.max(2, Math.floor(ratio * 12) + 1);
      // Much slower particles - takes 8-15 seconds to traverse
      const baseSpeed = 0.0008 + ratio * 0.0015;
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          linkIndex,
          progress: Math.random(),
          speed: baseSpeed + Math.random() * 0.0008,
        });
      }
    });
    
    return particles;
  }, []);

  // Physics simulation
  const simulatePhysics = useCallback((nodes: ChainNode[], width: number, height: number, allowOverflow: boolean) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const padding = 60;
    
    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      
      const toCenterX = centerX - nodeA.x;
      const toCenterY = centerY - nodeA.y;
      const distToCenter = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
      // Weaker center force on mobile to let chains stay spread out
      const centerForce = allowOverflow ? 0.0002 : 0.0006 * (1 - i / nodes.length);
      
      if (distToCenter > 0) {
        nodeA.vx += (toCenterX / distToCenter) * centerForce * distToCenter;
        nodeA.vy += (toCenterY / distToCenter) * centerForce * distToCenter;
      }
      
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDist = nodeA.radius + nodeB.radius + 50;
        
        if (distance < minDist && distance > 0) {
          const force = (minDist - distance) * 0.1;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          nodeA.vx -= fx;
          nodeA.vy -= fy;
          nodeB.vx += fx;
          nodeB.vy += fy;
        }
      }
      
      nodeA.x += nodeA.vx;
      nodeA.y += nodeA.vy;
      nodeA.vx *= 0.82;
      nodeA.vy *= 0.82;
      
      // On mobile (allowOverflow), let chains exist outside viewport (user can pan)
      // On desktop, constrain to visible area
      if (!allowOverflow) {
        nodeA.x = Math.max(nodeA.radius + padding, Math.min(width - nodeA.radius - padding, nodeA.x));
        nodeA.y = Math.max(nodeA.radius + padding, Math.min(height - nodeA.radius - padding, nodeA.y));
      }
    }
  }, []);

  // Update dimensions - debounced and ignores small height changes on mobile
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const lastDimensions = { width: 0, height: 0 };
    
    const updateSize = (immediate = false) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.round(rect.width);
      const newHeight = Math.round(rect.height);
      
      // On mobile, browser chrome (address bar) hiding/showing causes height changes
      // Only update if width changes or height changes significantly (more than 100px)
      const widthChanged = Math.abs(newWidth - lastDimensions.width) > 2;
      const heightChangedSignificantly = Math.abs(newHeight - lastDimensions.height) > 100;
      
      if (immediate || widthChanged || heightChangedSignificantly) {
        lastDimensions.width = newWidth;
        lastDimensions.height = newHeight;
        setDimensions({ width: newWidth, height: newHeight });
      }
    };
    
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => updateSize(false), 150);
    };
    
    // Initial update is immediate
    updateSize(true);
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [isFullscreen]);

  // Prevent page scroll when zooming with wheel or touch
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      // Only prevent default if the wheel event is over the container
      if (container.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    const handleTouchNative = (e: TouchEvent) => {
      // Prevent default to stop page scrolling while interacting with canvas
      // Only prevent on canvas element, not on buttons/controls
      const target = e.target as HTMLElement;
      if (target.tagName === 'CANVAS') {
        e.preventDefault();
      }
    };

    // Use capture phase and passive: false to ensure preventDefault works
    container.addEventListener('wheel', handleWheelNative, { passive: false, capture: true });
    container.addEventListener('touchstart', handleTouchNative, { passive: false });
    container.addEventListener('touchmove', handleTouchNative, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheelNative, { capture: true } as EventListenerOptions);
      container.removeEventListener('touchstart', handleTouchNative);
      container.removeEventListener('touchmove', handleTouchNative);
    };
  }, []);

  // Initialize stars - expanded area with higher density at center
  useEffect(() => {
    const stars: { x: number; y: number; size: number; brightness: number }[] = [];
    const expandFactor = 3;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const maxRadius = Math.max(dimensions.width, dimensions.height) * expandFactor / 2;
    
    // Gaussian-like distribution for center density
    const gaussianRandom = () => {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
    
    for (let i = 0; i < 800; i++) {
      let x, y;
      
      if (i < 500) {
        // 60% of stars use gaussian distribution (concentrated at center)
        const spreadX = dimensions.width * 0.8;
        const spreadY = dimensions.height * 0.8;
        x = centerX + gaussianRandom() * spreadX;
        y = centerY + gaussianRandom() * spreadY;
      } else {
        // 40% of stars spread uniformly across the full area
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * maxRadius;
        x = centerX + Math.cos(angle) * radius;
        y = centerY + Math.sin(angle) * radius;
      }
      
      stars.push({
        x,
        y,
        size: Math.random() * 2 + 0.3,
        brightness: Math.random() * 0.6 + 0.2,
      });
    }
    starsRef.current = stars;
  }, [dimensions.width, dimensions.height]);

  // Initialize nodes and links
  useEffect(() => {
    nodesRef.current = initializeLayout(dimensions.width, dimensions.height, data);
    
    if (icmFlows.length > 0) {
      linksRef.current = calculateICMLinks(nodesRef.current, icmFlows);
      const maxMessages = Math.max(...icmFlows.map(f => f.messageCount), 1);
      particlesRef.current = initializeParticles(linksRef.current, maxMessages);
    } else {
      linksRef.current = [];
      particlesRef.current = [];
    }
  }, [data, icmFlows, dimensions, initializeLayout, calculateICMLinks, initializeParticles]);

  // Sync hover/selected state
  useEffect(() => {
    hoveredChainRef.current = (selectedChain || hoveredChain)?.id || null;
  }, [hoveredChain, selectedChain]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const draw = () => {
      time += 0.008;
      
      simulatePhysics(nodesRef.current, dimensions.width, dimensions.height, isMobile);
      
      // Update link positions after physics
      if (linksRef.current.length > 0) {
        const nodeMap = new Map<string, ChainNode>();
        nodesRef.current.forEach(n => nodeMap.set(n.id, n));
        
        linksRef.current.forEach(link => {
          const fromNode = nodeMap.get(link.fromId);
          const toNode = nodeMap.get(link.toId);
          if (fromNode && toNode) {
            link.fromX = fromNode.x;
            link.fromY = fromNode.y;
            link.toX = toNode.x;
            link.toY = toNode.y;
          }
        });
      }

      // Update particle positions
      particlesRef.current.forEach(particle => {
        particle.progress += particle.speed;
        if (particle.progress > 1) {
          particle.progress = 0;
        }
      });

      // === CLEAR CANVAS ===
      ctx.fillStyle = '#020208';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Apply zoom and pan transform for everything (background moves with content)
      ctx.save();
      ctx.translate(dimensions.width / 2 + panOffset.x, dimensions.height / 2 + panOffset.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-dimensions.width / 2, -dimensions.height / 2);

      // === BACKGROUND (moves with pan) ===
      // Expand bounds to cover area when panned
      const expandSize = Math.max(dimensions.width, dimensions.height) * 2;
      const offsetX = -expandSize / 2;
      const offsetY = -expandSize / 2;
      const bgWidth = dimensions.width + expandSize;
      const bgHeight = dimensions.height + expandSize;

      const bgGradient = ctx.createRadialGradient(
        dimensions.width / 2, dimensions.height / 2, 0,
        dimensions.width / 2, dimensions.height / 2, Math.max(bgWidth, bgHeight)
      );
      bgGradient.addColorStop(0, '#12122a');
      bgGradient.addColorStop(0.5, '#0a0a18');
      bgGradient.addColorStop(1, '#020208');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(offsetX, offsetY, bgWidth, bgHeight);

      // Nebulas (expanded to cover pan area)
      const nebula1 = ctx.createRadialGradient(
        dimensions.width * 0.2, dimensions.height * 0.3, 0,
        dimensions.width * 0.2, dimensions.height * 0.3, dimensions.width * 0.8
      );
      nebula1.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
      nebula1.addColorStop(0.4, 'rgba(139, 92, 246, 0.1)');
      nebula1.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula1;
      ctx.fillRect(offsetX, offsetY, bgWidth, bgHeight);

      const nebula2 = ctx.createRadialGradient(
        dimensions.width * 0.8, dimensions.height * 0.6, 0,
        dimensions.width * 0.8, dimensions.height * 0.6, dimensions.width * 0.7
      );
      nebula2.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
      nebula2.addColorStop(0.4, 'rgba(6, 182, 212, 0.08)');
      nebula2.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula2;
      ctx.fillRect(offsetX, offsetY, bgWidth, bgHeight);

      const nebula3 = ctx.createRadialGradient(
        dimensions.width * 0.5, dimensions.height * 0.9, 0,
        dimensions.width * 0.5, dimensions.height * 0.9, dimensions.width * 0.6
      );
      nebula3.addColorStop(0, 'rgba(236, 72, 153, 0.18)');
      nebula3.addColorStop(0.4, 'rgba(236, 72, 153, 0.06)');
      nebula3.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula3;
      ctx.fillRect(offsetX, offsetY, bgWidth, bgHeight);

      // Stars (now move with pan)
      starsRef.current.forEach((star) => {
        const twinkle = star.brightness + 0.2 * Math.sin(time * 1.5 + star.x * 0.01);
        ctx.beginPath();
        ctx.arc(star.x, star.y, Math.max(0.3, star.size), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, twinkle)})`;
        ctx.fill();
      });

      // === ICM LINKS (straight lines) ===
      linksRef.current.forEach((link, i) => {
        const pulse = 0.5 + 0.15 * Math.sin(time * 1.5 + i * 0.3);
        
        ctx.beginPath();
        ctx.moveTo(link.fromX, link.fromY);
        ctx.lineTo(link.toX, link.toY);
        
        const linkGradient = ctx.createLinearGradient(link.fromX, link.fromY, link.toX, link.toY);
        linkGradient.addColorStop(0, colorToRgba(link.fromColor, 0.15 * pulse));
        linkGradient.addColorStop(0.5, `rgba(150, 220, 255, ${0.12 * pulse})`);
        linkGradient.addColorStop(1, colorToRgba(link.toColor, 0.15 * pulse));
        
        ctx.strokeStyle = linkGradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // === MESSAGE PARTICLES ===
      particlesRef.current.forEach((particle) => {
        const link = linksRef.current[particle.linkIndex];
        if (!link) return;
        
        const pos = getPointOnLine(
          particle.progress,
          link.fromX, link.fromY,
          link.toX, link.toY
        );
        
        // Interpolate color along path
        const colorProgress = particle.progress;
        const fromRgba = colorToRgba(link.fromColor, 1);
        const toRgba = colorToRgba(link.toColor, 1);
        const r1 = parseInt(fromRgba.match(/\d+/g)![0]);
        const g1 = parseInt(fromRgba.match(/\d+/g)![1]);
        const b1 = parseInt(fromRgba.match(/\d+/g)![2]);
        const r2 = parseInt(toRgba.match(/\d+/g)![0]);
        const g2 = parseInt(toRgba.match(/\d+/g)![1]);
        const b2 = parseInt(toRgba.match(/\d+/g)![2]);
        
        const r = Math.round(r1 + (r2 - r1) * colorProgress);
        const g = Math.round(g1 + (g2 - g1) * colorProgress);
        const b = Math.round(b1 + (b2 - b1) * colorProgress);
        
        // Outer glow
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
        ctx.fill();
        
        // Particle body
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
        ctx.fill();
        
        // Bright center
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
      });

      // === CHAIN CIRCLES ===
      const nodes = nodesRef.current;
      const currentHoveredId = hoveredChainRef.current;
      
      // Find max TPS for normalization
      const maxTps = Math.max(...nodes.map(n => n.tps || 0), 1);
      
      nodes.forEach((node) => {
        const isSelected = selectedChain?.id === node.id;
        const isHovered = currentHoveredId === node.id;
        const scale = isSelected ? 1.12 : (isHovered ? 1.08 : 1);
        
        // TPS-based pulse wave effect (expanding rings)
        const tpsRatio = Math.sqrt((node.tps || 0) / maxTps); // sqrt for non-linear mapping
        
        // Draw pulse waves for ANY chain with TPS > 0 (normalized relative to others)
        if ((node.tps || 0) > 0) {
          const pulseSpeed = 0.6 + tpsRatio * 2.0; // 0.6 for lowest, up to 2.6 for highest
          // Dynamic wave count: min 3, max 10, scaled by TPS ratio
          const minWaves = 3;
          const maxWaves = 10;
          const minDistance = 20;
          const maxDistance = 35;
          const fadeCurve = 1.5;
          const numWaves = Math.round(minWaves + tpsRatio * (maxWaves - minWaves));
          
          for (let w = 0; w < numWaves; w++) {
            // Each wave is offset in phase (evenly distributed)
            const wavePhase = (time * pulseSpeed + w * (Math.PI * 2 / numWaves)) % (Math.PI * 2);
            const waveProgress = wavePhase / (Math.PI * 2); // 0 to 1
            
            // Wave expands from chain edge outward
            const waveRadius = node.radius * scale + waveProgress * (maxDistance + tpsRatio * (maxDistance - minDistance));
            // Wave fades out as it expands
            const waveAlpha = Math.pow(1 - waveProgress, fadeCurve) * (0.35 + tpsRatio * 0.25);
            
            if (waveAlpha > 0.02) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, waveRadius, 0, Math.PI * 2);
              ctx.strokeStyle = colorToRgba(node.color, waveAlpha);
              ctx.lineWidth = 1.5 + (1 - waveProgress) * 1.5; // Thicker at start, thinner as it expands
              ctx.stroke();
            }
          }
        }

        // Outer glow for hovered/selected
        if (isHovered || isSelected) {
          const glowRadius = node.radius * scale + (isSelected ? 30 : 25);
          const glowGradient = ctx.createRadialGradient(
            node.x, node.y, node.radius * scale,
            node.x, node.y, glowRadius
          );
          glowGradient.addColorStop(0, colorToRgba(node.color, isSelected ? 0.8 : 0.6));
          glowGradient.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = glowGradient;
          ctx.fill();
        }

        // Simple filled circle - NO material/glass effect, fixed size
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * scale, 0, Math.PI * 2);
        ctx.fillStyle = colorToRgba(node.color, isSelected ? 0.45 : (isHovered ? 0.35 : 0.25));
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * scale, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected
          ? 'rgba(255, 255, 255, 1)'
          : (isHovered 
            ? 'rgba(255, 255, 255, 0.9)' 
            : colorToRgba(node.color, 0.7));
        ctx.lineWidth = isSelected ? 4 : (isHovered ? 3 : 2);
        ctx.stroke();

        // Validators (solid white dots) - showing actual count
        node.validators.forEach((validator) => {
          const vx = node.x + validator.localX * scale;
          const vy = node.y + validator.localY * scale;
          
          ctx.beginPath();
          ctx.arc(vx, vy, validator.radius * scale, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fill();
        });

        // Chain name label with logo - show ALL chains
        const labelFontSize = Math.max(8, Math.min(11, node.radius / 3));
        const logoSize = labelFontSize + 2;
        const labelY = node.y + node.radius * scale + 12;
        
        // Draw logo if available
        const logoImg = logoImagesRef.current.get(node.id);
        const hasLogo = logoImg && logoImg.complete && logoImg.naturalWidth > 0;
        
        ctx.font = `${isHovered ? 'bold ' : ''}${labelFontSize}px Inter, system-ui, sans-serif`;
        const textWidth = ctx.measureText(node.name).width;
        const totalWidth = hasLogo ? logoSize + 4 + textWidth : textWidth;
        const startX = node.x - totalWidth / 2;
        
        if (hasLogo) {
          // Draw circular logo
          ctx.save();
          ctx.beginPath();
          ctx.arc(startX + logoSize / 2, labelY, logoSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(logoImg, startX, labelY - logoSize / 2, logoSize, logoSize);
          ctx.restore();
          
          // Draw logo border
          ctx.beginPath();
          ctx.arc(startX + logoSize / 2, labelY, logoSize / 2, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        
        // Draw chain name
        const textX = hasLogo ? startX + logoSize + 4 : node.x;
        ctx.textAlign = hasLogo ? 'left' : 'center';
        ctx.textBaseline = 'middle';
        
        // Text shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillText(node.name, textX + 1, labelY + 1);
        
        // Text
        ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(node.name, textX, labelY);
      });

      // Restore transform
      ctx.restore();

      // Watermark (drawn after restore so it stays fixed)
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillText('AVALANCHE NETWORK', dimensions.width / 2, dimensions.height - 20);
      
      // Zoom indicator
      if (zoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0) {
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(zoom * 100)}%`, dimensions.width - 15, 25);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, resolvedTheme, simulatePhysics, zoom, panOffset, selectedChain]);

  // Mouse interactions
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Handle dragging for pan
    if (isDragging) {
      const dx = screenX - dragStartRef.current.x;
      const dy = screenY - dragStartRef.current.y;
      setPanOffset({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
      return;
    }

    // Transform screen coordinates to world coordinates for hover detection
    const worldPos = screenToWorld(screenX, screenY);

    let found: ChainNode | null = null;
    for (const node of nodesRef.current) {
      const distance = Math.sqrt((worldPos.x - node.x) ** 2 + (worldPos.y - node.y) ** 2);
      if (distance < node.radius) {
        found = node;
        break;
      }
    }

    // Only update hover if no chain is selected
    if (!selectedChain) {
      setHoveredChain(found);
      if (onChainHover) {
        onChainHover(found ? data.find(c => c.id === found!.id) || null : null);
      }
    }
  }, [data, onChainHover, isDragging, screenToWorld, selectedChain]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    dragStartRef.current = {
      x: screenX,
      y: screenY,
    };
    panStartRef.current = { ...panOffset };
    
    // Check if clicking on a chain
    const worldPos = screenToWorld(screenX, screenY);
    let clickedChain: ChainNode | null = null;
    for (const node of nodesRef.current) {
      const distance = Math.sqrt((worldPos.x - node.x) ** 2 + (worldPos.y - node.y) ** 2);
      if (distance < node.radius) {
        clickedChain = node;
        break;
      }
    }
    
    // If clicking on a chain, select/deselect it (don't start dragging)
    if (clickedChain) {
      if (selectedChain?.id === clickedChain.id) {
        // Deselect if clicking the same chain
        setSelectedChain(null);
        setHoveredChain(clickedChain);
      } else {
        // Select the clicked chain
        setSelectedChain(clickedChain);
        setHoveredChain(null);
      }
      setIsDragging(false);
    } else {
      // Deselect when clicking empty space and start dragging
      if (selectedChain) {
        setSelectedChain(null);
      }
      setIsDragging(true);
    }
  }, [panOffset, selectedChain, screenToWorld]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    // Only clear hover if no chain is selected
    if (!selectedChain) {
      setHoveredChain(null);
      if (onChainHover) {
        onChainHover(null);
      }
    }
  }, [onChainHover, selectedChain]);

  // Zoom with mouse wheel (reduced sensitivity)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const minZoom = calculateMinZoom();
    const delta = e.deltaY > 0 ? 0.97 : 1.03; // Very gentle zoom
    const newZoom = Math.max(minZoom, Math.min(5, zoom * delta));
    
    // Zoom towards mouse position
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      
      // Calculate new pan to zoom towards mouse
      const zoomRatio = newZoom / zoom;
      const newPanX = mouseX - (mouseX - centerX - panOffset.x) * zoomRatio - centerX;
      const newPanY = mouseY - (mouseY - centerY - panOffset.y) * zoomRatio - centerY;
      
      setPanOffset({ x: newPanX, y: newPanY });
    }
    
    setZoom(newZoom);
  }, [zoom, dimensions, panOffset, calculateMinZoom]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches.length === 1) {
      // Single touch - pan or select chain
      const touch = e.touches[0];
      const screenX = touch.clientX - rect.left;
      const screenY = touch.clientY - rect.top;
      
      dragStartRef.current = { x: screenX, y: screenY };
      panStartRef.current = { ...panOffset };
      
      // Check if touching a chain
      const worldPos = screenToWorld(screenX, screenY);
      let touchedChain: ChainNode | null = null;
      for (const node of nodesRef.current) {
        const distance = Math.sqrt((worldPos.x - node.x) ** 2 + (worldPos.y - node.y) ** 2);
        if (distance < node.radius) {
          touchedChain = node;
          break;
        }
      }
      
      if (touchedChain) {
        // Select/deselect chain
        if (selectedChain?.id === touchedChain.id) {
          setSelectedChain(null);
          setHoveredChain(touchedChain);
        } else {
          setSelectedChain(touchedChain);
          setHoveredChain(null);
        }
        setIsDragging(false);
      } else {
        // Deselect and prepare for pan
        if (selectedChain) {
          setSelectedChain(null);
        }
        setIsDragging(true);
      }
      
      // Reset pinch state
      lastTouchDistRef.current = null;
      lastTouchCenterRef.current = null;
    } else if (e.touches.length === 2) {
      // Two finger touch - pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      lastTouchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      
      lastTouchCenterRef.current = {
        x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
        y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
      };
      
      setIsDragging(false);
    }
  }, [panOffset, screenToWorld, selectedChain]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches.length === 1 && isDragging) {
      // Single touch pan
      const touch = e.touches[0];
      const screenX = touch.clientX - rect.left;
      const screenY = touch.clientY - rect.top;
      
      const dx = screenX - dragStartRef.current.x;
      const dy = screenY - dragStartRef.current.y;
      
      setPanOffset({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      
      const newCenter = {
        x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
        y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
      };
      
      // Calculate zoom change
      const scale = newDist / lastTouchDistRef.current;
      const minZoom = calculateMinZoom();
      const newZoom = Math.max(minZoom, Math.min(5, zoom * scale));
      
      // Zoom towards pinch center
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const zoomRatio = newZoom / zoom;
      
      let newPanX = panOffset.x;
      let newPanY = panOffset.y;
      
      if (lastTouchCenterRef.current) {
        newPanX = newCenter.x - (newCenter.x - centerX - panOffset.x) * zoomRatio - centerX;
        newPanY = newCenter.y - (newCenter.y - centerY - panOffset.y) * zoomRatio - centerY;
      }
      
      setPanOffset({ x: newPanX, y: newPanY });
      setZoom(newZoom);
      
      lastTouchDistRef.current = newDist;
      lastTouchCenterRef.current = newCenter;
    }
  }, [isDragging, zoom, panOffset, dimensions, calculateMinZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      setIsDragging(false);
      lastTouchDistRef.current = null;
      lastTouchCenterRef.current = null;
    } else if (e.touches.length === 1) {
      // Went from 2 fingers to 1 - reset to pan mode
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        dragStartRef.current = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
        panStartRef.current = { ...panOffset };
        setIsDragging(true);
      }
      lastTouchDistRef.current = null;
      lastTouchCenterRef.current = null;
    }
  }, [panOffset]);

  // Reset zoom and pan
  const handleResetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);
  
  // Zoom in/out handlers that respect min zoom
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(5, z * 1.1)); // Gentle zoom step
  }, []);
  
  const handleZoomOut = useCallback(() => {
    const minZoom = calculateMinZoom();
    setZoom(z => Math.max(minZoom, z * 0.9)); // Gentle zoom step
  }, [calculateMinZoom]);

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full ${isFullscreen ? 'h-screen' : 'h-full'} overflow-hidden`}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />
      
      {/* Controls - fullscreen and zoom */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 bg-black/50 backdrop-blur-sm rounded-lg p-1 z-10">
        {/* Fullscreen toggle - only show if supported */}
        {supportsFullscreen && (
          <>
            <button
              onClick={toggleFullscreen}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); toggleFullscreen(); }}
              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-white/80 hover:text-white active:bg-white/20 hover:bg-white/10 rounded transition-colors touch-manipulation"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
                  <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                  <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
                  <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                  <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                </svg>
              )}
            </button>
            
            <div className="w-full h-px bg-white/20 my-0.5" />
          </>
        )}
        
        {/* Zoom in */}
        <button
          onClick={handleZoomIn}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleZoomIn(); }}
          className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-white/80 hover:text-white active:bg-white/20 hover:bg-white/10 rounded transition-colors touch-manipulation"
          title="Zoom in"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        
        {/* Zoom out */}
        <button
          onClick={handleZoomOut}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleZoomOut(); }}
          className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-white/80 hover:text-white active:bg-white/20 hover:bg-white/10 rounded transition-colors touch-manipulation"
          title="Zoom out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        
        {/* Reset view */}
        {(zoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
          <button
            onClick={handleResetView}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleResetView(); }}
            className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-white/80 hover:text-white active:bg-white/20 hover:bg-white/10 rounded transition-colors touch-manipulation"
            title="Reset view"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
        )}
      </div>

      {(selectedChain || hoveredChain) && (() => {
        const displayChain = selectedChain || hoveredChain;
        if (!displayChain) return null;
        
        // Calculate ICM routes for this chain
        const chainId = displayChain.chainId;
        const outgoingRoutes = icmFlows
          .filter(f => f.sourceChainId === chainId)
          .sort((a, b) => b.messageCount - a.messageCount)
          .slice(0, 3);
        const incomingRoutes = icmFlows
          .filter(f => f.targetChainId === chainId)
          .sort((a, b) => b.messageCount - a.messageCount)
          .slice(0, 3);
        
        const totalOutgoing = icmFlows
          .filter(f => f.sourceChainId === chainId)
          .reduce((sum, f) => sum + f.messageCount, 0);
        const totalIncoming = icmFlows
          .filter(f => f.targetChainId === chainId)
          .reduce((sum, f) => sum + f.messageCount, 0);
        
        // Get chain names for routes
        const getChainName = (cId: string) => {
          const node = nodesRef.current.find(n => n.chainId === cId);
          return node?.name || cId.slice(0, 8) + '...';
        };
        
        // Get chain slug for navigation
        const getChainSlug = (chainId?: string, chainName?: string): string | null => {
          if (!chainId && !chainName) return null;
          const chain = l1ChainsData.find(
            (c: any) => c.chainId === chainId || c.chainName.toLowerCase() === chainName?.toLowerCase()
          );
          return chain?.slug || null;
        };
        
        const chainSlug = getChainSlug(displayChain.chainId, displayChain.name);

        // Format number helper
        const formatNum = (n: number | undefined) => {
          if (n === undefined || n === null) return 'N/A';
          if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
          if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
          if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
          return n.toLocaleString();
        };

        // Category colors
        const getCategoryColor = (cat?: string) => {
          const colors: Record<string, string> = {
            'DeFi': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            'Gaming': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            'Institutions': 'bg-green-500/20 text-green-300 border-green-500/30',
            'RWAs': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
            'Payments': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
          };
          return colors[cat || ''] || 'bg-white/10 text-white/70 border-white/20';
        };
        
        return (
          <div
            className="absolute bottom-4 right-4 z-50 pointer-events-auto max-h-[calc(100vh-120px)] overflow-y-auto"
          >
            <div className="bg-black/95 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl p-4 min-w-[300px] max-w-[380px] relative">
              {/* Close button */}
              <button
                onClick={() => {
                  setSelectedChain(null);
                  setHoveredChain(null);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedChain(null);
                  setHoveredChain(null);
                }}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white active:bg-white/20 hover:bg-white/10 rounded transition-colors touch-manipulation"
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              
              {/* Header */}
              <div className="flex items-center gap-3 mb-3 pr-6">
                {displayChain.logo ? (
                  <img 
                    src={displayChain.logo} 
                    alt={displayChain.name}
                    className="w-12 h-12 rounded-full border border-white/20"
                  />
                ) : (
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold border border-white/20 text-lg"
                    style={{ background: displayChain.color }}
                  >
                    {displayChain.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white text-lg">
                      {displayChain.name}
                    </h3>
                    {displayChain.category && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getCategoryColor(displayChain.category)}`}>
                        {displayChain.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 font-mono">
                    {displayChain.id.slice(0, 20)}...
                  </p>
                </div>
              </div>
              
              {/* Primary Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-white">{formatNum(displayChain.activeAddresses)}</p>
                  <p className="text-[10px] text-white/50">Active Addrs</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-white">{formatNum(displayChain.txCount)}</p>
                  <p className="text-[10px] text-white/50">Daily Tx</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  {displayChain.chainId && failedChainIds.includes(displayChain.chainId) ? (
                    <div className="relative group/icm inline-flex justify-center">
                      <span className="text-amber-400 cursor-pointer">
                        <Info className="w-5 h-5" />
                      </span>
                      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-black border border-amber-400/50 text-amber-300 text-[10px] rounded whitespace-nowrap opacity-0 group-hover/icm:opacity-100 transition-opacity z-[100] pointer-events-none">
                        Data unavailable
                      </span>
                    </div>
                  ) : (
                  <p className="text-lg font-bold text-cyan-400">{formatNum(displayChain.icmMessages)}</p>
                  )}
                  <p className="text-[10px] text-white/50">Daily ICM</p>
                </div>
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-purple-400">{displayChain.validatorCount.toLocaleString()}</p>
                  <p className="text-[10px] text-white/50">Validators</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-400">{displayChain.tps !== undefined ? displayChain.tps : 'N/A'}</p>
                  <p className="text-[10px] text-white/50">Avg TPS</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  {displayChain.chainId && failedChainIds.includes(displayChain.chainId) ? (
                    <div className="relative group/routes inline-flex justify-center">
                      <span className="text-amber-400 cursor-pointer">
                        <Info className="w-5 h-5" />
                      </span>
                      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-black border border-amber-400/50 text-amber-300 text-[10px] rounded whitespace-nowrap opacity-0 group-hover/routes:opacity-100 transition-opacity z-[100] pointer-events-none">
                        Data unavailable
                      </span>
                    </div>
                  ) : (
                  <p className="text-lg font-bold text-amber-400">{formatNum(totalOutgoing + totalIncoming)}</p>
                  )}
                  <p className="text-[10px] text-white/50">ICM Routes</p>
                </div>
              </div>
              
              {/* ICM Routes */}
              {(outgoingRoutes.length > 0 || incomingRoutes.length > 0) && (
                <div className="space-y-3 border-t border-white/10 pt-3">
                  {/* Outgoing */}
                  {outgoingRoutes.length > 0 && (
                    <div>
                      <p className="text-xs text-white/50 mb-1.5 flex items-center gap-1">
                        <span className="text-green-400">↑</span> Top Outgoing Routes
                      </p>
                      <div className="space-y-1">
                        {outgoingRoutes.map((route, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-white/80 truncate max-w-[170px]">
                              → {getChainName(route.targetChainId)}
                            </span>
                            <span className="text-green-400 font-medium">
                              {route.messageCount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Incoming */}
                  {incomingRoutes.length > 0 && (
                    <div>
                      <p className="text-xs text-white/50 mb-1.5 flex items-center gap-1">
                        <span className="text-blue-400">↓</span> Top Incoming Routes
                      </p>
                      <div className="space-y-1">
                        {incomingRoutes.map((route, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-white/80 truncate max-w-[170px]">
                              ← {getChainName(route.sourceChainId)}
                            </span>
                            <span className="text-blue-400 font-medium">
                              {route.messageCount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* No ICM data */}
              {outgoingRoutes.length === 0 && incomingRoutes.length === 0 && (
                <p className="text-xs text-white/40 text-center pt-2 border-t border-white/10">
                  {displayChain.chainId && failedChainIds.includes(displayChain.chainId) 
                    ? 'ICM data unavailable for this chain'
                    : 'No ICM routes for this chain'}
                </p>
              )}
              
              {/* Link to chain stats page */}
              {chainSlug && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <button
                    onClick={() => {
                      window.location.href = `/stats/l1/${chainSlug}`;
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = `/stats/l1/${chainSlug}`;
                    }}
                    className="w-full py-2 text-sm text-cyan-400 hover:text-cyan-300 active:text-cyan-200 transition-colors text-center underline decoration-dotted underline-offset-2 cursor-pointer touch-manipulation"
                  >
                    Click here for more stats →
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-xs text-white/80">
        <p className="font-semibold text-white mb-2">Network</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-purple-400/70 bg-purple-400/20" />
            </div>
            <span>Chain</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
            </div>
            <span>Validator node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 flex items-center justify-center">
              <div className="relative w-5 h-5 flex items-center justify-center">
                <div className="absolute w-3 h-3 rounded-full border border-purple-400/60" />
                <div className="absolute w-4 h-4 rounded-full border border-purple-400/40" />
                <div className="absolute w-5 h-5 rounded-full border border-purple-400/20" />
              </div>
            </div>
            <span>TPS activity wave</span>
          </div>
          {linksRef.current.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-6 flex items-center justify-center">
                <div className="w-5 h-0.5 bg-gradient-to-r from-purple-400 to-cyan-400 opacity-70" />
              </div>
              <span>ICM message route</span>
            </div>
          )}
        </div>
        <div className="mt-2 pt-2 border-t border-white/10 text-white/50">
          <span>Scroll to zoom • Drag to pan</span>
        </div>
      </div>
    </div>
  );
}
