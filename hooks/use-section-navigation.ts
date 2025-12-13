"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface NavCategory {
  id: string;
  label: string;
}

interface UseSectionNavigationOptions {
  categories: NavCategory[];
  offset?: number;
  initialSection?: string;
  updateHash?: boolean;
}

interface UseSectionNavigationReturn {
  activeSection: string;
  scrollToSection: (sectionId: string) => void;
}

export function useSectionNavigation(
  options: UseSectionNavigationOptions
): UseSectionNavigationReturn {
  const { categories, offset = 180, initialSection, updateHash = true } = options;
  const [activeSection, setActiveSection] = useState<string>(
    initialSection || categories[0]?.id || ""
  );

  // Ref to track if we're in a programmatic scroll (prevents scroll listener from fighting)
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle initial hash on mount and hashchange events (browser back/forward only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const scrollToHash = () => {
      // Skip if we're already in a programmatic scroll
      if (isScrollingRef.current) return;

      const hash = window.location.hash.slice(1);
      if (hash) {
        const element = document.getElementById(hash);
        if (element) {
          isScrollingRef.current = true;

          // Small delay to ensure DOM is ready
          setTimeout(() => {
            const elementPosition =
              element.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({
              top: elementPosition - offset,
              behavior: "smooth",
            });
            setActiveSection(hash);

            // Release scroll lock after animation
            setTimeout(() => {
              isScrollingRef.current = false;
            }, 500);
          }, 100);
        }
      }
    };

    // Handle initial hash on mount
    scrollToHash();

    // Listen for hashchange events (browser back/forward)
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [offset]);

  // Track active section on scroll
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      // Skip scroll tracking during programmatic scrolls
      if (isScrollingRef.current) return;

      const sections = categories.map((cat) => document.getElementById(cat.id));
      const scrollPosition = window.scrollY + offset;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          const newActiveSection = categories[i].id;

          // Only update if changed
          if (newActiveSection !== activeSection) {
            setActiveSection(newActiveSection);

            // Update URL hash without triggering scroll (using replaceState)
            if (updateHash && window.location.hash !== `#${newActiveSection}`) {
              window.history.replaceState(null, "", `#${newActiveSection}`);
            }
          }
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Set initial state
    return () => window.removeEventListener("scroll", handleScroll);
  }, [categories, offset, updateHash, activeSection]);

  // Smooth scroll to section and update hash
  const scrollToSection = useCallback(
    (sectionId: string) => {
      const element = document.getElementById(sectionId);
      if (element) {
        // Set scroll lock
        isScrollingRef.current = true;

        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        const elementPosition =
          element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: elementPosition - offset,
          behavior: "smooth",
        });

        setActiveSection(sectionId);

        // Update URL hash
        if (updateHash) {
          window.history.pushState(null, "", `#${sectionId}`);
        }

        // Release scroll lock after animation completes
        scrollTimeoutRef.current = setTimeout(() => {
          isScrollingRef.current = false;
        }, 500);
      }
    },
    [offset, updateHash]
  );

  return { activeSection, scrollToSection };
}
