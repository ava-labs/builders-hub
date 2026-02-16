'use client'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PALETTE_PRESETS } from '@/lib/rwa/constants/palettes'
import { usePalette } from '@/lib/rwa/hooks/usePalette'

export function PalettePicker() {
  const { palette, setPalette } = usePalette()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Change color palette"
        >
          <div
            className="h-4 w-4 rounded-sm"
            style={{ backgroundColor: palette.shades[500] }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 max-w-[95vw]" align="end" collisionPadding={8}>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Dashboard palette
        </p>
        <div className="flex gap-2">
          {PALETTE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => setPalette(preset.name)}
              className="group relative h-7 w-7 rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: preset.shades[500] }}
              aria-label={preset.name}
              title={preset.name}
            >
              {preset.name === palette.name && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    className="text-white drop-shadow-sm"
                  >
                    <path
                      d="M3 7l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
