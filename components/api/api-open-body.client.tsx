"use client";
import { useEffect } from "react";

// automatically open the Body section on OpenAPI pages
export function OpenBodySection() {
  useEffect(() => {
    const openBodySection = () => {
      const buttons = Array.from(document.querySelectorAll("button"));

      buttons.forEach((button) => {
        if (
          button.textContent?.trim().startsWith("Body") &&
          button.getAttribute("data-state") === "closed"
        ) {
          button.click();
        }
      });
    };

    openBodySection();
    const timer = setTimeout(openBodySection, 100);
    return () => clearTimeout(timer);
  }, []);
  
  return null;
}
