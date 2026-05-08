"use client";
import { useEffect } from "react";
import type { Annotation } from "../types";
import type { ChartType, PresetType, ChartDisplaySettings } from "../types";
import type { CustomTemplate } from "./useCustomTemplates";

interface UseStudioKeyboardShortcutsOptions {
  isOpen: boolean;
  onSave: () => void;
  onCopy: () => void;
  onPresetChange: (preset: PresetType | string) => void;
  templates: CustomTemplate[];
  setChartType: (type: ChartType) => void;
  setChartDisplay: (display: Partial<ChartDisplaySettings>) => void;
  chartDisplay: ChartDisplaySettings;
  selectedAnnotationId: string | null;
  annotations: Annotation[];
  deleteAnnotation: (id: string) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
}

// Owns the studio's global keyboard shortcuts. Cmd+S/C export, number keys
// switch presets/templates, L/B/A switch chart type, G/D/R/T toggle chart
// display flags, Delete removes the selected annotation, arrow keys nudge it.
export function useStudioKeyboardShortcuts({
  isOpen,
  onSave,
  onCopy,
  onPresetChange,
  templates,
  setChartType,
  setChartDisplay,
  chartDisplay,
  selectedAnnotationId,
  annotations,
  deleteAnnotation,
  updateAnnotation,
}: UseStudioKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const isInInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      if (isMod && e.key === "s") {
        e.preventDefault();
        onSave();
        return;
      }

      if (isMod && e.key === "c" && !isInInput) {
        e.preventDefault();
        onCopy();
        return;
      }

      // Skip non-modifier shortcuts while typing in form fields.
      if (isInInput) return;

      // Number keys 1-N: switch presets (1-4) and custom templates (5+).
      if (!isMod && !e.shiftKey && !e.altKey) {
        const presets: (PresetType | string)[] = [
          "default",
          "social-media",
          "slide-deck",
          "customize",
          ...templates.map((t) => t.id),
        ];
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= presets.length) {
          e.preventDefault();
          onPresetChange(presets[keyNum - 1]);
          return;
        }
      }

      if (!isMod && !e.shiftKey && !e.altKey) {
        const chartTypeMap: Record<string, ChartType> = {
          l: "line",
          b: "bar",
          a: "area",
        };
        if (chartTypeMap[e.key.toLowerCase()]) {
          e.preventDefault();
          setChartType(chartTypeMap[e.key.toLowerCase()]);
          return;
        }
      }

      if (!isMod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setChartDisplay({ showGridLines: !chartDisplay.showGridLines });
        return;
      }
      if (!isMod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setChartDisplay({ showDataLabels: !chartDisplay.showDataLabels });
        return;
      }
      if (!isMod && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setChartDisplay({ showAvgLine: !chartDisplay.showAvgLine });
        return;
      }
      if (!isMod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setChartDisplay({ showTotalLine: !chartDisplay.showTotalLine });
        return;
      }

      // Delete/Backspace removes the selected annotation.
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedAnnotationId
      ) {
        e.preventDefault();
        deleteAnnotation(selectedAnnotationId);
        return;
      }

      // Arrow keys nudge the selected annotation. Shift = larger step.
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
        selectedAnnotationId
      ) {
        e.preventDefault();
        const annotation = annotations.find((a) => a.id === selectedAnnotationId);
        if (!annotation) return;

        const step = e.shiftKey ? 5 : 1;
        let deltaX = 0;
        let deltaY = 0;
        switch (e.key) {
          case "ArrowUp":
            deltaY = -step;
            break;
          case "ArrowDown":
            deltaY = step;
            break;
          case "ArrowLeft":
            deltaX = -step;
            break;
          case "ArrowRight":
            deltaX = step;
            break;
        }

        if (annotation.type === "arrow") {
          updateAnnotation(selectedAnnotationId, {
            startX: Math.max(2, Math.min(98, annotation.startX + deltaX)),
            startY: Math.max(2, Math.min(98, annotation.startY + deltaY)),
            endX: Math.max(2, Math.min(98, annotation.endX + deltaX)),
            endY: Math.max(2, Math.min(98, annotation.endY + deltaY)),
          });
        } else if (
          annotation.type === "highlight" ||
          annotation.type === "text"
        ) {
          updateAnnotation(selectedAnnotationId, {
            x: Math.max(2, Math.min(98, annotation.x + deltaX)),
            y: Math.max(2, Math.min(98, annotation.y + deltaY)),
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    onSave,
    onCopy,
    onPresetChange,
    templates,
    setChartType,
    setChartDisplay,
    chartDisplay,
    selectedAnnotationId,
    annotations,
    deleteAnnotation,
    updateAnnotation,
  ]);
}
