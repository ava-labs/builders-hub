"use client";

import { useRef, useState, useCallback } from "react";
import type {
  Annotation,
  AnnotationType,
  TextAnnotation,
  ArrowAnnotation,
  HighlightAnnotation,
  FreehandAnnotation,
  RectangleAnnotation,
} from "./types";
import { ARROW_STROKE_WIDTH } from "./constants";

interface AnnotationOverlayProps {
  annotations: Annotation[];
  activeToolType: AnnotationType | null;
  selectedAnnotationId: string | null;
  selectedColor: string;
  onAddHighlight: (x: number, y: number) => void;
  onAddText: (x: number, y: number) => void;
  onAddArrow: (startX: number, startY: number, endX: number, endY: number) => void;
  onAddFreehand: (points: Array<{ x: number; y: number }>) => void;
  onAddRectangle: (x: number, y: number, width: number, height: number) => void;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
}

const TEXT_SIZES = {
  small: 12,
  medium: 16,
  large: 22,
};

const HIGHLIGHT_SIZES = {
  small: 6,
  medium: 10,
  large: 14,
};

const ARROW_THICKNESS = {
  small: 2,
  medium: 3,
  large: 4,
};

export function AnnotationOverlay({
  annotations,
  activeToolType,
  selectedAnnotationId,
  selectedColor,
  onAddHighlight,
  onAddText,
  onAddArrow,
  onAddFreehand,
  onAddRectangle,
  onSelectAnnotation,
  onUpdateAnnotation,
}: AnnotationOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawingArrow, setIsDrawingArrow] = useState(false);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);
  const [arrowEnd, setArrowEnd] = useState<{ x: number; y: number } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Freehand drawing state
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);
  const [freehandPoints, setFreehandPoints] = useState<Array<{ x: number; y: number }>>([]);

  // Rectangle drawing state
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [rectEnd, setRectEnd] = useState<{ x: number; y: number } | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragAnnotationId, setDragAnnotationId] = useState<string | null>(null);

  // Convert client coordinates to percentage - allow full 0-100 range
  const toPercent = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 50, y: 50 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(2, Math.min(98, ((clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  // Handle click on overlay (for adding new annotations or deselecting)
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Don't process if we're drawing or dragging
    if (isDrawingArrow || isDrawingFreehand || isDrawingRect || isDragging) return;

    // Don't process if clicking on an existing annotation
    if ((e.target as SVGElement).closest('[data-annotation]')) return;

    const { x, y } = toPercent(e.clientX, e.clientY);

    if (activeToolType === "text") {
      onAddText(x, y);
    } else if (activeToolType === "highlight") {
      onAddHighlight(x, y);
    } else if (activeToolType === "freehand" || activeToolType === "rectangle" || activeToolType === "arrow") {
      // These tools use drag, not click - do nothing on click
      return;
    } else {
      // No tool active - deselect any selected annotation
      onSelectAnnotation(null);
    }
  }, [activeToolType, isDrawingArrow, isDrawingFreehand, isDrawingRect, isDragging, toPercent, onAddText, onAddHighlight, onSelectAnnotation]);

  // Start dragging an annotation
  const handleAnnotationMouseDown = useCallback((e: React.MouseEvent, annotation: Annotation) => {
    // Don't drag if we're using a tool
    if (activeToolType) return;

    e.stopPropagation();
    e.preventDefault();

    const { x, y } = toPercent(e.clientX, e.clientY);
    setDragStartPos({ x, y });
    setDragAnnotationId(annotation.id);
    setIsDragging(true);
    onSelectAnnotation(annotation.id);
  }, [activeToolType, toPercent, onSelectAnnotation]);

  // Drawing handlers (arrow, freehand, rectangle)
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Don't start drawing on existing annotation
    if ((e.target as SVGElement).closest('[data-annotation]')) return;

    const { x, y } = toPercent(e.clientX, e.clientY);

    if (activeToolType === "arrow") {
      setArrowStart({ x, y });
      setArrowEnd({ x, y });
      setIsDrawingArrow(true);
      e.preventDefault();
    } else if (activeToolType === "freehand") {
      setFreehandPoints([{ x, y }]);
      setIsDrawingFreehand(true);
      e.preventDefault();
    } else if (activeToolType === "rectangle") {
      setRectStart({ x, y });
      setRectEnd({ x, y });
      setIsDrawingRect(true);
      e.preventDefault();
    }
  }, [activeToolType, toPercent]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Handle dragging annotation
    if (isDragging && dragAnnotationId && dragStartPos) {
      const { x, y } = toPercent(e.clientX, e.clientY);
      const annotation = annotations.find(a => a.id === dragAnnotationId);

      if (annotation) {
        const deltaX = x - dragStartPos.x;
        const deltaY = y - dragStartPos.y;

        if (annotation.type === "arrow") {
          // Move entire arrow
          const arrowAnn = annotation as ArrowAnnotation;
          onUpdateAnnotation(dragAnnotationId, {
            startX: Math.max(2, Math.min(98, arrowAnn.startX + deltaX)),
            startY: Math.max(2, Math.min(98, arrowAnn.startY + deltaY)),
            endX: Math.max(2, Math.min(98, arrowAnn.endX + deltaX)),
            endY: Math.max(2, Math.min(98, arrowAnn.endY + deltaY)),
          } as Partial<ArrowAnnotation>);
        } else if (annotation.type === "freehand") {
          // Move freehand by shifting all points
          const freehandAnn = annotation as FreehandAnnotation;
          const newPoints = freehandAnn.points.map(p => ({
            x: Math.max(2, Math.min(98, p.x + deltaX)),
            y: Math.max(2, Math.min(98, p.y + deltaY)),
          }));
          onUpdateAnnotation(dragAnnotationId, { points: newPoints } as Partial<FreehandAnnotation>);
        } else if (annotation.type === "rectangle") {
          // Move rectangle
          const rectAnn = annotation as RectangleAnnotation;
          onUpdateAnnotation(dragAnnotationId, {
            x: Math.max(2, Math.min(98 - rectAnn.width, rectAnn.x + deltaX)),
            y: Math.max(2, Math.min(98 - rectAnn.height, rectAnn.y + deltaY)),
          } as Partial<RectangleAnnotation>);
        } else {
          // Move point or text
          const posAnn = annotation as HighlightAnnotation | TextAnnotation;
          onUpdateAnnotation(dragAnnotationId, {
            x: Math.max(2, Math.min(98, posAnn.x + deltaX)),
            y: Math.max(2, Math.min(98, posAnn.y + deltaY)),
          } as Partial<HighlightAnnotation | TextAnnotation>);
        }

        setDragStartPos({ x, y });
      }
      return;
    }

    const { x, y } = toPercent(e.clientX, e.clientY);

    // Handle arrow drawing
    if (isDrawingArrow && arrowStart) {
      setArrowEnd({ x, y });
      return;
    }

    // Handle freehand drawing - add points with distance threshold
    if (isDrawingFreehand && freehandPoints.length > 0) {
      const lastPoint = freehandPoints[freehandPoints.length - 1];
      const distance = Math.sqrt(Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2));
      // Only add point if moved more than 0.5% (allows smoother lines and shorter strokes)
      if (distance > 0.5) {
        setFreehandPoints(prev => [...prev, { x, y }]);
      }
      return;
    }

    // Handle rectangle drawing
    if (isDrawingRect && rectStart) {
      setRectEnd({ x, y });
      return;
    }
  }, [isDragging, dragAnnotationId, dragStartPos, isDrawingArrow, arrowStart, isDrawingFreehand, freehandPoints, isDrawingRect, rectStart, toPercent, annotations, onUpdateAnnotation]);

  const handleMouseUp = useCallback(() => {
    // End dragging
    if (isDragging) {
      setIsDragging(false);
      setDragStartPos(null);
      setDragAnnotationId(null);
      return;
    }

    // End arrow drawing
    if (isDrawingArrow && arrowStart && arrowEnd) {
      const length = Math.sqrt(
        Math.pow(arrowEnd.x - arrowStart.x, 2) + Math.pow(arrowEnd.y - arrowStart.y, 2)
      );
      if (length > 3) {
        onAddArrow(arrowStart.x, arrowStart.y, arrowEnd.x, arrowEnd.y);
      }
    }
    setIsDrawingArrow(false);
    setArrowStart(null);
    setArrowEnd(null);

    // End freehand drawing
    if (isDrawingFreehand && freehandPoints.length > 1) {
      onAddFreehand(freehandPoints);
    }
    setIsDrawingFreehand(false);
    setFreehandPoints([]);

    // End rectangle drawing
    if (isDrawingRect && rectStart && rectEnd) {
      const x = Math.min(rectStart.x, rectEnd.x);
      const y = Math.min(rectStart.y, rectEnd.y);
      const width = Math.abs(rectEnd.x - rectStart.x);
      const height = Math.abs(rectEnd.y - rectStart.y);
      // Only create if rectangle has meaningful size
      if (width > 3 && height > 3) {
        onAddRectangle(x, y, width, height);
      }
    }
    setIsDrawingRect(false);
    setRectStart(null);
    setRectEnd(null);
  }, [isDragging, isDrawingArrow, arrowStart, arrowEnd, onAddArrow, isDrawingFreehand, freehandPoints, onAddFreehand, isDrawingRect, rectStart, rectEnd, onAddRectangle]);

  // Handle clicking on an annotation (without dragging)
  const handleAnnotationClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!isDragging) {
      onSelectAnnotation(id);
    }
  }, [isDragging, onSelectAnnotation]);

  // Double-click to edit text
  const handleTextDoubleClick = useCallback((e: React.MouseEvent, annotation: TextAnnotation) => {
    e.stopPropagation();
    setEditingTextId(annotation.id);
  }, []);

  // Render a text annotation
  const renderText = (annotation: TextAnnotation) => {
    const isSelected = selectedAnnotationId === annotation.id;
    const isEditing = editingTextId === annotation.id;
    const fontSize = TEXT_SIZES[annotation.size];
    const opacity = annotation.opacity / 100;

    if (isEditing) {
      return (
        <foreignObject
          key={annotation.id}
          x={`${Math.max(0, annotation.x - 15)}%`}
          y={`${Math.max(0, annotation.y - 4)}%`}
          width="30%"
          height="8%"
          data-annotation
        >
          <input
            type="text"
            defaultValue={annotation.text}
            autoFocus
            className="w-full px-2 py-1 text-sm bg-transparent border-b-2 border-current focus:outline-none"
            style={{ fontSize, color: annotation.color }}
            onBlur={(e) => {
              onUpdateAnnotation(annotation.id, { text: e.target.value || "Label" });
              setEditingTextId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUpdateAnnotation(annotation.id, { text: (e.target as HTMLInputElement).value || "Label" });
                setEditingTextId(null);
              } else if (e.key === "Escape") {
                setEditingTextId(null);
              }
            }}
          />
        </foreignObject>
      );
    }

    return (
      <g
        key={annotation.id}
        data-annotation
        onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
        onClick={(e) => handleAnnotationClick(e, annotation.id)}
        onDoubleClick={(e) => handleTextDoubleClick(e, annotation)}
        style={{ cursor: isSelected && !activeToolType ? "move" : "pointer", opacity }}
      >
        {/* Text with stroke for better visibility on any background */}
        <text
          x={`${annotation.x}%`}
          y={`${annotation.y}%`}
          fill={annotation.color}
          stroke="white"
          strokeWidth={3}
          strokeLinejoin="round"
          paintOrder="stroke"
          fontSize={fontSize}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
          className="select-none"
          style={{ filter: isSelected ? "drop-shadow(0 0 4px rgba(0,0,0,0.3))" : undefined }}
        >
          {annotation.text}
        </text>
        {/* Selection indicator */}
        {isSelected && (
          <rect
            x={`${annotation.x - 3}%`}
            y={`${annotation.y - 2}%`}
            width="6%"
            height="4%"
            fill="none"
            stroke={annotation.color}
            strokeWidth={2}
            strokeDasharray="4"
            rx="2"
            style={{ transform: `translate(-${annotation.text.length * 2}px, 0)` }}
          />
        )}
      </g>
    );
  };

  // Render a highlight annotation (simple circle marker)
  const renderHighlight = (annotation: HighlightAnnotation) => {
    const isSelected = selectedAnnotationId === annotation.id;
    const radius = HIGHLIGHT_SIZES[annotation.size];
    const opacity = annotation.opacity / 100;

    return (
      <g
        key={annotation.id}
        data-annotation
        onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
        onClick={(e) => handleAnnotationClick(e, annotation.id)}
        style={{ cursor: isSelected && !activeToolType ? "move" : "pointer", opacity }}
      >
        {/* Outer ring */}
        <circle
          cx={`${annotation.x}%`}
          cy={`${annotation.y}%`}
          r={radius + 4}
          fill="none"
          stroke={annotation.color}
          strokeWidth={isSelected ? 3 : 2}
        />
        {/* Inner filled circle */}
        <circle
          cx={`${annotation.x}%`}
          cy={`${annotation.y}%`}
          r={radius}
          fill={annotation.color}
        />
        {/* Pulse animation for selection */}
        {isSelected && (
          <circle
            cx={`${annotation.x}%`}
            cy={`${annotation.y}%`}
            r={radius + 8}
            fill="none"
            stroke={annotation.color}
            strokeWidth={1}
            strokeDasharray="4"
          />
        )}
      </g>
    );
  };

  // Render an arrow annotation
  const renderArrow = (annotation: ArrowAnnotation) => {
    const isSelected = selectedAnnotationId === annotation.id;
    const markerId = `arrowhead-${annotation.id}`;
    const thickness = ARROW_STROKE_WIDTH[annotation.size];
    const opacity = annotation.opacity / 100;
    const lineStyle = annotation.lineStyle || "solid";
    const arrowheadStyle = annotation.arrowheadStyle || "filled";

    // Get strokeDasharray based on line style
    const strokeDasharray = lineStyle === "dashed" ? "8 4" : undefined;

    // Render arrowhead based on style
    const renderArrowhead = () => {
      if (arrowheadStyle === "none") return null;

      if (arrowheadStyle === "outline") {
        return (
          <marker
            id={markerId}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="none"
              stroke={annotation.color}
              strokeWidth={1}
            />
          </marker>
        );
      }

      // Default: filled
      return (
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={annotation.color}
          />
        </marker>
      );
    };

    return (
      <g
        key={annotation.id}
        data-annotation
        onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
        onClick={(e) => handleAnnotationClick(e, annotation.id)}
        style={{ cursor: isSelected && !activeToolType ? "move" : "pointer", opacity }}
      >
        <defs>
          {renderArrowhead()}
        </defs>
        {/* Invisible wider line for easier clicking/dragging */}
        <line
          x1={`${annotation.startX}%`}
          y1={`${annotation.startY}%`}
          x2={`${annotation.endX}%`}
          y2={`${annotation.endY}%`}
          stroke="transparent"
          strokeWidth={16}
        />
        <line
          x1={`${annotation.startX}%`}
          y1={`${annotation.startY}%`}
          x2={`${annotation.endX}%`}
          y2={`${annotation.endY}%`}
          stroke={annotation.color}
          strokeWidth={isSelected ? thickness + 1 : thickness}
          strokeDasharray={strokeDasharray}
          markerEnd={arrowheadStyle !== "none" ? `url(#${markerId})` : undefined}
        />
        {isSelected && (
          <>
            <circle
              cx={`${annotation.startX}%`}
              cy={`${annotation.startY}%`}
              r={5}
              fill={annotation.color}
            />
            <circle
              cx={`${annotation.endX}%`}
              cy={`${annotation.endY}%`}
              r={5}
              fill={annotation.color}
            />
          </>
        )}
      </g>
    );
  };

  // Render a freehand annotation
  const renderFreehand = (annotation: FreehandAnnotation) => {
    const isSelected = selectedAnnotationId === annotation.id;
    const opacity = annotation.opacity / 100;

    // Convert points array to SVG path (use numbers only, viewBox handles percentage mapping)
    if (annotation.points.length < 2) return null;
    const pathData = annotation.points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    // Use nested SVG with viewBox to map 0-100 coordinates to percentages
    return (
      <svg
        key={annotation.id}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
      >
        <g
          data-annotation
          onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
          onClick={(e) => handleAnnotationClick(e, annotation.id)}
          style={{ cursor: isSelected && !activeToolType ? "move" : "pointer", opacity }}
        >
          {/* Invisible wider path for easier clicking/dragging */}
          <path
            d={pathData}
            fill="none"
            stroke="transparent"
            strokeWidth={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={pathData}
            fill="none"
            stroke={annotation.color}
            strokeWidth={isSelected ? annotation.strokeWidth + 1 : annotation.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {isSelected && (
            <path
              d={pathData}
              fill="none"
              stroke={annotation.color}
              strokeWidth={annotation.strokeWidth + 4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4"
              opacity={0.3}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
      </svg>
    );
  };

  // Render a rectangle annotation
  const renderRectangle = (annotation: RectangleAnnotation) => {
    const isSelected = selectedAnnotationId === annotation.id;
    const opacity = annotation.opacity / 100;

    return (
      <g
        key={annotation.id}
        data-annotation
        onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
        onClick={(e) => handleAnnotationClick(e, annotation.id)}
        style={{ cursor: isSelected && !activeToolType ? "move" : "pointer", opacity }}
      >
        {/* Invisible larger rect for easier clicking/dragging */}
        <rect
          x={`${annotation.x}%`}
          y={`${annotation.y}%`}
          width={`${annotation.width}%`}
          height={`${annotation.height}%`}
          fill="transparent"
          stroke="transparent"
          strokeWidth={16}
        />
        <rect
          x={`${annotation.x}%`}
          y={`${annotation.y}%`}
          width={`${annotation.width}%`}
          height={`${annotation.height}%`}
          fill="none"
          stroke={annotation.color}
          strokeWidth={isSelected ? annotation.strokeWidth + 1 : annotation.strokeWidth}
        />
        {isSelected && (
          <rect
            x={`${annotation.x - 0.5}%`}
            y={`${annotation.y - 0.5}%`}
            width={`${annotation.width + 1}%`}
            height={`${annotation.height + 1}%`}
            fill="none"
            stroke={annotation.color}
            strokeWidth={1}
            strokeDasharray="4"
            opacity={0.5}
          />
        )}
      </g>
    );
  };

  // Render drawing arrow preview
  const renderDrawingArrow = () => {
    if (!isDrawingArrow || !arrowStart || !arrowEnd) return null;

    return (
      <line
        x1={`${arrowStart.x}%`}
        y1={`${arrowStart.y}%`}
        x2={`${arrowEnd.x}%`}
        y2={`${arrowEnd.y}%`}
        stroke={selectedColor}
        strokeWidth={2}
        strokeDasharray="4"
        opacity={0.7}
      />
    );
  };

  // Render drawing freehand preview
  const renderDrawingFreehand = () => {
    if (!isDrawingFreehand || freehandPoints.length < 2) return null;

    const pathData = freehandPoints
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    // Use nested SVG with viewBox to map 0-100 coordinates to percentages
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
      >
        <path
          d={pathData}
          fill="none"
          stroke={selectedColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  // Render drawing rectangle preview
  const renderDrawingRect = () => {
    if (!isDrawingRect || !rectStart || !rectEnd) return null;

    const x = Math.min(rectStart.x, rectEnd.x);
    const y = Math.min(rectStart.y, rectEnd.y);
    const width = Math.abs(rectEnd.x - rectStart.x);
    const height = Math.abs(rectEnd.y - rectStart.y);

    return (
      <rect
        x={`${x}%`}
        y={`${y}%`}
        width={`${width}%`}
        height={`${height}%`}
        fill="none"
        stroke={selectedColor}
        strokeWidth={2}
        strokeDasharray="4"
        opacity={0.7}
      />
    );
  };

  // Get cursor based on active tool or dragging state
  const getCursor = () => {
    if (isDragging) return "grabbing";
    if (activeToolType === "text") return "text";
    if (activeToolType === "arrow") return "crosshair";
    if (activeToolType === "highlight") return "crosshair";
    if (activeToolType === "freehand") return "crosshair";
    if (activeToolType === "rectangle") return "crosshair";
    return "default";
  };

  // Only show overlay if there's an active tool or existing annotations
  const hasContent = activeToolType || annotations.length > 0;
  if (!hasContent) return null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full z-10"
      style={{
        cursor: getCursor(),
        pointerEvents: activeToolType || isDragging || selectedAnnotationId ? "auto" : "none",
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Make annotations always clickable */}
      <g style={{ pointerEvents: "auto" }}>
        {/* Render all annotations */}
        {annotations.map((annotation) => {
          switch (annotation.type) {
            case "highlight":
              return renderHighlight(annotation);
            case "text":
              return renderText(annotation);
            case "arrow":
              return renderArrow(annotation);
            case "freehand":
              return renderFreehand(annotation);
            case "rectangle":
              return renderRectangle(annotation);
            default:
              return null;
          }
        })}
      </g>

      {/* Drawing previews */}
      {renderDrawingArrow()}
      {renderDrawingFreehand()}
      {renderDrawingRect()}
    </svg>
  );
}
