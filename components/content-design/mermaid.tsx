"use client";
import React, { useEffect, type JSX } from "react";
import mermaid from "mermaid";

type MermaidProps = {
  readonly chart: string;
};

const Mermaid = ({ chart }: MermaidProps): JSX.Element => {
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    mermaid.initialize({
      startOnLoad: true,
      theme: isDarkMode ? 'dark' : 'default',
    });
    mermaid.contentLoaded();
  }, []);

  return <div className="mermaid">{chart}</div>;
};

export default Mermaid;