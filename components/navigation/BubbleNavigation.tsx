"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import type { BubbleNavigationConfig } from "./bubble-navigation.types";

interface BubbleNavigationProps {
  config: BubbleNavigationConfig;
  getActiveItem?: (pathname: string, items: BubbleNavigationConfig['items']) => string;
  activeItem?: string;
  onSelect?: (item: BubbleNavigationConfig['items'][number]) => void;
}

export default function BubbleNavigation({
  config,
  getActiveItem,
  activeItem: controlledActiveItem,
  onSelect,
}: BubbleNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isControlled = typeof controlledActiveItem === "string";
  const [uncontrolledActiveItem, setUncontrolledActiveItem] = useState("");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [bottomOffset, setBottomOffset] = useState(32);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Use custom logic if provided, otherwise default to exact path matching
    if (isControlled) return;

    if (getActiveItem) {
      setUncontrolledActiveItem(getActiveItem(pathname, config.items));
      return;
    }

    const currentItem = config.items.find(
      (item) => item.href && pathname === item.href
    );
      if (currentItem) {
      setUncontrolledActiveItem(currentItem.id);
    }
  }, [pathname, config.items, getActiveItem, isControlled]);

  useEffect(() => {
    const handleScroll = () => {
      const footer = document.querySelector("footer");
      if (!footer) {
        setBottomOffset(32);
        return;
      }

      const footerRect = footer.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const navHeight = 80;
      const margin = 16;

      const distanceToFooter = windowHeight - footerRect.top;

      if (footerRect.top <= windowHeight && footerRect.top > 0) {
        const newBottomOffset = Math.max(
          margin,
          Math.min(distanceToFooter + margin, windowHeight - navHeight - margin)
        );
        setBottomOffset(newBottomOffset);
      } else {
        setBottomOffset(32);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const resolvedActiveItem = isControlled
    ? controlledActiveItem!
    : uncontrolledActiveItem;

  const handleItemClick = (item: BubbleNavigationConfig['items'][0]) => {
    if (onSelect) {
      // Start scroll animation immediately BEFORE state update to prevent blocking
      const learningPathSection = document.getElementById('learning-path-section');
      if (learningPathSection) {
        // Get the section's position and scroll with offset to show the heading
        const yOffset = -125;
        const targetY = learningPathSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
        const startY = window.pageYOffset;
        const distance = targetY - startY;
        const duration = 800; // Reduced to 0.8s for faster response
        let startTime: number | null = null;
        let animationFrameId: number;

        // Easing function: easeOutExpo - starts extremely fast
        const easeOutExpo = (t: number): number => {
          return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        };

        // Cleanup function to stop animation
        const cancelAnimation = () => {
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          window.removeEventListener('wheel', cancelAnimation);
          window.removeEventListener('touchmove', cancelAnimation);
          window.removeEventListener('keydown', cancelAnimation);
          window.removeEventListener('mousedown', cancelAnimation);
        };

        const animation = (currentTime: number) => {
          if (startTime === null) startTime = currentTime;
          const timeElapsed = currentTime - startTime;
          const progress = Math.min(timeElapsed / duration, 1);
          const ease = easeOutExpo(progress);
          
          window.scrollTo(0, startY + distance * ease);
          
          if (progress < 1) {
            animationFrameId = requestAnimationFrame(animation);
          } else {
            cancelAnimation(); // Cleanup listeners when done
          }
        };

        // Add listeners to cancel animation on user interaction
        window.addEventListener('wheel', cancelAnimation, { passive: true });
        window.addEventListener('touchmove', cancelAnimation, { passive: true });
        window.addEventListener('keydown', cancelAnimation, { passive: true });
        window.addEventListener('mousedown', cancelAnimation, { passive: true });

        // Start animation loop
        animationFrameId = requestAnimationFrame(animation);
      }

      // Defer state update slightly to ensure animation frame has priority
      setTimeout(() => {
        onSelect(item);
      }, 0);
      return;
    }

    if (item.href) {
      setUncontrolledActiveItem(item.id);
    router.push(item.href);
    }
  };

  return (
    <div
      ref={navRef}
      className="fixed left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out"
      style={{
        bottom: `${bottomOffset}px`,
      }}
    >
      <nav className={cn(
        "bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border border-gray-200 dark:border-gray-700 rounded-full p-3 shadow-lg",
        config.buttonScale
      )}>
        <div className={cn("flex items-center justify-center", config.buttonSpacing || "space-x-2")}>
          {config.items.map((item) => {
            const isActive = resolvedActiveItem === item.id;
            const isHovered = hoveredItem === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  "cursor-pointer",
                  "relative flex items-center justify-center",
                  "transition-all duration-300 ease-out",
                  "transform-gpu",
                  isActive
                    ? cn(
                        config.activeColor, 
                        config.darkActiveColor, 
                        config.darkTextColor ? "text-white " + config.darkTextColor : "text-white dark:text-white",
                        "shadow-lg"
                      )
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100",
                  isHovered && !isActive ? "scale-105 shadow-md" : "",
                  "hover:shadow-xl",
                  "focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
                  config.focusRingColor,
                  "group",
                  "whitespace-nowrap text-sm font-medium"
                )}
                style={{ padding: "0.625rem", borderRadius: "1.25rem" }}
                aria-label={item.label}
              >
                <span
                  className={cn(
                    "transition-transform duration-2000",
                    isHovered ? "animate-pulse" : ""
                  )}
                >
                  {item.label}
                </span>

                <div
                  className={cn(
                    "absolute inset-0 rounded-full",
                    "bg-gray-300/30 dark:bg-gray-600/30 scale-0",
                    "transition-transform duration-300",
                    isActive ? "animate-ping" : ""
                  )}
                ></div>
              </button>
            );
          })}
        </div>

        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
          <div className="absolute -top-2 -left-2 w-4 h-4 bg-gray-200/40 dark:bg-gray-600/40 rounded-full animate-pulse"></div>
          <div className={cn(
            "absolute -bottom-1 -right-1 w-3 h-3 rounded-full animate-pulse delay-1000",
            config.pulseColor,
            config.darkPulseColor
          )}></div>
          <div className="absolute top-1/2 -left-1 w-2 h-2 bg-gray-300/40 dark:bg-gray-500/40 rounded-full animate-pulse delay-500"></div>
        </div>
      </nav>
    </div>
  );
}
