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
  /** The side of the target the card sits on: that of the step the target was measured for. */
  position?: TourStep["position"];
  /** The tour moved to its next stop: the card travels there. A scroll or a resize places it at once. */
  glide?: boolean;
  /** The tour is closing: the card fades out. */
  leaving?: boolean;
}

type Position = "top" | "bottom" | "left" | "right";

/** con-tour-glide: the card grows from the side that faces its target. */
const ORIGIN: Record<Position, string> = {
  right: "left center",
  left: "right center",
  bottom: "center top",
  top: "center bottom",
};

/**
 * con-tour-glide: the card travels with the spotlight (translate, 350ms on the in-out curve); it enters from 0.97 and
 * opacity 0 in 180ms on the strong ease-out and leaves in 150ms. Reduce Motion: the site policy drops the travel and
 * the scale, so the card jumps as before and only fades.
 */
const CARD_IN = "[transition:opacity_180ms_var(--ease-out),scale_180ms_var(--ease-out)]";
const CARD_GLIDE =
  "[transition:opacity_180ms_var(--ease-out),scale_180ms_var(--ease-out),translate_350ms_var(--ease-in-out)]";
const CARD_OUT = "pointer-events-none opacity-0 [transition:opacity_150ms_var(--ease-out)]";

/** The card's words swap at the bottom of a 260ms dip: 104ms out, then 156ms back. */
const DIP_OUT_MS = 104;

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
  position: preferredSide,
  glide = false,
  leaving = false,
}: TourTooltipProps) {
  const [mounted, setMounted] = React.useState(false);
  const [tooltipSize, setTooltipSize] = React.useState({ width: 320, height: 180 });
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  // con-tour-glide: the words the card shows (its count, title and text). New words wait for the bottom of the dip.
  const count = `${currentIndex + 1} of ${totalSteps}`;
  const [shown, setShown] = React.useState({ step, count });
  const dipping = shown.step.id !== step.id || shown.count !== count;
  const visible = mounted && targetRect !== null;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!dipping) return;
    const timer = setTimeout(() => setShown({ step, count }), DIP_OUT_MS);
    return () => clearTimeout(timer);
  }, [dipping, step, count]);

  // Measured once the card shows and whenever its words change, before paint; by layout size, which the entrance
  // scale does not shrink.
  React.useLayoutEffect(() => {
    if (tooltipRef.current) {
      setTooltipSize({ width: tooltipRef.current.offsetWidth, height: tooltipRef.current.offsetHeight });
    }
  }, [visible, shown]);

  if (!mounted || !targetRect) return null;

  const { position, x, y } = calculatePosition(
    targetRect,
    tooltipSize.width,
    tooltipSize.height,
    preferredSide || "auto"
  );
  // The dip on the card's words: opacity and a 2px blur, so a swap never flickers while the card travels.
  const dip = cn(
    "transition-[opacity,filter] ease-[ease] motion-reduce:blur-none",
    dipping ? "opacity-0 blur-[2px] duration-104" : "opacity-100 blur-none duration-156"
  );

  return createPortal(
    <div
      ref={tooltipRef}
      className={cn(
        "fixed left-0 top-0 z-[10000] w-80 rounded-lg border bg-card shadow-lg",
        leaving ? CARD_OUT : cn("starting:scale-[0.97] starting:opacity-0", glide ? CARD_GLIDE : CARD_IN)
      )}
      style={{ translate: `${x}px ${y}px`, transformOrigin: ORIGIN[position] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className={cn("text-xs text-muted-foreground", dip)}>{shown.count}</span>
        <button
          onClick={onSkip}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className={cn("p-4", dip)}>
        <h3 className="font-semibold mb-1">{shown.step.title}</h3>
        <p className="text-sm text-muted-foreground">
          {isWaitingForWallet
            ? "Waiting for wallet connection..."
            : shown.step.isWalletPrompt && !isCoreWalletAvailable
              ? "Connect a wallet extension, or use a Console wallet from the top bar."
              : shown.step.description}
        </p>
      </div>

      {/* Footer: never dipped, so its labels and disabled states always match the step a click acts on */}
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
