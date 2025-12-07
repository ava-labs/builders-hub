"use client";
import React, { useEffect, useRef, useState } from "react";

const Comments: React.FC = () => {
  const giscusRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const updateTheme = () => {
      const isDarkMode = document.documentElement.classList.contains("dark");
      setTheme(isDarkMode ? "dark" : "light");
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.origin === "https://academy.avax.network"
    ) {
      const updateGiscusTheme = (theme: "light" | "dark") => {
        const iframe = document.querySelector<HTMLIFrameElement>(".giscus-frame");
        if (iframe) {
          iframe.contentWindow?.postMessage(
            { giscus: { setConfig: { theme: theme === "dark" ? "transparent_dark" : "light" } } },
            "https://giscus.app"
          );
        }
      };

      const script = document.createElement("script");
      script.src = "https://giscus.app/client.js";
      script.setAttribute("data-repo", "ava-labs/avalanche-academy");
      script.setAttribute("data-repo-id", "R_kgDOMDfRrg");
      script.setAttribute("data-category", "Discussions");
      script.setAttribute("data-category-id", "DIC_kwDOMDfRrs4CiB5x");
      script.setAttribute("data-mapping", "title");
      script.setAttribute("data-strict", "0");
      script.setAttribute("data-reactions-enabled", "0");
      script.setAttribute("data-emit-metadata", "0");
      script.setAttribute("data-input-position", "bottom");
      script.setAttribute("data-theme", theme === "dark" ? "transparent_dark" : "light");
      script.setAttribute("data-lang", "en");
      script.async = true;

      if (giscusRef.current && !giscusRef.current.hasChildNodes()) {
        giscusRef.current.appendChild(script);

        const observer = new MutationObserver(() => {
          if (document.querySelector(".giscus-frame")) {
            updateGiscusTheme(theme);
            observer.disconnect();
          }
        });
        observer.observe(giscusRef.current, { childList: true, subtree: true });
      } else {
        updateGiscusTheme(theme);
      }
    }
  }, [theme]);

  return <div id="comment-box" ref={giscusRef} />;
};

export default Comments;
