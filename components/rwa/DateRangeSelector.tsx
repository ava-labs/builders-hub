'use client'

import { useState, useEffect } from 'react'
import { format, subDays, subMonths, startOfYear } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/utils/cn'
import type { DateRange, DatePreset } from '@/lib/rwa/types'

interface DateRangeSelectorProps {
  dateRange: DateRange | null
  onDateRangeChange: (range: DateRange | null) => void
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
]

const TRIGGER_LABELS: Record<DatePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'ytd': 'Year to date',
  'all': 'All time',
}

function getDateRangeFromPreset(preset: DatePreset): DateRange | null {
  const now = new Date()
  switch (preset) {
    case '7d':
      return { from: subDays(now, 7), to: now }
    case '30d':
      return { from: subDays(now, 30), to: now }
    case '90d':
      return { from: subMonths(now, 3), to: now }
    case 'ytd':
      return { from: startOfYear(now), to: now }
    case 'all':
      return null
  }
}

export function DateRangeSelector({
  dateRange,
  onDateRangeChange,
}: DateRangeSelectorProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [activePreset, setActivePreset] = useState<DatePreset>('all')
  const [open, setOpen] = useState(false)
  const [calendarRange, setCalendarRange] = useState<{ from: Date; to?: Date } | undefined>()

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handlePresetClick = (preset: DatePreset) => {
    setActivePreset(preset)
    setCalendarRange(undefined)
    onDateRangeChange(getDateRangeFromPreset(preset))
    setOpen(false)
  }

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from) {
      setCalendarRange({ from: range.from, to: range.to })
    } else {
      setCalendarRange(undefined)
    }
    if (range?.from && range?.to) {
      setActivePreset('all')
      onDateRangeChange({ from: range.from, to: range.to })
      setOpen(false)
    }
  }

  const triggerLabel = activePreset !== 'all' || !dateRange
    ? TRIGGER_LABELS[activePreset]
    : `${format(dateRange.from, 'MMM d, yyyy')} – ${format(dateRange.to, 'MMM d, yyyy')}`

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (isOpen) setCalendarRange(undefined)
    }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2.5">
          <CalendarIcon className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 max-w-[95vw] sm:max-w-none overflow-x-hidden sm:overflow-x-visible" align="end" collisionPadding={8}>
        <div className="flex flex-col sm:flex-row">
          {/* Presets — horizontal row on mobile, hidden on sm+ */}
          <div className="flex gap-1 border-b p-2 sm:hidden overflow-x-auto">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetClick(preset.value)}
                className={cn(
                  'text-xs whitespace-nowrap px-2.5 py-1.5 rounded-sm font-medium transition-colors',
                  activePreset === preset.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              captionLayout="dropdown"
              startMonth={new Date(2024, 0)}
              endMonth={new Date(new Date().getFullYear() + 1, 11)}
              defaultMonth={dateRange?.from ?? new Date()}
              selected={calendarRange ?? (dateRange ? { from: dateRange.from, to: dateRange.to } : undefined)}
              onSelect={handleCalendarSelect}
              numberOfMonths={isMobile ? 1 : 2}
            />
          </div>
          {/* Presets sidebar — hidden on mobile, visible on sm+ */}
          <div className="hidden sm:flex flex-col gap-1 border-l p-3 min-w-[130px]">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetClick(preset.value)}
                className={cn(
                  'text-xs text-left px-3 py-1.5 rounded-sm font-medium transition-colors',
                  activePreset === preset.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
