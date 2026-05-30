'use client';

import { Monitor, Moon, Sparkles, Sun } from 'lucide-react';
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
import { useChartTheme, type ChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

type ThemeOption = {
  id: ChartTheme;
  label: string;
  description: string;
  icon: typeof Sun;
};

// `Auto` is the default — chart cards mirror the Builder Hub site's
// light/dark mode. The other three are escape hatches for users who
// want a fixed look regardless of site theme (most useful when capturing
// screenshots for a deck whose theme differs from their current setting).
const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'auto',
    label: 'Auto',
    description: 'Match site theme',
    icon: Monitor,
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Pure light cards',
    icon: Sun,
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Pure dark cards',
    icon: Moon,
  },
  {
    id: 'rich',
    label: 'Rich',
    description: 'Elevated dark cards',
    icon: Sparkles,
  },
];

export function ChartThemePicker() {
  const { theme, setTheme, isHydrated } = useChartTheme();
  const active = THEME_OPTIONS.find((opt) => opt.id === theme) ?? THEME_OPTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Chart theme: ${active.label}. Click to change.`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <ActiveIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Chart theme · {active.label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-auto p-2 max-w-[95vw]"
        align="end"
        collisionPadding={8}
      >
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
          Chart theme
        </p>
        <div className="flex flex-col gap-0.5">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = opt.id === theme;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                disabled={!isHydrated}
                aria-pressed={isActive}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors cursor-pointer',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent/50',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="font-medium">{opt.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
