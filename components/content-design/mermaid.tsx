"use client";
import React, { useEffect, useRef, type JSX } from "react";
import mermaid from "mermaid";
import { useTheme } from "./theme-observer";

type MermaidProps = {
  readonly chart: string;
};

/**
 * Optimized Mermaid component with centralized theme observation.
 *
 * Previous implementation: Each diagram created its own MutationObserver (N observers for N diagrams)
 * Optimized implementation: All diagrams share a single theme observer via React context (1 observer for N diagrams)
 *
 * @see https://github.com/ava-labs/builders-hub/issues/2724
 */
const Mermaid = ({ chart }: MermaidProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme(); // Single shared theme observer

  useEffect(() => {
    let destroyed = false;

    const renderDiagram = async (): Promise<void> => {
      if (!containerRef.current) return;

      // Configure theme based on centralized theme state
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === "dark" ? "dark" : "default"
      });

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

    void renderDiagram();

    return () => {
      destroyed = true;
    };
  }, [chart, theme]); // Re-render when theme changes

  // Render an empty container on server; client fills it post-mount
  return <div ref={containerRef} />;
};

export default Mermaid;