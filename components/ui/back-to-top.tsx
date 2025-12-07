"use client";

import * as React from "react";

export function BackToTop() {
  const [showLink, setShowLink] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowLink(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!showLink) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 justify-start text-sm text-muted-foreground mt-3">
      <button
        type="button"
        onClick={scrollToTop}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors border-t pt-4"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="rounded-full border p-1"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
        Back to top
      </button>
    </div>
  );
}
