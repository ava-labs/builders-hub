'use client';

import { Check, Palette as PaletteIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useChartPalette } from '@/hooks/useChartPalette';

// Compact palette switcher rendered next to chart-section headers. Trigger
// is a small swatch button showing the active palette's mid shade; the
// popover lists every preset as a clickable swatch with a checkmark on
// the active one. Persistence + sync are handled by the hook.
//
// Ported from the dApp Stats dashboard's `components/rwa/PalettePicker.tsx`
// (PR #4093) — same UX shape, adapted to the project's existing tooltip
// + popover primitives so the visual language stays consistent.
export function PalettePicker() {
  const { palette, setPalette, presets, isHydrated } = useChartPalette();

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Chart palette: ${palette.name}. Click to change.`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <span className="relative flex items-center justify-center">
                <PaletteIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {/* Tiny swatch dot in the corner so the user can see the
                    active color at a glance without opening the popover. */}
                <span
                  className="absolute -bottom-1 -right-1 block h-2 w-2 rounded-full ring-1 ring-background"
                  style={{ backgroundColor: palette.shades[500] }}
                  aria-hidden="true"
                />
              </span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Chart palette · {palette.name}</TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-auto p-3 max-w-[95vw]"
        align="end"
        collisionPadding={8}
      >
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Chart palette
        </p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const isActive = preset.name === palette.name;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => setPalette(preset.name)}
                disabled={!isHydrated}
                aria-label={preset.name}
                aria-pressed={isActive}
                title={preset.name}
                className="group relative h-7 w-7 rounded-md transition-transform hover:scale-110 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: preset.shades[500] }}
              >
                {isActive && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check
                      className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                      aria-hidden="true"
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
