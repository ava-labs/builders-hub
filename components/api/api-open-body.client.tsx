"use client";
import { useEffect } from "react";

const PANEL_TRIGGER_ATTR = "data-playground-panel-trigger";

// automatically open all collapsible sections on OpenAPI playground pages
export function OpenBodySection() {
  useEffect(() => {
    const openAllSections = () => {
      const markedButtons = document.querySelectorAll<HTMLButtonElement>(
        `button[${PANEL_TRIGGER_ATTR}][data-state="closed"]`
      );

      if (markedButtons.length > 0) {
        markedButtons.forEach((button) => button.click());
        return;
      }

      const playgroundForms = document.querySelectorAll<HTMLFormElement>("form.bg-fd-card");

      playgroundForms.forEach((form) => {
        const panels = form.querySelectorAll<HTMLElement>(".border-b");

        panels.forEach((panel) => {
          const trigger = panel.querySelector<HTMLButtonElement>("button[data-state]");
          if (!trigger) return;

          trigger.setAttribute(PANEL_TRIGGER_ATTR, "true");
          if (trigger.getAttribute("data-state") === "closed") {
            trigger.click();
          }
        });
      });
    };

    openAllSections();
    const timer = setTimeout(openAllSections, 100);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
