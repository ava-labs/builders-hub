"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TourStep } from "./types";

interface TourTooltipProps {
  step: TourStep;
  targetRect: DOMRect | null;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onSkipWalletStep?: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isWaitingForWallet?: boolean;
  isCoreWalletAvailable?: boolean;
}

type Position = "top" | "bottom" | "left" | "right";

function calculatePosition(
  targetRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  preferredPosition: Position | "auto"
): { position: Position; x: number; y: number } {
  const gap = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceTop = targetRect.top;
  const spaceBottom = viewportHeight - targetRect.bottom;
  const spaceLeft = targetRect.left;
  const spaceRight = viewportWidth - targetRect.right;

  let position: Position = "bottom";

  if (preferredPosition !== "auto") {
    position = preferredPosition;
  } else {
    // Pick best position based on available space
    if (spaceBottom >= tooltipHeight + gap) {
      position = "bottom";
    } else if (spaceTop >= tooltipHeight + gap) {
      position = "top";
    } else if (spaceRight >= tooltipWidth + gap) {
      position = "right";
    } else if (spaceLeft >= tooltipWidth + gap) {
      position = "left";
    }
  }

  let x = 0;
  let y = 0;

  switch (position) {
    case "top":
      x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      y = targetRect.top - tooltipHeight - gap;
      break;
    case "bottom":
      x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      y = targetRect.bottom + gap;
      break;
    case "left":
      x = targetRect.left - tooltipWidth - gap;
      y = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      break;
    case "right":
      x = targetRect.right + gap;
      y = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      break;
  }

  // Keep within viewport
  x = Math.max(12, Math.min(viewportWidth - tooltipWidth - 12, x));
  y = Math.max(12, Math.min(viewportHeight - tooltipHeight - 12, y));

  return { position, x, y };
}

export function TourTooltip({
  step,
  targetRect,
  currentIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onSkipWalletStep,
  isFirstStep,
  isLastStep,
  isWaitingForWallet = false,
  isCoreWalletAvailable = true,
}: TourTooltipProps) {
  const [mounted, setMounted] = React.useState(false);
  const [tooltipSize, setTooltipSize] = React.useState({ width: 320, height: 180 });
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      setTooltipSize({ width: rect.width, height: rect.height });
    }
  }, [step]);

  if (!mounted || !targetRect) return null;

  const { x, y } = calculatePosition(
    targetRect,
    tooltipSize.width,
    tooltipSize.height,
    step.position || "auto"
  );

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-[10000] w-80 rounded-lg border bg-card shadow-lg"
      style={{ left: x, top: y }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {currentIndex + 1} of {totalSteps}
        </span>
        <button
          onClick={onSkip}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground">
          {isWaitingForWallet
            ? "Waiting for wallet connection..."
            : step.isWalletPrompt && !isCoreWalletAvailable
              ? "Download Core wallet to get started."
              : step.description}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={isFirstStep || isWaitingForWallet}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <button
          onClick={isWaitingForWallet && onSkipWalletStep ? onSkipWalletStep : onSkip}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {isWaitingForWallet ? "Skip wallet" : "Skip tour"}
        </button>

        <Button size="sm" onClick={onNext} disabled={isWaitingForWallet}>
          {isLastStep
            ? "Done"
            : step.isWalletPrompt
              ? isCoreWalletAvailable
                ? "Connect"
                : "Download"
              : "Next"}
          {!isLastStep && !step.isWalletPrompt && <ChevronRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>
    </div>,
    document.body
  );
}
