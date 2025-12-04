"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { BubbleNavigationConfig } from "./bubble-navigation.types";

interface BubbleNavigationProps {
  config: BubbleNavigationConfig;
  getActiveItem?: (pathname: string, items: BubbleNavigationConfig['items']) => string;
  activeItem?: string;
  onSelect?: (item: BubbleNavigationConfig['items'][number]) => void;
}

// Helper to compute initial active item synchronously
function computeActiveItem(
  pathname: string,
  config: BubbleNavigationConfig,
  getActiveItem?: BubbleNavigationProps["getActiveItem"]
): string {
  if (getActiveItem) {
    return getActiveItem(pathname, config.items);
  }
  const currentItem = config.items.find(
    (item) => item.href && pathname === item.href
  );
  return currentItem?.id || config.items[0]?.id || "";
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

  // Initialize with computed value to avoid animation on mount
  const [uncontrolledActiveItem, setUncontrolledActiveItem] = useState(() =>
    computeActiveItem(pathname, config, getActiveItem)
  );
  const [bottomOffset, setBottomOffset] = useState(32);
  const navRef = useRef<HTMLElement>(null);
  const isInitialMount = useRef(true);

  // Check if any item has an icon (determines which style to use)
  const hasIcons = config.items.some((item) => item.icon);

  useEffect(() => {
    // Skip the first run since we already initialized with the correct value
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isControlled) return;

    const newActiveItem = computeActiveItem(pathname, config, getActiveItem);
    setUncontrolledActiveItem(newActiveItem);
  }, [pathname, config, getActiveItem, isControlled]);

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
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  // Modern icon-based navigation style
  if (hasIcons) {
    return (
      <nav
        ref={navRef}
        className="fixed left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out"
        style={{ bottom: `${bottomOffset}px` }}
      >
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-full px-3 py-3 shadow-md border border-gray-200/50 dark:border-zinc-800/50">
          <div className="flex items-center gap-4">
            {config.items.map((item) => {
              const Icon = item.icon;
              const isActive = resolvedActiveItem === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "relative flex items-center",
                    isActive
                      ? cn(config.activeColor, config.activeTextColor, "gap-3")
                      : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  )}
                  style={{
                    borderRadius: "20px",
                    padding: isActive ? "10px 18px 10px 14px" : "10px",
                    transition: "all 500ms ease-out",
                  }}
                >
                  {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                  <div
                    className={cn(
                      "overflow-hidden",
                      isActive
                        ? "max-w-[100px] opacity-100"
                        : "max-w-0 opacity-0"
                    )}
                    style={{ transition: "all 500ms ease-out" }}
                  >
                    <span className="font-medium text-sm whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    );
  }

  // Legacy text-based navigation style (for backwards compatibility)
  return (
    <div
      className="fixed left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out"
      style={{ bottom: `${bottomOffset}px` }}
    >
      <nav
        className={cn(
          "bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border border-gray-200 dark:border-gray-700 rounded-full p-3 shadow-lg",
          config.buttonScale
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center",
            config.buttonSpacing || "space-x-2"
          )}
        >
          {config.items.map((item) => {
            const isActive = resolvedActiveItem === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
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
                  "focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
                  config.focusRingColor,
                  "whitespace-nowrap text-sm font-medium"
                )}
                style={{ padding: "0.625rem", borderRadius: "1.25rem" }}
                aria-label={item.label}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
