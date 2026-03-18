"use client";
import React, { useEffect, useRef, type JSX } from "react";
import mermaid from "mermaid";

type MermaidProps = {
  readonly chart: string;
};

const Mermaid = ({ chart }: MermaidProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let destroyed = false;

    const renderDiagram = async (): Promise<void> => {
      if (!containerRef.current) return;

      const isDarkMode =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark";

      // Configure theme each time before rendering
      mermaid.initialize({ startOnLoad: false, theme: isDarkMode ? "dark" : "default" });

      // Render to SVG string and inject; avoid SSR/client mismatches
      try {
        // Unique ID only used internally by mermaid render
        const renderId = `mmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(renderId, chart);
        if (!destroyed && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (_err) {
        // Fallback: show raw text if render fails
        if (!destroyed && containerRef.current) {
          containerRef.current.textContent = chart;
        }
      }
    };

    // Initial render on mount
    void renderDiagram();

    // Watch theme toggles on <html>
    const observer = new MutationObserver(() => {
      void renderDiagram();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    // Watch OS theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = (): void => {
      void renderDiagram();
    };
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      destroyed = true;
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, [chart]);

  // Render an empty container on server; client fills it post-mount
  return <div ref={containerRef} />;
};

export default Mermaid;