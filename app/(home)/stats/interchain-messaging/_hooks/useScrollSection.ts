"use client";
import { useCallback, useEffect, useState } from "react";
import type { SectionDefinition } from "../_components/types";

const NAVBAR_OFFSET_PX = 180;

// Tracks which on-page section is currently in view based on scroll position
// and exposes a smooth-scroll helper. `sections` should be a stable reference
// (define it module-level or memoize) — the listener captures it on first
// effect run.
export function useScrollSection(
  sections: readonly SectionDefinition[],
  initialId: string
) {
  const [activeSection, setActiveSection] = useState<string>(initialId);

  useEffect(() => {
    const handleScroll = () => {
      const elements = sections.map((sec) =>
        document.getElementById(sec.id)
      );
      const scrollPosition = window.scrollY + NAVBAR_OFFSET_PX;

      for (let i = elements.length - 1; i >= 0; i--) {
        const section = elements[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // sync on mount
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    const elementPosition =
      element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: elementPosition - NAVBAR_OFFSET_PX,
      behavior: "smooth",
    });
  }, []);

  return { activeSection, scrollToSection };
}
