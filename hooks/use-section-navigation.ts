"use client";

import { useState, useEffect, useCallback } from "react";

export interface NavCategory {
  id: string;
  label: string;
}

interface UseSectionNavigationOptions {
  categories: NavCategory[];
  offset?: number;
  initialSection?: string;
}

interface UseSectionNavigationReturn {
  activeSection: string;
  scrollToSection: (sectionId: string) => void;
}

export function useSectionNavigation(
  options: UseSectionNavigationOptions
): UseSectionNavigationReturn {
  const { categories, offset = 180, initialSection } = options;
  const [activeSection, setActiveSection] = useState<string>(
    initialSection || categories[0]?.id || ""
  );

  // Track active section on scroll
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const sections = categories.map((cat) => document.getElementById(cat.id));
      const scrollPosition = window.scrollY + offset;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(categories[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Set initial state
    return () => window.removeEventListener("scroll", handleScroll);
  }, [categories, offset]);

  // Smooth scroll to section
  const scrollToSection = useCallback(
    (sectionId: string) => {
      const element = document.getElementById(sectionId);
      if (element) {
        const elementPosition =
          element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: elementPosition - offset,
          behavior: "smooth",
        });
      }
    },
    [offset]
  );

  return { activeSection, scrollToSection };
}
