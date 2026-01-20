"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Theme Observer Context
 *
 * Provides a centralized theme detection mechanism to avoid creating
 * multiple MutationObservers for each Mermaid diagram on the page.
 *
 * Instead of N observers for N diagrams, we have 1 observer for all diagrams.
 */

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";

    const isDarkMode =
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark";

    return isDarkMode ? "dark" : "light";
  });

  useEffect(() => {
    // Single MutationObserver for the entire application
    const observer = new MutationObserver(() => {
      const isDarkMode =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark";

      setTheme(isDarkMode ? "dark" : "light");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    // Watch OS theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = (): void => {
      const isDarkMode =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark";

      setTheme(isDarkMode ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme
 *
 * This allows Mermaid diagrams to re-render when the theme changes
 * without each diagram needing its own MutationObserver
 */
export function useTheme(): Theme {
  const context = useContext(ThemeContext);

  if (!context) {
    // Fallback for components used outside ThemeProvider
    if (typeof window === "undefined") return "light";

    const isDarkMode =
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark";

    return isDarkMode ? "dark" : "light";
  }

  return context.theme;
}
