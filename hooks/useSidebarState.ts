"use client";

import { useState, useEffect, useCallback } from "react";

// v2: every visitor's v1 value held the old default (Primary Network
// collapsed), so a new key is the only way the open default reaches them.
const STORAGE_KEY = "console-sidebar-collapsed-sections-v2";
const LEGACY_STORAGE_KEY = "console-sidebar-collapsed-sections";

interface SidebarStateHook {
  collapsedSections: Set<string>;
  toggleSection: (sectionId: string) => void;
  isCollapsed: (sectionId: string) => boolean;
  setCollapsed: (sectionId: string, collapsed: boolean) => void;
}

/**
 * Hook for persisting sidebar section collapse state in localStorage
 */
export function useSidebarState(defaultCollapsed: string[] = []): SidebarStateHook {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(defaultCollapsed)
  );
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCollapsedSections(new Set(parsed));
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(collapsedSections))
      );
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [collapsedSections, isHydrated]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (sectionId: string) => collapsedSections.has(sectionId),
    [collapsedSections]
  );

  const setCollapsed = useCallback((sectionId: string, collapsed: boolean) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (collapsed) {
        next.add(sectionId);
      } else {
        next.delete(sectionId);
      }
      return next;
    });
  }, []);

  return {
    collapsedSections,
    toggleSection,
    isCollapsed,
    setCollapsed,
  };
}
