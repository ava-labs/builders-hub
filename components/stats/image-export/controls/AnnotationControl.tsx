"use client";

import { Circle, Type, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Annotation, AnnotationType, AnnotationSize } from "../types";
import { ANNOTATION_COLORS } from "../hooks/useAnnotations";

interface AnnotationControlProps {
  annotations: Annotation[];
  activeToolType: AnnotationType | null;
  selectedAnnotationId: string | null;
  selectedColor: string;
  selectedSize: AnnotationSize;
  selectedOpacity: number;
  onToolSelect: (type: AnnotationType | null) => void;
  onAnnotationSelect: (id: string | null) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: AnnotationSize) => void;
  onOpacityChange: (opacity: number) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onClearAll: () => void;
}

const TOOL_OPTIONS: { type: AnnotationType; label: string; icon: React.ReactNode }[] = [
  { type: "highlight", label: "Point", icon: <Circle className="h-4 w-4" /> },
  { type: "text", label: "Text", icon: <Type className="h-4 w-4" /> },
  { type: "arrow", label: "Arrow", icon: <ArrowRight className="h-4 w-4" /> },
];

const SIZE_OPTIONS: { value: AnnotationSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

function getAnnotationDescription(annotation: Annotation): string {
  switch (annotation.type) {
    case "highlight":
      return "Point";
    case "text":
      return annotation.text.length > 12 ? `"${annotation.text.slice(0, 12)}..."` : `"${annotation.text}"`;
    case "arrow":
      return "Arrow";
    default:
      return "Annotation";
  }
}

export function AnnotationControl({
  annotations,
  activeToolType,
  selectedAnnotationId,
  selectedColor,
  selectedSize,
  selectedOpacity,
  onToolSelect,
  onAnnotationSelect,
  onColorChange,
  onSizeChange,
  onOpacityChange,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onClearAll,
}: AnnotationControlProps) {
  const selectedAnnotation = selectedAnnotationId
    ? annotations.find((a) => a.id === selectedAnnotationId)
    : null;

  // Update the selected annotation's properties
  const handleSelectedColorChange = (color: string) => {
    onColorChange(color);
    if (selectedAnnotation) {
      onUpdateAnnotation(selectedAnnotation.id, { color });
    }
  };

  const handleSelectedSizeChange = (size: AnnotationSize) => {
    onSizeChange(size);
    if (selectedAnnotation) {
      onUpdateAnnotation(selectedAnnotation.id, { size } as Partial<Annotation>);
    }
  };

  const handleSelectedOpacityChange = (opacity: number) => {
    onOpacityChange(opacity);
    if (selectedAnnotation) {
      onUpdateAnnotation(selectedAnnotation.id, { opacity });
    }
  };

  return (
    <div className="space-y-3">
      {/* Tool selector */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Add Annotation</label>
        <div className="flex gap-1">
          {TOOL_OPTIONS.map((tool) => (
            <button
              key={tool.type}
              type="button"
              onClick={() => onToolSelect(activeToolType === tool.type ? null : tool.type)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-colors",
                activeToolType === tool.type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
            >
              {tool.icon}
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style controls - Color, Size, Opacity */}
      <div className="space-y-2">
        {/* Color selector */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Color</label>
          <div className="flex gap-1.5 items-center">
            {ANNOTATION_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleSelectedColorChange(color)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
                  (selectedAnnotation?.color || selectedColor) === color
                    ? "border-foreground ring-2 ring-primary/30"
                    : "border-transparent hover:border-foreground/30"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
            {/* Custom color picker */}
            <div className="relative">
              <input
                type="color"
                value={selectedAnnotation?.color || selectedColor}
                onChange={(e) => handleSelectedColorChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                  !ANNOTATION_COLORS.includes(selectedAnnotation?.color || selectedColor)
                    ? "border-foreground ring-2 ring-primary/30"
                    : "border-dashed border-muted-foreground/50 hover:border-foreground/50"
                )}
                style={{
                  backgroundColor: !ANNOTATION_COLORS.includes(selectedAnnotation?.color || selectedColor)
                    ? (selectedAnnotation?.color || selectedColor)
                    : "transparent"
                }}
              >
                {ANNOTATION_COLORS.includes(selectedAnnotation?.color || selectedColor) && (
                  <span className="text-[10px] text-muted-foreground">+</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Size and Opacity in a row */}
        <div className="flex gap-3">
          {/* Size selector */}
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1.5 block">Size</label>
            <div className="flex gap-1">
              {SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelectedSizeChange(option.value)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                    (selectedAnnotation && "size" in selectedAnnotation ? selectedAnnotation.size : selectedSize) === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity slider */}
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Opacity {selectedAnnotation?.opacity ?? selectedOpacity}%
            </label>
            <input
              type="range"
              min="20"
              max="100"
              step="10"
              value={selectedAnnotation?.opacity ?? selectedOpacity}
              onChange={(e) => handleSelectedOpacityChange(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      </div>

      {/* Active tool hint */}
      {activeToolType && (
        <div className="px-2 py-1.5 bg-primary/10 rounded-md text-xs text-primary">
          {activeToolType === "highlight" && "Click anywhere to add a highlight point"}
          {activeToolType === "text" && "Click anywhere to add a text label. Double-click to edit."}
          {activeToolType === "arrow" && "Click and drag to draw an arrow"}
        </div>
      )}

      {/* Annotation list */}
      {annotations.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Your Annotations</label>
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                onClick={() => onAnnotationSelect(annotation.id)}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors",
                  selectedAnnotationId === annotation.id
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: annotation.color, opacity: annotation.opacity / 100 }}
                  />
                  <span className="truncate max-w-[100px]">
                    {getAnnotationDescription(annotation)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteAnnotation(annotation.id);
                  }}
                  className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {annotations.length === 0 && !activeToolType && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Select a tool above to add annotations
        </p>
      )}
    </div>
  );
}
