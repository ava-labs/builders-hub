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

export function ThemeProvider({
  children,
  themeColor,
}: {
  children: ReactNode;
  /** the browser chrome colour (meta theme-color) for each theme */
  themeColor: Record<Theme, string>;
}) {
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

  // The browser chrome (a phone's status bar) follows the theme picked on the site, not only the OS scheme. The root
  // layout's viewport export colours the first paint by the OS scheme; once the page runs, a theme-color entry of our
  // own, first in <head> and with no media query, carries the site theme's colour. The browser takes the first entry
  // that matches, and Next re-renders only its own entries (at the end of <head>) when the page changes.
  const chromeColor = themeColor[theme];
  useEffect(() => {
    const meta =
      document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-site-theme]') ??
      Object.assign(document.createElement("meta"), { name: "theme-color" });
    meta.dataset.siteTheme = "";
    meta.content = chromeColor;
    if (document.head.firstElementChild !== meta) document.head.prepend(meta);
  }, [chromeColor]);

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
