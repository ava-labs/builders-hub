"use client";

import { useState, useCallback } from "react";
import type {
  Annotation,
  AnnotationType,
  AnnotationSize,
  HighlightAnnotation,
  TextAnnotation,
  ArrowAnnotation,
} from "../types";

// Preset colors for annotations
export const ANNOTATION_COLORS = [
  "#e84142", // Avalanche red
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
];

interface UseAnnotationsReturn {
  annotations: Annotation[];
  activeToolType: AnnotationType | null;
  selectedAnnotationId: string | null;
  selectedColor: string;
  selectedSize: AnnotationSize;
  selectedOpacity: number;
  setActiveToolType: (type: AnnotationType | null) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  setSelectedColor: (color: string) => void;
  setSelectedSize: (size: AnnotationSize) => void;
  setSelectedOpacity: (opacity: number) => void;
  addHighlight: (x: number, y: number) => void;
  addText: (x: number, y: number, text?: string) => void;
  addArrow: (startX: number, startY: number, endX: number, endY: number) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  clearAllAnnotations: () => void;
  hasAnnotations: boolean;
}

export function useAnnotations(): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeToolType, setActiveToolType] = useState<AnnotationType | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(ANNOTATION_COLORS[0]);
  const [selectedSize, setSelectedSize] = useState<AnnotationSize>("medium");
  const [selectedOpacity, setSelectedOpacity] = useState<number>(100);

  const generateId = () => `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const addHighlight = useCallback((x: number, y: number) => {
    const newAnnotation: HighlightAnnotation = {
      id: generateId(),
      type: "highlight",
      x,
      y,
      size: selectedSize,
      color: selectedColor,
      opacity: selectedOpacity,
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setSelectedAnnotationId(newAnnotation.id);
    setActiveToolType(null); // Deselect tool after adding
  }, [selectedColor, selectedSize, selectedOpacity]);

  const addText = useCallback((
    x: number,
    y: number,
    text: string = "Label"
  ) => {
    const newAnnotation: TextAnnotation = {
      id: generateId(),
      type: "text",
      text,
      x,
      y,
      size: selectedSize,
      color: selectedColor,
      opacity: selectedOpacity,
      hasBackground: false,
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setSelectedAnnotationId(newAnnotation.id);
    setActiveToolType(null);
  }, [selectedColor, selectedSize, selectedOpacity]);

  const addArrow = useCallback((startX: number, startY: number, endX: number, endY: number) => {
    const newAnnotation: ArrowAnnotation = {
      id: generateId(),
      type: "arrow",
      startX,
      startY,
      endX,
      endY,
      size: selectedSize,
      color: selectedColor,
      opacity: selectedOpacity,
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setSelectedAnnotationId(newAnnotation.id);
    setActiveToolType(null);
  }, [selectedColor, selectedSize, selectedOpacity]);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations((prev) =>
      prev.map((ann) => (ann.id === id ? { ...ann, ...updates } as Annotation : ann))
    );
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((ann) => ann.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  }, [selectedAnnotationId]);

  const clearAllAnnotations = useCallback(() => {
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setActiveToolType(null);
  }, []);

  return {
    annotations,
    activeToolType,
    selectedAnnotationId,
    selectedColor,
    selectedSize,
    selectedOpacity,
    setActiveToolType,
    setSelectedAnnotationId,
    setSelectedColor,
    setSelectedSize,
    setSelectedOpacity,
    addHighlight,
    addText,
    addArrow,
    updateAnnotation,
    deleteAnnotation,
    clearAllAnnotations,
    hasAnnotations: annotations.length > 0,
  };
}
