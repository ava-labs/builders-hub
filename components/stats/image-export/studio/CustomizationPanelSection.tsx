"use client";
import type React from "react";
import { ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import {
  CustomizationPanel,
  type CustomizationPanelProps,
} from "../CustomizationPanel";

// Wraps CustomizationPanel with the studio's responsive layout: a persistent
// right sidebar on desktop and a bottom-anchored collapsible on mobile.
type CustomizationPanelSectionProps = CustomizationPanelProps & {
  mobileExpanded: boolean;
  onMobileExpandedChange: (expanded: boolean) => void;
};

export function CustomizationPanelSection(props: CustomizationPanelSectionProps) {
  const {
    mobileExpanded,
    onMobileExpandedChange,
    isCustomized,
    onReset,
    ...panelProps
  } = props;

  return (
    <>
      {/* Desktop: persistent sidebar. */}
      <div className="hidden md:block border-l p-4 overflow-y-auto shrink-0 w-[280px] bg-background">
        <CustomizationPanel
          {...panelProps}
          isCustomized={isCustomized}
          onReset={onReset}
        />
      </div>

      {/* Mobile: collapsible. */}
      <div className="md:hidden border-t shrink-0">
        <button
          onClick={() => onMobileExpandedChange(!mobileExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between"
        >
          <span className="flex items-center gap-2 text-sm font-normal">
            {mobileExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" /> Hide
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" /> Customize
              </>
            )}
          </span>
          {mobileExpanded && isCustomized && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </span>
          )}
        </button>
        {mobileExpanded && (
          <div
            className="h-[300px] overflow-y-auto px-4 pb-4 overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            <CustomizationPanel
              {...panelProps}
              isCustomized={isCustomized}
              onReset={onReset}
              hideReset={true}
            />
          </div>
        )}
      </div>
    </>
  );
}
