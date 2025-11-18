import React, { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * SphereImageGrid - Interactive 3D Image Sphere Component
 *
 * A React TypeScript component that displays images arranged in a 3D sphere layout.
 * Images are distributed using Fibonacci sphere distribution for optimal coverage.
 * Supports drag-to-rotate, momentum physics, auto-rotation, and modal image viewing.
 *
 * Features:
 * - 3D sphere layout with Fibonacci distribution for even image placement
 * - Smooth drag-to-rotate interaction with momentum physics
 * - Auto-rotation capability with configurable speed
 * - Dynamic scaling based on position and visibility
 * - Collision detection to prevent image overlap
 * - Modal view for enlarged image display
 * - Touch support for mobile devices
 * - Customizable appearance and behavior
 * - Performance optimized with proper z-indexing and visibility culling
 *
 * Usage:
 * ```tsx
 * <SphereImageGrid
 *   images={imageArray}
 *   containerSize={600}
 *   sphereRadius={200}
 *   autoRotate={true}
 *   dragSensitivity={0.8}
 * />
 * ```
 */

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface SphericalPosition {
  theta: number; // Azimuth angle in degrees
  phi: number; // Polar angle in degrees
  radius: number; // Distance from center
}

export interface WorldPosition extends Position3D {
  scale: number;
  zIndex: number;
  isVisible: boolean;
  fadeOpacity: number;
  originalIndex: number;
}

export interface ImageData {
  id: string;
  src: string;
  alt: string;
  title?: string;
  description?: string;
  category?: string; // For category-based border coloring
  link?: string; // External link to open on click
  isPrimary?: boolean; // Flag to make image larger
}

export interface SphereImageGridProps {
  images?: ImageData[];
  containerSize?: number;
  sphereRadius?: number;
  dragSensitivity?: number;
  momentumDecay?: number;
  maxRotationSpeed?: number;
  baseImageScale?: number;
  hoverScale?: number;
  perspective?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  className?: string;
}

interface RotationState {
  x: number;
  y: number;
  z: number;
}

interface VelocityState {
  x: number;
  y: number;
}

interface MousePosition {
  x: number;
  y: number;
}

// ==========================================
// CONSTANTS & CONFIGURATION
// ==========================================

const SPHERE_MATH = {
  degreesToRadians: (degrees: number): number => degrees * (Math.PI / 180),
  radiansToDegrees: (radians: number): number => radians * (180 / Math.PI),

  sphericalToCartesian: (
    radius: number,
    theta: number,
    phi: number
  ): Position3D => ({
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  }),

  calculateDistance: (
    pos: Position3D,
    center: Position3D = { x: 0, y: 0, z: 0 }
  ): number => {
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;
    const dz = pos.z - center.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  normalizeAngle: (angle: number): number => {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  },
};

// ==========================================
// MAIN COMPONENT
// ==========================================

const SphereImageGrid: React.FC<SphereImageGridProps> = ({
  images = [],
  containerSize = 400,
  sphereRadius = 200,
  dragSensitivity = 0.5,
  momentumDecay = 0.95,
  maxRotationSpeed = 5,
  baseImageScale = 0.12,
  hoverScale = 1.2,
  perspective = 1000,
  autoRotate = false,
  autoRotateSpeed = 0.3,
  className = "",
}) => {
  // ==========================================
  // STATE & REFS
  // ==========================================

  const [isMounted, setIsMounted] = useState<boolean>(true);
  const [rotation, setRotation] = useState<RotationState>({
    x: 90,
    y: 45,
    z: 0,
  });
  const [velocity, setVelocity] = useState<VelocityState>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [imagePositions, setImagePositions] = useState<SphericalPosition[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showDragHint, setShowDragHint] = useState<boolean>(true);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef<MousePosition>({ x: 0, y: 0 });
  const animationFrame = useRef<number | null>(null);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const actualSphereRadius = sphereRadius || containerSize * 0.5;
  const baseImageSize = containerSize * baseImageScale;

  // ==========================================
  // UTILITY FUNCTIONS
  // ==========================================

  const generateSpherePositions = useCallback((): SphericalPosition[] => {
    const positions: SphericalPosition[] = [];
    // Only generate positions for non-primary images
    const nonPrimaryImages = images.filter((img) => !img.isPrimary);
    const imageCount = nonPrimaryImages.length;

    // Check if there's a primary image to add offset
    const hasPrimary = images.some((img) => img.isPrimary);

    if (hasPrimary) {
      // If there's a primary image, arrange others in symmetric rings around it
      const radiusMultiplier = 1.25; // Closer to the primary logo
      const adjustedRadius = actualSphereRadius * radiusMultiplier;

      // Distribute in symmetric horizontal rings
      const verticalBands = 4; // 4 rings for symmetry

      for (let i = 0; i < imageCount; i++) {
        // Distribute evenly around horizontal angle - perfectly symmetric
        const theta = (i / imageCount) * 360;

        // Symmetric vertical distribution
        const bandIndex = i % verticalBands;
        const phi = 50 + (bandIndex / (verticalBands - 1)) * 80; // 50 to 130 degrees

        // Minimal randomization for slight organic feel but keep symmetry
        const randomTheta = theta + (Math.random() - 0.5) * 5;
        const randomPhi = phi + (Math.random() - 0.5) * 3;

        positions.push({
          theta: randomTheta % 360,
          phi: Math.max(50, Math.min(130, randomPhi)),
          radius: adjustedRadius,
        });
      }
    } else {
      // Original Fibonacci sphere distribution for when there's no primary
      const goldenRatio = (1 + Math.sqrt(5)) / 2;
      const angleIncrement = (2 * Math.PI) / goldenRatio;

      for (let i = 0; i < imageCount; i++) {
        const t = i / imageCount;
        const inclination = Math.acos(1 - 2 * t);
        const azimuth = angleIncrement * i;

        let phi = inclination * (180 / Math.PI);
        let theta = (azimuth * (180 / Math.PI)) % 360;

        const poleBonus = Math.pow(Math.abs(phi - 90) / 90, 0.6) * 35;
        if (phi < 90) {
          phi = Math.max(5, phi - poleBonus);
        } else {
          phi = Math.min(175, phi + poleBonus);
        }

        phi = 15 + (phi / 180) * 150;

        const randomOffset = (Math.random() - 0.5) * 20;
        theta = (theta + randomOffset) % 360;
        phi = Math.max(0, Math.min(180, phi + (Math.random() - 0.5) * 10));

        positions.push({
          theta: theta,
          phi: phi,
          radius: actualSphereRadius,
        });
      }
    }

    return positions;
  }, [images, actualSphereRadius]);

  const calculateWorldPositions = useCallback((): WorldPosition[] => {
    const positions = imagePositions.map((pos, index) => {
      // Apply rotation using proper 3D rotation matrices
      const thetaRad = SPHERE_MATH.degreesToRadians(pos.theta);
      const phiRad = SPHERE_MATH.degreesToRadians(pos.phi);
      const rotXRad = SPHERE_MATH.degreesToRadians(rotation.x);
      const rotYRad = SPHERE_MATH.degreesToRadians(rotation.y);

      // Initial position on sphere
      let x = pos.radius * Math.sin(phiRad) * Math.cos(thetaRad);
      let y = pos.radius * Math.cos(phiRad);
      let z = pos.radius * Math.sin(phiRad) * Math.sin(thetaRad);

      // Apply Y-axis rotation (horizontal drag)
      const x1 = x * Math.cos(rotYRad) + z * Math.sin(rotYRad);
      const z1 = -x * Math.sin(rotYRad) + z * Math.cos(rotYRad);
      x = x1;
      z = z1;

      // Apply X-axis rotation (vertical drag)
      const y2 = y * Math.cos(rotXRad) - z * Math.sin(rotXRad);
      const z2 = y * Math.sin(rotXRad) + z * Math.cos(rotXRad);
      y = y2;
      z = z2;

      const worldPos: Position3D = { x, y, z };

      // Calculate visibility with smooth fade zones - adjusted to show more items
      const fadeZoneStart = -50; // Start fading out (increased from -10)
      const fadeZoneEnd = -100; // Completely hidden (increased from -30)
      const isVisible = worldPos.z > fadeZoneEnd;

      // Calculate fade opacity based on Z position
      let fadeOpacity = 1;
      if (worldPos.z <= fadeZoneStart) {
        // Linear fade from 1 to 0 as Z goes from fadeZoneStart to fadeZoneEnd
        fadeOpacity = Math.max(
          0,
          (worldPos.z - fadeZoneEnd) / (fadeZoneStart - fadeZoneEnd)
        );
      }

      // Check if this image originated from a pole position
      const isPoleImage = pos.phi < 30 || pos.phi > 150; // Images from extreme angles

      // Calculate distance from center for scaling (in 2D screen space)
      const distanceFromCenter = Math.sqrt(
        worldPos.x * worldPos.x + worldPos.y * worldPos.y
      );
      const maxDistance = actualSphereRadius;
      const distanceRatio = Math.min(distanceFromCenter / maxDistance, 1);

      // Scale based on distance from center - be more forgiving for pole images
      const distancePenalty = isPoleImage ? 0.4 : 0.7; // Less penalty for pole images
      const centerScale = Math.max(0.3, 1 - distanceRatio * distancePenalty);

      // Also consider Z-depth for additional scaling
      const depthScale =
        (worldPos.z + actualSphereRadius) / (2 * actualSphereRadius);
      const scale = centerScale * Math.max(0.5, 0.8 + depthScale * 0.3);

      return {
        ...worldPos,
        scale,
        zIndex: Math.round(1000 + worldPos.z),
        isVisible,
        fadeOpacity,
        originalIndex: index,
      };
    });

    // Apply collision detection to prevent overlaps
    const adjustedPositions = [...positions];

    for (let i = 0; i < adjustedPositions.length; i++) {
      const pos = adjustedPositions[i];
      if (!pos.isVisible) continue;

      let adjustedScale = pos.scale;
      const imageSize = baseImageSize * adjustedScale;

      // Check for overlaps with other visible images
      for (let j = 0; j < adjustedPositions.length; j++) {
        if (i === j) continue;

        const other = adjustedPositions[j];
        if (!other.isVisible) continue;

        const otherSize = baseImageSize * other.scale;

        // Calculate 2D distance between images on screen
        const dx = pos.x - other.x;
        const dy = pos.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Minimum distance to prevent overlap (with more generous padding)
        const minDistance = (imageSize + otherSize) / 2 + 25;

        if (distance < minDistance && distance > 0) {
          // More aggressive scale reduction to prevent overlap
          const overlap = minDistance - distance;
          const reductionFactor = Math.max(
            0.4,
            1 - (overlap / minDistance) * 0.6
          );
          adjustedScale = Math.min(
            adjustedScale,
            adjustedScale * reductionFactor
          );
        }
      }

      adjustedPositions[i] = {
        ...pos,
        scale: Math.max(0.25, adjustedScale), // Ensure minimum scale
      };
    }

    return adjustedPositions;
  }, [imagePositions, rotation, actualSphereRadius, baseImageSize]);

  const clampRotationSpeed = useCallback(
    (speed: number): number => {
      return Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, speed));
    },
    [maxRotationSpeed]
  );

  // ==========================================
  // PHYSICS & MOMENTUM
  // ==========================================

  const updateMomentum = useCallback(() => {
    if (isDragging) return;

    setVelocity((prev) => {
      const newVelocity = {
        x: prev.x * momentumDecay,
        y: prev.y * momentumDecay,
      };

      // Stop animation if velocity is too low and auto-rotate is off
      if (
        !autoRotate &&
        Math.abs(newVelocity.x) < 0.01 &&
        Math.abs(newVelocity.y) < 0.01
      ) {
        return { x: 0, y: 0 };
      }

      return newVelocity;
    });

    setRotation((prev) => {
      let newY = prev.y;

      // Add auto-rotation to Y axis (horizontal rotation)
      if (autoRotate) {
        newY += autoRotateSpeed;
      }

      // Add momentum-based rotation
      newY += clampRotationSpeed(velocity.y);

      return {
        x: SPHERE_MATH.normalizeAngle(prev.x + clampRotationSpeed(velocity.x)),
        y: SPHERE_MATH.normalizeAngle(newY),
        z: prev.z,
      };
    });
  }, [
    isDragging,
    momentumDecay,
    velocity,
    clampRotationSpeed,
    autoRotate,
    autoRotateSpeed,
  ]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setVelocity({ x: 0, y: 0 });
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (!hasInteracted) {
      setHasInteracted(true);
      setShowDragHint(false);
    }
  }, [hasInteracted]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;

      const rotationDelta = {
        x: -deltaY * dragSensitivity,
        y: deltaX * dragSensitivity,
      };

      setRotation((prev) => ({
        x: SPHERE_MATH.normalizeAngle(
          prev.x + clampRotationSpeed(rotationDelta.x)
        ),
        y: SPHERE_MATH.normalizeAngle(
          prev.y + clampRotationSpeed(rotationDelta.y)
        ),
        z: prev.z,
      }));

      // Update velocity for momentum
      setVelocity({
        x: clampRotationSpeed(rotationDelta.x),
        y: clampRotationSpeed(rotationDelta.y),
      });

      lastMousePos.current = { x: e.clientX, y: e.clientY };
    },
    [isDragging, dragSensitivity, clampRotationSpeed]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    setVelocity({ x: 0, y: 0 });
    lastMousePos.current = { x: touch.clientX, y: touch.clientY };
    if (!hasInteracted) {
      setHasInteracted(true);
      setShowDragHint(false);
    }
  }, [hasInteracted]);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      const touch = e.touches[0];
      const deltaX = touch.clientX - lastMousePos.current.x;
      const deltaY = touch.clientY - lastMousePos.current.y;

      const rotationDelta = {
        x: -deltaY * dragSensitivity,
        y: deltaX * dragSensitivity,
      };

      setRotation((prev) => ({
        x: SPHERE_MATH.normalizeAngle(
          prev.x + clampRotationSpeed(rotationDelta.x)
        ),
        y: SPHERE_MATH.normalizeAngle(
          prev.y + clampRotationSpeed(rotationDelta.y)
        ),
        z: prev.z,
      }));

      setVelocity({
        x: clampRotationSpeed(rotationDelta.x),
        y: clampRotationSpeed(rotationDelta.y),
      });

      lastMousePos.current = { x: touch.clientX, y: touch.clientY };
    },
    [isDragging, dragSensitivity, clampRotationSpeed]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ==========================================
  // EFFECTS & LIFECYCLE
  // ==========================================

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setImagePositions(generateSpherePositions());
  }, [generateSpherePositions]);

  useEffect(() => {
    const animate = () => {
      updateMomentum();
      animationFrame.current = requestAnimationFrame(animate);
    };

    if (isMounted) {
      animationFrame.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [isMounted, updateMomentum]);

  useEffect(() => {
    if (!isMounted) return;

    const container = containerRef.current;
    if (!container) return;

    // Mouse events
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Touch events
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    isMounted,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
  ]);

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  // Calculate world positions once per render
  const worldPositions = calculateWorldPositions();

  // Helper function to get border color based on category
  const getCategoryBorderColor = useCallback((category?: string): string => {
    if (!category) return "rgba(255, 255, 255, 0.2)";

    switch (category) {
      case "Primary":
        return "rgb(220, 38, 38)"; // Red for Avalanche
      case "Gaming":
        return "rgb(34, 197, 94)"; // Green
      case "DeFi":
        return "rgb(59, 130, 246)"; // Blue
      case "Enterprise":
        return "rgb(168, 85, 247)"; // Purple
      case "Infrastructure":
        return "rgb(249, 115, 22)"; // Orange
      case "Creative":
        return "rgb(236, 72, 153)"; // Pink
      default:
        return "rgba(255, 255, 255, 0.2)";
    }
  }, []);

  const renderImageNode = useCallback(
    (image: ImageData, index: number) => {
      const isHovered = hoveredIndex === index;
      const borderColor = getCategoryBorderColor(image.category);

      const handleClick = () => {
        if (image.link) {
          window.open(image.link, "_blank", "noopener,noreferrer");
        } else {
          setSelectedImage(image);
        }
      };

      // If it's a primary image (Avalanche), render it in the center
      if (image.isPrimary) {
        const centerSize = baseImageSize * 1.3; // Smaller Avalanche in the center
        const finalScale = isHovered ? 1.1 : 1;

        return (
          <TooltipProvider key={image.id} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute cursor-pointer select-none transition-transform duration-200 ease-out"
                  style={{
                    width: `${centerSize}px`,
                    height: `${centerSize}px`,
                    left: `${containerSize / 2}px`,
                    top: `${containerSize / 2}px`,
                    transform: `translate(-50%, -50%) scale(${finalScale})`,
                    zIndex: 1100,
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={handleClick}
                >
                  <div
                    className="relative w-full h-full rounded-full overflow-hidden shadow-xl transition-all duration-300"
                    style={{
                      border: `4px solid ${borderColor}`,
                      boxShadow: isHovered
                        ? `0 0 30px ${borderColor}`
                        : `0 0 15px ${borderColor}`,
                    }}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="w-full h-full object-cover"
                      draggable={false}
                      loading="eager"
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-white dark:bg-zinc-900 border-red-500/20 text-slate-800 dark:text-slate-100 shadow-xl z-[9999]">
                <div className="text-center px-3 py-2">
                  <p className="font-bold text-sm">{image.title}</p>
                  {image.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {image.description}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      // Regular sphere positioning for non-primary images
      const position = worldPositions[index];
      if (!position || !position.isVisible) return null;

      const imageSize = baseImageSize * position.scale;
      const finalScale = isHovered ? Math.min(1.2, 1.2 / position.scale) : 1;

      return (
        <TooltipProvider key={image.id} delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute cursor-pointer select-none transition-transform duration-200 ease-out"
                style={{
                  width: `${imageSize}px`,
                  height: `${imageSize}px`,
                  left: `${containerSize / 2 + position.x}px`,
                  top: `${containerSize / 2 + position.y}px`,
                  opacity: position.fadeOpacity,
                  transform: `translate(-50%, -50%) scale(${finalScale})`,
                  zIndex: position.zIndex,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={handleClick}
              >
                <div
                  className="relative w-full h-full rounded-full overflow-hidden shadow-lg transition-all duration-300"
                  style={{
                    border: `3px solid ${borderColor}`,
                    boxShadow: isHovered ? `0 0 20px ${borderColor}` : undefined,
                  }}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                    draggable={false}
                    loading={index < 3 ? "eager" : "lazy"}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-100 shadow-xl z-[9999]">
              <div className="text-center px-3 py-2">
                <p className="font-bold text-sm">{image.title}</p>
                {image.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {image.description}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    [
      worldPositions,
      baseImageSize,
      containerSize,
      hoveredIndex,
      getCategoryBorderColor,
    ]
  );

  const renderSpotlightModal = () => {
    if (!selectedImage) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => setSelectedImage(null)}
        style={{
          animation: "fadeIn 0.3s ease-out",
        }}
      >
        <div
          className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          style={{
            animation: "scaleIn 0.3s ease-out",
          }}
        >
          <div className="relative aspect-square">
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black bg-opacity-50 rounded-full text-white flex items-center justify-center hover:bg-opacity-70 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {(selectedImage.title || selectedImage.description) && (
            <div className="p-6">
              {selectedImage.title && (
                <h3 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">
                  {selectedImage.title}
                </h3>
              )}
              {selectedImage.description && (
                <p className="text-zinc-600 dark:text-zinc-400">
                  {selectedImage.description}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // EARLY RETURNS
  // ==========================================

  if (!isMounted) {
    return (
      <div
        className="bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"
        style={{ width: containerSize, height: containerSize }}
      >
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!images.length) {
    return (
      <div
        className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
        style={{ width: containerSize, height: containerSize }}
      >
        <div className="text-gray-400 text-center">
          <p>No images provided</p>
          <p className="text-sm">Add images to the images prop</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes sphereEntrance {
          from {
            transform: scale(0.85);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes dragHintPulse {
          0%, 100% { 
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
          50% { 
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 1;
          }
        }
        @keyframes dragHintFadeOut {
          from { opacity: 0.8; }
          to { opacity: 0; }
        }
        @keyframes handGesture {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(3px, -3px); }
          75% { transform: translate(-3px, 3px); }
        }
      `}</style>

      <div
        ref={containerRef}
        className={`relative select-none cursor-grab active:cursor-grabbing ${className}`}
        style={{
          width: containerSize,
          height: containerSize,
          perspective: `${perspective}px`,
          animation: 'sphereEntrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="relative w-full h-full" style={{ zIndex: 10 }}>
          {images.map((image, imageIndex) => {
            // For primary images, pass the image index directly
            if (image.isPrimary) {
              return renderImageNode(image, imageIndex);
            }
            // For non-primary images, calculate their position index
            // (excluding primary images from the count)
            const nonPrimaryIndex = images
              .slice(0, imageIndex)
              .filter((img) => !img.isPrimary).length;
            return renderImageNode(image, nonPrimaryIndex);
          })}
        </div>
      </div>

      {/* Drag Hint Indicator */}
      {showDragHint && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            bottom: '140px',
            transform: 'translateX(-50%)',
            animation: hasInteracted 
              ? 'dragHintFadeOut 0.5s ease-out forwards' 
              : 'dragHintPulse 2s ease-in-out infinite',
            zIndex: 9999,
          }}
        >
          <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-900/50 backdrop-blur-md px-2 py-1 rounded-full shadow-sm border border-zinc-200/80 dark:border-zinc-800/80">
            <div 
              className="text-sm opacity-70"
              style={{
                animation: 'handGesture 2s ease-in-out infinite',
              }}
            >
              👆
            </div>
            <div className="text-zinc-700 dark:text-zinc-300 text-[10px] font-medium whitespace-nowrap">
              Drag to rotate
            </div>
          </div>
        </div>
      )}

      {renderSpotlightModal()}
    </>
  );
};

export default SphereImageGrid;
