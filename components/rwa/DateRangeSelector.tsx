'use client'

import { useState } from 'react'
import { format, subDays, subMonths, startOfYear } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DateRange, DatePreset } from '@/lib/rwa/types'

interface DateRangeSelectorProps {
  dateRange: DateRange | null
  onDateRangeChange: (range: DateRange | null) => void
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All' },
]

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
  const [activePreset, setActivePreset] = useState<DatePreset>('all')

  const handlePresetClick = (preset: DatePreset) => {
    setActivePreset(preset)
    onDateRangeChange(getDateRangeFromPreset(preset))
  }

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setActivePreset('all')
      onDateRangeChange({ from: range.from, to: range.to })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-border">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              activePreset === preset.value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            } ${preset.value === '7d' ? 'rounded-l-md' : ''} ${preset.value === 'all' ? 'rounded-r-md' : ''}`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateRange
              ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`
              : 'Custom'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={
              dateRange ? { from: dateRange.from, to: dateRange.to } : undefined
            }
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
