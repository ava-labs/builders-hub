"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const SCROLL_THRESHOLD_PERCENT = 0.25;
const START_SCROLL_SPEED = 4;
const MAX_SCROLL_SPEED = 25;

// Selectors that should NOT initiate a drag — interactive children inside
// chart cards (recharts brushes, inputs, SVGs, etc).
const DRAG_BLOCKLIST_SELECTORS = [
  ".recharts-brush",
  ".recharts-brush-slide",
  ".recharts-brush-traveller",
  ".brush-slider-container",
  '[data-no-drag="true"]',
  "input",
  "button",
  "select",
  "textarea",
  '[role="slider"]',
  "svg",
  "path",
  "rect",
  "line",
  "circle",
];

export interface ChartCardDragHandlers {
  draggable: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  canDrag: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export interface UseChartDragAndDropOptions {
  // True if this user can reorder charts. Owners with multiple charts.
  canDragChart: (chartId: string) => boolean;
  onReorder: (draggedId: string, targetId: string) => void;
}

// Owns the playground's chart drag-and-drop state plus the auto-scroll
// behavior that fires when the cursor approaches the viewport edges during
// a drag. Returns a `getCardProps(chartId)` builder that ChartCard spreads
// onto its outer div, keeping the per-card markup short.
export function useChartDragAndDrop({
  canDragChart,
  onReorder,
}: UseChartDragAndDropOptions) {
  const [draggedChartId, setDraggedChartId] = useState<string | null>(null);
  const [dragOverChartId, setDragOverChartId] = useState<string | null>(null);
  const [isDragAllowed, setIsDragAllowed] = useState(false);

  const scrollAnimationFrameRef = useRef<number | null>(null);
  const scrollDirectionRef = useRef<"up" | "down" | null>(null);
  const scrollSpeedRef = useRef<number>(8);
  const initialDragYRef = useRef<number | null>(null);

  // Auto-scroll the page when a drag is in progress and the cursor is near
  // the top or bottom 25% of the viewport. Speed eases up the closer the
  // cursor gets to the edge.
  useEffect(() => {
    if (!draggedChartId) {
      if (scrollAnimationFrameRef.current !== null) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
        scrollAnimationFrameRef.current = null;
      }
      scrollDirectionRef.current = null;
      return;
    }

    const scroll = () => {
      if (scrollDirectionRef.current === null) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight
      );
      const windowHeight = window.innerHeight;
      const maxScroll = scrollHeight - windowHeight;
      const currentSpeed = scrollSpeedRef.current;

      if (scrollDirectionRef.current === "up" && scrollTop > 0) {
        window.scrollBy(0, -currentSpeed);
        scrollAnimationFrameRef.current = requestAnimationFrame(scroll);
      } else if (
        scrollDirectionRef.current === "down" &&
        scrollTop < maxScroll - 1
      ) {
        if (scrollTop < maxScroll - currentSpeed) {
          window.scrollBy(0, currentSpeed);
          scrollAnimationFrameRef.current = requestAnimationFrame(scroll);
        } else {
          window.scrollTo(0, maxScroll);
          scrollAnimationFrameRef.current = null;
          scrollDirectionRef.current = null;
        }
      } else {
        scrollAnimationFrameRef.current = null;
        scrollDirectionRef.current = null;
      }
    };

    const handleDragStart = (e: DragEvent) => {
      initialDragYRef.current = e.clientY;
    };

    const handleDrag = (e: DragEvent) => {
      const y = e.clientY;
      const windowHeight = window.innerHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight
      );
      const maxScroll = scrollHeight - windowHeight;
      const scrollThreshold = windowHeight * SCROLL_THRESHOLD_PERCENT;

      if (initialDragYRef.current === null) {
        initialDragYRef.current = y;
      }

      if (scrollAnimationFrameRef.current !== null) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
        scrollAnimationFrameRef.current = null;
      }

      let distanceFromEdge = 0;
      let shouldScroll = false;

      if (y < scrollThreshold && scrollTop > 0) {
        distanceFromEdge = y;
        scrollDirectionRef.current = "up";
        shouldScroll = true;
      } else if (y > windowHeight - scrollThreshold && scrollTop < maxScroll - 1) {
        distanceFromEdge = windowHeight - y;
        scrollDirectionRef.current = "down";
        shouldScroll = true;
      } else {
        scrollDirectionRef.current = null;
        shouldScroll = false;
      }

      if (shouldScroll) {
        // Eased acceleration: slow at the threshold, fast at the edge.
        const normalizedDistance =
          1 - distanceFromEdge / scrollThreshold;
        const easedFactor =
          normalizedDistance < 0.5
            ? 2 * normalizedDistance * normalizedDistance
            : 1 - Math.pow(-2 * normalizedDistance + 2, 3) / 2;
        scrollSpeedRef.current =
          START_SCROLL_SPEED +
          (MAX_SCROLL_SPEED - START_SCROLL_SPEED) * easedFactor;
        scrollAnimationFrameRef.current = requestAnimationFrame(scroll);
      }
    };

    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("dragover", handleDrag);
    document.addEventListener("drag", handleDrag);

    return () => {
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("dragover", handleDrag);
      document.removeEventListener("drag", handleDrag);
      if (scrollAnimationFrameRef.current !== null) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
        scrollAnimationFrameRef.current = null;
      }
      scrollDirectionRef.current = null;
      initialDragYRef.current = null;
    };
  }, [draggedChartId]);

  const getCardProps = useCallback(
    (chartId: string): ChartCardDragHandlers => {
      const canDrag = canDragChart(chartId);

      return {
        draggable: canDrag && isDragAllowed,
        isDragging: draggedChartId === chartId,
        isDragOver: dragOverChartId === chartId,
        canDrag,
        onMouseDown: (e) => {
          if (!canDrag) return;
          // Block drag init if the mousedown originated on an interactive
          // element (chart controls, brush handles, etc).
          const target = e.target as HTMLElement;
          for (const selector of DRAG_BLOCKLIST_SELECTORS) {
            if (target.matches(selector) || target.closest(selector)) {
              setIsDragAllowed(false);
              return;
            }
          }
          setIsDragAllowed(true);
        },
        onMouseUp: () => setIsDragAllowed(false),
        onDragStart: (e) => {
          if (!canDrag || !isDragAllowed) {
            e.preventDefault();
            return;
          }
          setDraggedChartId(chartId);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/html", chartId);
        },
        onDragOver: (e) => {
          // Always preventDefault so this card is a valid drop target.
          e.preventDefault();
          e.stopPropagation();
          if (
            !canDrag ||
            draggedChartId === null ||
            draggedChartId === chartId
          ) {
            return;
          }
          e.dataTransfer.dropEffect = "move";
          if (dragOverChartId !== chartId) {
            setDragOverChartId(chartId);
          }
        },
        onDragLeave: (e) => {
          // Only clear if we actually left the element (not just entered a
          // child). Compare the current cursor position to the bounding rect.
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          if (
            x < rect.left ||
            x > rect.right ||
            y < rect.top ||
            y > rect.bottom
          ) {
            if (dragOverChartId === chartId) {
              setDragOverChartId(null);
            }
          }
        },
        onDrop: (e) => {
          if (
            !canDrag ||
            draggedChartId === null ||
            draggedChartId === chartId
          )
            return;
          e.preventDefault();
          e.stopPropagation();
          onReorder(draggedChartId, chartId);
          setDraggedChartId(null);
          setDragOverChartId(null);
        },
        onDragEnd: () => {
          setDraggedChartId(null);
          setDragOverChartId(null);
          setIsDragAllowed(false);
          if (scrollAnimationFrameRef.current !== null) {
            cancelAnimationFrame(scrollAnimationFrameRef.current);
            scrollAnimationFrameRef.current = null;
          }
          scrollDirectionRef.current = null;
          initialDragYRef.current = null;
        },
      };
    },
    [canDragChart, draggedChartId, dragOverChartId, isDragAllowed, onReorder]
  );

  return {
    draggedChartId,
    dragOverChartId,
    getCardProps,
  };
}
